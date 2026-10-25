namespace FeelingLucky;

internal static class Dealer
{
    // While a dealer stands at the tables, their games win this many times as often.
    public const int Boost = 2;

    const int ShiftCount = 3;
    const int Opening = 10 * 60;
    const int ShiftSpan = 260;

    // The same shifts everywhere on a local calendar day, from an FNV-1a hash of the date: three of 30 to 90 minutes
    // from local midnight, between 10:00 and 23:00, one in each third of that span.
    public static (int Start, int End)[] Shifts(DateOnly date)
    {
        var hash = 0x811c9dc5u;
        foreach (var character in $"{date.Year}-{date.Month}-{date.Day}:dealer") hash = (hash ^ character) * 0x01000193u;
        return [.. Enumerable.Range(0, ShiftCount).Select(index =>
        {
            var start = Opening + index * ShiftSpan + (int)((hash >> (index * 8)) % 140);
            return (start, start + 30 + (int)((hash >> (index * 5 + 3)) % 61));
        })];
    }

    public static int? ShiftAt(DateTime local)
    {
        var minute = local.Hour * 60 + local.Minute;
        var shift = Array.FindIndex(Shifts(DateOnly.FromDateTime(local)), shift => shift.Start <= minute && minute < shift.End);
        return shift < 0 ? null : shift;
    }
}
