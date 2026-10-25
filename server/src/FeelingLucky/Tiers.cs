namespace FeelingLucky;

internal enum Tier { None, Small, Big, Jackpot }

internal static class Tiers
{
    const double JackpotOdds = 1.0 / 150, BigOdds = 1.0 / 60, SmallOdds = 1.0 / 30;

    // boost multiplies every odd: a game wins that many times as often.
    public static Tier DrawTier(int boost)
    {
        var roll = Random.Shared.NextDouble();
        if (roll < boost * JackpotOdds) return Tier.Jackpot;
        if (roll < boost * (JackpotOdds + BigOdds)) return Tier.Big;
        if (roll < boost * (JackpotOdds + BigOdds + SmallOdds)) return Tier.Small;
        return Tier.None;
    }
}
