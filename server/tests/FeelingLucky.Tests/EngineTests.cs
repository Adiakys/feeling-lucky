using FeelingLucky;

namespace FeelingLucky.Tests;

public class EngineTests
{
    static readonly Dictionary<char, Suit> SuitLetters = new() { ['s'] = Suit.Spades, ['h'] = Suit.Hearts, ['d'] = Suit.Diamonds, ['c'] = Suit.Clubs };

    static Card[] Parse(string cards) =>
        [.. cards.Split(' ').Select(card => new Card("23456789TJQKA".IndexOf(card[0]) + 2, SuitLetters[card[1]]))];

    static Tier RandomTier(params double[] weights)
    {
        var roll = Random.Shared.NextDouble() * weights.Sum();
        for (var tier = 0; tier < weights.Length; tier++)
            if ((roll -= weights[tier]) < 0) return (Tier)tier;
        return Tier.None;
    }

    [Theory]
    [InlineData("As Kh", 21, true)]
    [InlineData("As Ah 9c", 21, true)]
    [InlineData("Ks Qh 5c", 25, false)]
    [InlineData("Ad 6s Tc", 17, false)]
    public void Hand_totals_count_aces_as_one_or_eleven(string cards, int total, bool soft) =>
        Assert.Equal((total, soft), Cards.HandTotal(Parse(cards)));

    [Theory]
    [InlineData("Ts Js Qs Ks As 2h 3d", 9)]
    [InlineData("9h Th Jh Qh Kh 2c 2d", 8)]
    [InlineData("7s 7h 7d 7c 2h 3d 9s", 7)]
    [InlineData("7s 7h 7d 2c 2h 3d 9s", 6)]
    [InlineData("2h 5h 9h Jh Kh 3d 4s", 5)]
    [InlineData("As 2h 3d 4c 5s 9h Jd", 4)]
    [InlineData("7s 7h 7d 2c 4h 9d Js", 3)]
    [InlineData("7s 7h 2d 2c 4h 9d Js", 2)]
    [InlineData("7s 7h 2d 3c 4h 9d Js", 1)]
    [InlineData("7s 8h 2d 3c 4h 9d Js", 0)]
    public void Poker_hands_get_their_category(string cards, int category) =>
        Assert.Equal(category, Cards.Category(Cards.BestHand(Parse(cards))));

    [Fact]
    public void Poker_hands_compare_by_category_then_ranks()
    {
        Assert.True(Cards.BestHand(Parse("As 2h 3d 4c 5s Kh Kd")) < Cards.BestHand(Parse("2s 3h 4d 5c 6s Kh Kd")));
        Assert.True(Cards.BestHand(Parse("Ks Kh Qd Qc 9s 2h 3d")) > Cards.BestHand(Parse("Ks Kh Qd Qc 8s 2h 3d")));
        Assert.True(Cards.BestHand(Parse("2s 2h 2d 3c 3s 9h Jd")) > Cards.BestHand(Parse("As Ks 9s 5s 3s 4h 2d")));
        Assert.Equal(Cards.BestHand(Parse("Ts Js Qh Kc Ad 2h 3h")), Cards.BestHand(Parse("Th Jh Qs Kd Ac 2s 3s")));
    }

    [Fact]
    public void Dealer_shifts_match_the_typescript_ones()
    {
        Assert.Equal([(650, 691), (945, 992), (1254, 1284)], Dealer.Shifts(new DateOnly(2026, 10, 25)));
        Assert.Equal([(679, 711), (980, 1019), (1129, 1203)], Dealer.Shifts(new DateOnly(2027, 1, 1)));
        Assert.Equal(0, Dealer.ShiftAt(new DateTime(2026, 10, 25, 10, 50, 0)));
        Assert.Null(Dealer.ShiftAt(new DateTime(2026, 10, 25, 11, 31, 0)));
        Assert.Equal(1, Dealer.ShiftAt(new DateTime(2026, 10, 25, 16, 0, 0)));
    }

