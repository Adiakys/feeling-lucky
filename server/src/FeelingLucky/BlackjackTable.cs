using Microsoft.Extensions.Options;

namespace FeelingLucky;

internal class BlackjackTable(IOptions<FeelingLuckyOptions> options) : Table("blackjack", options)
{
    // Up to five chips of one prize on the betting circle: a win pays that prize.
    const int MaxChips = 5;

    // The hole card stays face down until the dealer's turn.
    protected override (Card[][] Hands, Card[] Dealer) Stage(Tier[] tiers)
    {
        dealerShown = 1;
        return Cards.BlackjackDeal(tiers);
    }

    protected override async Task Opened(Seat[] playing)
    {
        await Wait(1);
        lock (gate)
        {
            foreach (var seat in playing.Where(seat => Cards.IsNatural(seat.Hands[0].Cards)))
            {
                seat.Result = Cards.IsSpadesJack(seat.Hands[0].Cards) ? Result.Spades : Result.Natural;
                seat.Tier = seat.DrawnTier;
                seat.Hands[0].Done = seat.Decided = true;
            }
            Publish();
        }
    }

    protected override bool Play(Seat seat, ActionRequest request)
    {
        if (request.Action == "bet")
        {
            if (phase != Phase.Betting || request.Prize is null || request.Chips is not (>= 1 and <= MaxChips)) return false;
            seat.Prize = request.Prize;
            seat.Chips = request.Chips.Value;
            MarkReady(seat);
            return true;
        }
        if (!CanAct(seat)) return false;
        var hand = seat.Hands[seat.Active];
        switch (request.Action)
        {
            case "hit":
                hand.Cards.Add(Cards.BlackjackHit(seat.DrawnTier, hand.Cards));
                hand.Done = Cards.HandTotal(hand.Cards).Total >= 21;
                break;
            case "stand":
                hand.Done = true;
                break;
            // Doubling puts a second stack beside the first and takes one card only.
            case "double" when hand.Cards.Count == 2:
                hand.Stacks = 2;
                hand.Cards.Add(Cards.BlackjackHit(seat.DrawnTier, hand.Cards));
                hand.Done = true;
                break;
            // Splitting makes two hands of the pair, each with a second card; split aces take one card each.
            case "split" when seat.Hands.Count == 1 && Cards.CanSplit(hand.Cards):
                var aces = hand.Cards[0].Rank == 14;
                seat.Hands = [.. hand.Cards.Select(card => new Hand { Cards = [card] })];
                foreach (var splitHand in seat.Hands)
                {
                    splitHand.Cards.Add(Cards.BlackjackHit(seat.DrawnTier, splitHand.Cards));
                    splitHand.Done = aces || Cards.HandTotal(splitHand.Cards).Total == 21;
                }
                break;
            default:
                return false;
        }
        var open = seat.Hands.FindIndex(openHand => !openHand.Done);
        if (open < 0) seat.Decided = true;
        else seat.Active = open;
        return true;
    }

    protected override void Expire(Seat seat)
    {
        foreach (var hand in seat.Hands) hand.Done = true;
        seat.Decided = true;
    }

    protected override async Task DealerTurn(Seat[] playing)
    {
        Card? drawn;
        lock (gate)
        {
            var standingTotals = playing
                .Where(seat => seat.Result is null)
                .Select(seat => (seat.DrawnTier, Best: seat.Hands.Select(hand => Cards.HandTotal(hand.Cards).Total).Where(total => total <= 21).DefaultIfEmpty(0).Max()))
                .Where(standing => standing.Best > 0)
                .ToArray();
            if (standingTotals.Length == 0)
            {
                dealerShown = int.MaxValue;
                Publish();
                return;
            }
            drawn = Cards.BlackjackDealer(
                dealer,
                [.. standingTotals.Where(standing => standing.DrawnTier == Tier.Small).Select(standing => standing.Best)],
                [.. standingTotals.Where(standing => standing.DrawnTier == Tier.None).Select(standing => standing.Best)]);
        }
        await Wait(0.5);
        lock (gate)
        {
            dealerShown = int.MaxValue;
            Publish();
        }
        if (drawn is { } card)
        {
            await Wait(1.4);
            lock (gate)
            {
                dealer.Add(card);
                Publish();
            }
        }
        await Wait(1);
    }

    protected override void Settle(Seat seat)
    {
        seat.Result = Cards.BlackjackResult(seat.Hands.Select(hand => hand.Cards), dealer);
        seat.Tier = seat.Result is Result.Win or Result.DealerBust ? seat.DrawnTier : Tier.None;
    }
}
