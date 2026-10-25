namespace FeelingLucky;

internal enum Suit { Spades, Hearts, Diamonds, Clubs }

// rank 2 to 10, then 11 jack, 12 queen, 13 king, 14 ace.
internal readonly record struct Card(int Rank, Suit Suit);

internal enum Result { Bust, Lose, Win, DealerBust, Natural, Spades, Won, Lost, Split, Folded }

internal static class Cards
{
    public static readonly Suit[] Suits = Enum.GetValues<Suit>();
    public static readonly Card[] Deck = [.. Suits.SelectMany(suit => Enumerable.Range(2, 13).Select(rank => new Card(rank, suit)))];

    static readonly int[] TenRanks = [10, 11, 12, 13];
    const int HoldemTries = 20_000;

    static int RandomInt(int min, int max) => Random.Shared.Next(min, max + 1);
    static T Pick<T>(IReadOnlyList<T> items) => items[Random.Shared.Next(items.Count)];

    static T[] Shuffle<T>(IEnumerable<T> items)
    {
        T[] shuffled = [.. items];
        Random.Shared.Shuffle(shuffled);
        return shuffled;
    }

    static Card RandomSuit(int rank) => new(rank, Pick(Suits));

    /* Blackjack: the tier is drawn at the deal and the shoe stages it, whatever the player then does. */

    // A card worth that much: 1 and 11 are the ace.
    static Card CardWorth(int value) => value is 1 or 11 ? RandomSuit(14) : value == 10 ? RandomSuit(Pick(TenRanks)) : RandomSuit(value);

    static int CardValue(Card card) => card.Rank == 14 ? 11 : Math.Min(10, card.Rank);

    public static (int Total, bool Soft) HandTotal(IReadOnlyList<Card> cards)
    {
        var total = cards.Sum(CardValue);
        var aces = cards.Count(card => card.Rank == 14);
        while (total > 21 && aces > 0)
        {
            total -= 10;
            aces--;
        }
        return (total, aces > 0);
    }

    public static bool IsNatural(IReadOnlyList<Card> cards) => cards.Count == 2 && HandTotal(cards).Total == 21;

    // Two cards of the same value split into two hands.
    public static bool CanSplit(IReadOnlyList<Card> cards) => cards.Count == 2 && CardValue(cards[0]) == CardValue(cards[1]);

    public static bool IsSpadesJack(IReadOnlyList<Card> cards) =>
        cards.All(card => card.Suit == Suit.Spades) && cards.Any(card => card.Rank == 14) && cards.Any(card => card.Rank == 11);

    // The dealer always opens on a hard 12 to 16, so one more card lands wherever the tiers need it.
    public static (Card[][] Players, Card[] Dealer) BlackjackDeal(IReadOnlyList<Tier> tiers)
    {
        var opening = RandomInt(12, 16);
        var up = RandomInt(Math.Max(2, opening - 10), Math.Min(10, opening - 2));
        Card[] dealer = [CardWorth(up), CardWorth(opening - up)];
        var players = tiers.Select(tier =>
        {
            if (tier == Tier.Jackpot) return Shuffle([new Card(14, Suit.Spades), new Card(11, Suit.Spades)]);
            Card[] player;
            do player = tier == Tier.Big ? Shuffle([RandomSuit(14), RandomSuit(Pick(TenRanks))]) : [RandomSuit(RandomInt(2, 14)), RandomSuit(RandomInt(2, 14))];
            while (tier == Tier.Big ? IsSpadesJack(player) : IsNatural(player));
            return player;
        });
        return ([.. players], dealer);
    }

    // The card a hit draws: a winning hand never busts, a losing one never makes 21.
    public static Card BlackjackHit(Tier tier, IReadOnlyList<Card> player) =>
        Pick(Deck.Where(next =>
        {
            var total = HandTotal([.. player, next]).Total;
            return tier == Tier.None ? total != 21 : total <= 21;
        }).ToArray());

    // The card the dealer draws once everyone stands, from the best standing total of each small winner and of each
    // loser, or none when no hand stands. Losers must lose, so when no total fits between them and the lowest
    // winner the winners at or below it lose too.
    public static Card? BlackjackDealer(IReadOnlyList<Card> dealer, IReadOnlyList<int> winners, IReadOnlyList<int> losers)
    {
        if (winners.Count == 0 && losers.Count == 0) return null;
        var total = HandTotal(dealer).Total;
        var lowestWinner = winners.Count == 0 ? 22 : winners.Min();
        if (losers.Count == 0)
            return lowestWinner >= 18 && Random.Shared.NextDouble() < 0.5
                ? CardWorth(RandomInt(17, lowestWinner - 1) - total)
                : CardWorth(RandomInt(22 - total, 10));
        var lowest = Math.Max(17, losers.Max() + 1);
        var highest = Math.Min(21, lowestWinner - 1);
        return CardWorth((lowest <= highest ? RandomInt(lowest, highest) : lowest) - total);
    }