    [Fact]
    public void Blackjack_staging_gives_every_player_their_tier()
    {
        string[] decisions = ["hit", "stand", "double", "split"];
        for (var round = 0; round < 5000; round++)
        {
            Tier[] tiers = [.. Enumerable.Range(0, Random.Shared.Next(1, 6)).Select(_ => RandomTier(4, 4, 1, 1))];
            var (players, dealer) = Cards.BlackjackDeal(tiers);
            Assert.InRange(Cards.HandTotal(dealer).Total, 12, 16);
            Assert.False(Cards.HandTotal(dealer).Soft);

            var hands = new List<List<Card>>[tiers.Length];
            for (var player = 0; player < tiers.Length; player++)
            {
                hands[player] = [[.. players[player]]];
                if (Cards.IsNatural(players[player])) continue;
                var splitAces = false;
                for (var active = 0; active < hands[player].Count; active++)
                {
                    var hand = hands[player][active];
                    var done = splitAces;
                    while (!done && Cards.HandTotal(hand).Total < 21)
                    {
                        switch (decisions[Random.Shared.Next(decisions.Length)])
                        {
                            case "hit":
                                hand.Add(Cards.BlackjackHit(tiers[player], hand));
                                break;
                            case "double" when hand.Count == 2:
                                hand.Add(Cards.BlackjackHit(tiers[player], hand));
                                done = true;
                                break;
                            case "split" when hands[player].Count == 1 && Cards.CanSplit(hand):
                                splitAces = hand[0].Rank == 14;
                                hands[player] = [[hand[0]], [hand[1]]];
                                foreach (var splitHand in hands[player]) splitHand.Add(Cards.BlackjackHit(tiers[player], splitHand));
                                hand = hands[player][active];
                                done = splitAces;
                                break;
                            case "stand":
                                done = true;
                                break;
                        }
                    }
                }
            }

            int[] bestTotals = [.. hands.Select(playerHands => playerHands.Select(hand => Cards.HandTotal(hand).Total).Where(total => total <= 21).DefaultIfEmpty(0).Max())];
            var standing = Enumerable.Range(0, tiers.Length).Where(player => !Cards.IsNatural(players[player]) && bestTotals[player] > 0).ToArray();
            int[] winners = [.. standing.Where(player => tiers[player] == Tier.Small).Select(player => bestTotals[player])];
            int[] losers = [.. standing.Where(player => tiers[player] == Tier.None).Select(player => bestTotals[player])];
            List<Card> finalDealer = [.. dealer];
            if (Cards.BlackjackDealer(dealer, winners, losers) is { } drawn) finalDealer.Add(drawn);
            var dealerTotal = Cards.HandTotal(finalDealer).Total;
            var demotedUpTo = losers.Length > 0 && Math.Max(17, losers.Max() + 1) > Math.Min(21, winners.DefaultIfEmpty(22).Min() - 1) ? dealerTotal : 0;

            for (var player = 0; player < tiers.Length; player++)
            {
                var result = Cards.BlackjackResult(hands[player], finalDealer);
                switch (tiers[player])
                {
                    case Tier.Jackpot:
                        Assert.True(Cards.IsNatural(players[player]) && Cards.IsSpadesJack(players[player]));
                        break;
                    case Tier.Big:
                        Assert.True(Cards.IsNatural(players[player]) && !Cards.IsSpadesJack(players[player]));
                        break;
                    case Tier.Small when result == Result.Lose:
                        Assert.True(bestTotals[player] <= demotedUpTo, $"small {bestTotals[player]} lost to {dealerTotal}");
                        break;
                    case Tier.Small:
                        Assert.Contains(result, new[] { Result.Win, Result.DealerBust });
                        break;
                    case Tier.None:
                        Assert.False(Cards.IsNatural(players[player]));
                        Assert.Contains(result, new[] { Result.Bust, Result.Lose });
                        break;
                }
            }
        }
    }

    [Fact]
    public void Holdem_search_gives_every_player_their_tier()
    {
        for (var round = 0; round < 300; round++)
        {
            Tier[] wanted = [.. Enumerable.Range(0, Random.Shared.Next(1, 6)).Select(_ => RandomTier(10, 5, 4, 1))];
            var (players, dealer, board, tiers) = Cards.HoldemDeal(wanted);
            Assert.Equal(2 * players.Length + 7, players.SelectMany(cards => cards).Concat(dealer).Concat(board).Distinct().Count());
            for (var player = 0; player < players.Length; player++)
            {
                Assert.True(tiers[player] <= wanted[player]);
                var (result, tier) = Cards.HoldemResult(players[player], dealer, board);
                Assert.Equal(tiers[player], tier);
                Assert.Equal(tiers[player] == Tier.None ? Result.Lost : Result.Won, result);
            }
            if (wanted.Count(tier => tier == Tier.Jackpot) < 2)
                Assert.Equal(wanted.Count(tier => tier == Tier.Jackpot), tiers.Count(tier => tier == Tier.Jackpot));
        }
    }
}
