using Microsoft.Extensions.Options;

namespace FeelingLucky;

internal class HoldemTable(IOptions<FeelingLuckyOptions> options) : Table("holdem", options)
{
    protected override (Card[][] Hands, Card[] Dealer) Stage(Tier[] tiers)
    {
        var deal = Cards.HoldemDeal(tiers);
        board.AddRange(deal.Board);
        return (deal.Players, deal.Dealer);
    }

    protected override Task Opened(Seat[] playing) => Turn(3);

    protected override bool Play(Seat seat, ActionRequest request)
    {
        switch (request.Action)
        {
            case "deal" when phase == Phase.Betting:
                MarkReady(seat);
                return true;
            case "call" when CanAct(seat):
                seat.Hands[0].Done = seat.Decided = true;
                return true;
            case "fold" when CanAct(seat):
                Expire(seat);
                return true;
            default:
                return false;
        }
    }

    protected override void Expire(Seat seat)
    {
        seat.Folded = true;
        seat.Hands[0].Done = seat.Decided = true;
    }

    protected override async Task DealerTurn(Seat[] playing)
    {
        await Turn(2);
        await Wait(1.4);
        lock (gate)
        {
            dealerShown = int.MaxValue;
            Publish();
        }
    }

    protected override void Settle(Seat seat) =>
        (seat.Result, seat.Tier) = seat.Folded ? (Result.Folded, Tier.None) : Cards.HoldemResult(seat.Hands[0].Cards, dealer, board);

    // Hole cards show to their owner, and to everyone at the showdown unless folded.
    protected override bool Shows(int index, Seat seat, int you) => index == you || (dealerShown > 0 && !seat.Folded);

    async Task Turn(int count)
    {
        for (var turned = 0; turned < count; turned++)
        {
            await Wait(1.2);
            lock (gate)
            {
                boardShown++;
                Publish();
            }
        }
    }
}