    // A hand wins when the dealer busts or stops below it.
    public static Result BlackjackResult(IEnumerable<IReadOnlyList<Card>> hands, IReadOnlyList<Card> dealer)
    {
        var dealerTotal = HandTotal(dealer).Total;
        var handTotals = hands.Select(hand => HandTotal(hand).Total).ToArray();
        if (handTotals.All(total => total > 21)) return Result.Bust;
        if (!handTotals.Any(total => total <= 21 && (dealerTotal > 21 || dealerTotal < total))) return Result.Lose;
        return dealerTotal > 21 ? Result.DealerBust : Result.Win;
    }

    /* Texas Hold'em against the dealer: the deal is chosen among those that give the drawn tiers. */

    // A hand's strength as one comparable number: the category, then up to five ranks, four bits each.
    public static int Category(int hand) => hand >> 20;

    static int EvaluateFive(ReadOnlySpan<Card> cards)
    {
        Span<int> counts = stackalloc int[15];
        foreach (var card in cards) counts[card.Rank]++;
        Span<int> ranks = stackalloc int[5];
        Span<int> shape = stackalloc int[5];
        var groups = 0;
        for (var count = 4; count > 0; count--)
            for (var rank = 14; rank >= 2; rank--)
                if (counts[rank] == count)
                {
                    ranks[groups] = rank;
                    shape[groups++] = count;
                }
        var flush = true;
        foreach (var card in cards) flush &= card.Suit == cards[0].Suit;
        var high = groups == 5 ? (ranks[0] - ranks[4] == 4 ? ranks[0] : ranks[0] == 14 && ranks[1] == 5 ? 5 : 0) : 0;
        var category =
            high > 0 && flush ? (high == 14 ? 9 : 8)
            : shape[0] == 4 ? 7
            : shape[0] == 3 && shape[1] == 2 ? 6
            : flush ? 5
            : high > 0 ? 4
            : shape[0] == 3 ? 3
            : shape[0] == 2 && shape[1] == 2 ? 2
            : shape[0] == 2 ? 1
            : 0;
        var hand = category;
        for (var index = 0; index < 5; index++) hand = hand << 4 | (high > 0 ? (index == 0 ? high : 0) : ranks[index]);
        return hand;
    }

    public static int BestHand(ReadOnlySpan<Card> cards)
    {
        Span<Card> five = stackalloc Card[5];
        var best = -1;
        for (var a = 0; a < cards.Length; a++)
            for (var b = a + 1; b < cards.Length; b++)
            {
                var used = 0;
                for (var index = 0; index < cards.Length; index++)
                    if (index != a && index != b) five[used++] = cards[index];
                best = Math.Max(best, EvaluateFive(five));
            }
        return best;
    }

    // Winning with up to three of a kind pays a small prize, from a straight up a big prize, the royal flush the jackpot.
    public static Tier HoldemTier(int player, int dealer) =>
        player <= dealer ? Tier.None : Category(player) == 9 ? Tier.Jackpot : Category(player) >= 4 ? Tier.Big : Tier.Small;

    // Deals until every player gets their tier, a loss for none. A jackpot player gets a royal flush, two cards in
    // hand and three on the board. A set that does not come out in time, like two jackpots, has its highest tier
    // lowered by one step.
    public static (Card[][] Players, Card[] Dealer, Card[] Board, Tier[] Tiers) HoldemDeal(IReadOnlyList<Tier> wanted)
    {
        Tier[] tiers = [.. wanted];
        for (;;)
        {
            var jackpot = Array.IndexOf(tiers, Tier.Jackpot);
            for (var attempt = 0; attempt < HoldemTries; attempt++)
            {
                Card[] royal = [];
                if (jackpot >= 0)
                {
                    var suit = Pick(Suits);
                    royal = Shuffle(Enumerable.Range(10, 5).Select(rank => new Card(rank, suit)));
                }
                var deck = Shuffle(Deck.Except(royal));
                var players = new Card[tiers.Length][];
                var dealt = 0;
                for (var index = 0; index < tiers.Length; index++)
                {
                    if (index == jackpot) continue;
                    players[index] = deck[dealt..(dealt + 2)];
                    dealt += 2;
                }
                if (jackpot >= 0) players[jackpot] = royal[..2];
                var dealer = deck[dealt..(dealt + 2)];
                var board = jackpot >= 0 ? Shuffle([.. royal[2..], .. deck[(dealt + 2)..(dealt + 4)]]) : deck[(dealt + 2)..(dealt + 7)];
                var dealerHand = BestHand([.. dealer, .. board]);
                var matched = true;
                for (var index = 0; index < tiers.Length && matched; index++)
                {
                    var playerHand = BestHand([.. players[index], .. board]);
                    matched = tiers[index] == Tier.None ? playerHand < dealerHand : HoldemTier(playerHand, dealerHand) == tiers[index];
                }
                if (matched) return (players, dealer, board, tiers);
            }
            tiers[Array.IndexOf(tiers, tiers.Max())]--;
        }
    }

    public static (Result Result, Tier Tier) HoldemResult(IReadOnlyList<Card> player, IReadOnlyList<Card> dealer, IReadOnlyList<Card> board)
    {
        var playerHand = BestHand([.. player, .. board]);
        var dealerHand = BestHand([.. dealer, .. board]);
        var tier = HoldemTier(playerHand, dealerHand);
        return tier != Tier.None ? (Result.Won, tier) : playerHand < dealerHand ? (Result.Lost, Tier.None) : (Result.Split, Tier.None);
    }
}
