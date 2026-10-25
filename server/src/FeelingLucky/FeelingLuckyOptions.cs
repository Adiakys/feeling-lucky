namespace FeelingLucky;

public class FeelingLuckyOptions
{
    public int Seats { get; set; } = 5;

    public TimeSpan Pace { get; set; } = TimeSpan.FromMilliseconds(480);

    public TimeSpan BettingTime { get; set; } = TimeSpan.FromSeconds(10);

    public TimeSpan ActionTime { get; set; } = TimeSpan.FromSeconds(20);

    // An IANA id; null is the server's local zone.
    public string? TimeZone { get; set; }
}
