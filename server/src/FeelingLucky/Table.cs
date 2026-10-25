using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace FeelingLucky;

internal enum Phase { Betting, Dealing, Acting, Dealer, Done }

internal class Hand
{
    public List<Card> Cards { get; init; } = [];
    public int Stacks { get; set; } = 1;
    public bool Done { get; set; }
}

internal class Seat
{
    public required string Token { get; init; }
    public string? User { get; init; }
    public string? Name { get; init; }
    public string? Avatar { get; init; }
    public List<Channel<string>> Streams { get; } = [];
    public int StreamCloses { get; set; }
    public bool Leaving { get; set; }
    public bool Ready { get; set; }
    public bool Playing { get; set; }
    public string? Prize { get; set; }
    public int Chips { get; set; }
    public Tier DrawnTier { get; set; }
    public List<Hand> Hands { get; set; } = [];
    public int Active { get; set; }
    public bool Folded { get; set; }
    public bool Decided { get; set; }
    public Result? Result { get; set; }
    public Tier? Tier { get; set; }
}

internal record TableView(string Game, int Round, Phase Phase, long? Deadline, int Boost, int? You, Card?[] Dealer, Card?[] Board, SeatView?[] Seats);

internal record SeatView(string? Name, string? Avatar, bool Ready, bool Playing, string? Prize, int Chips, HandView[] Hands, int Active, bool Folded, bool Decided, Result? Result, Tier? Tier);

internal record HandView(Card?[] Cards, int Stacks, bool Done);

// One table per game: everyone seated plays against the same dealer. Actions and the round loop change the state
// under the gate; the loop waits outside it, for the pace or for an action to wake it.
internal abstract class Table(string game, IOptions<FeelingLuckyOptions> configured)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) } };

    static readonly TimeSpan Grace = TimeSpan.FromSeconds(15);

    protected readonly Lock gate = new();
    protected readonly List<Card> dealer = [];
    protected readonly List<Card> board = [];
    protected Phase phase;
    protected int dealerShown;
    protected int boardShown;

    readonly FeelingLuckyOptions options = configured.Value;
    readonly Seat?[] seats = new Seat?[configured.Value.Seats];
    readonly TimeZoneInfo timeZone = configured.Value.TimeZone is { } zone ? TimeZoneInfo.FindSystemTimeZoneById(zone) : TimeZoneInfo.Local;
    readonly SemaphoreSlim wake = new(0);
    readonly List<Channel<string>> spectators = [];
    int round;
    long? deadline;
    int boost = 1;
    int? shift;
    bool running;

    public string Game => game;

    static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    DateTime LocalNow => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime;

    // The chosen seat, or the first free one; a signed-in user already seated gets their seat back.
    public (int Seat, string Token)? Join(string? user, string? name, string? avatar, int? chosen)
    {
        lock (gate)
        {
            if (user is not null && seats.FirstOrDefault(seat => seat?.User == user) is { } taken) return (Array.IndexOf(seats, taken), taken.Token);
            var free = chosen ?? Array.IndexOf(seats, null);
            if (free < 0 || free >= seats.Length || seats[free] is not null) return null;
            var seat = seats[free] = new Seat { Token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16)), User = user, Name = name, Avatar = avatar };
            LeaveUnlessWatched(seat);
            if (!running)
            {
                running = true;
                _ = Task.Run(Run);
            }
            Publish();
            return (free, seat.Token);
        }
    }

    // A seat's views, or without a token a spectator's, who sees what no seat hides.
    public IAsyncEnumerable<string>? Watch(string? token, CancellationToken aborted)
    {
        lock (gate)
        {
            var seat = Find(token);
            if (token is not null && seat is null) return null;
            var views = Channel.CreateBounded<string>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropOldest });
            views.Writer.TryWrite(View(seat is null ? -1 : Array.IndexOf(seats, seat)));
            (seat?.Streams ?? spectators).Add(views);
            return Stream(seat, views, aborted);
        }
    }

    public bool? Act(string? token, ActionRequest request)
    {
        lock (gate)
        {
            if (Find(token) is not { } seat) return null;
            if (!Play(seat, request)) return false;
            wake.Release();
            Publish();
            return true;
        }
    }

    public void Leave(string? token)
    {
        lock (gate)
            if (Find(token) is { } seat) Leave(seat);
    }

    // The cards for the playing seats in seat order and for the dealer, staged on their tiers.
    protected abstract (Card[][] Hands, Card[] Dealer) Stage(Tier[] tiers);

    protected abstract Task Opened(Seat[] playing);

    protected abstract bool Play(Seat seat, ActionRequest request);

    // What a seat does when its time runs out or it leaves during the round.
    protected abstract void Expire(Seat seat);

    protected abstract Task DealerTurn(Seat[] playing);

    protected abstract void Settle(Seat seat);

    protected virtual bool Shows(int index, Seat seat, int you) => true;

    protected Task Wait(double paces) => Task.Delay(options.Pace * paces);

    protected bool CanAct(Seat seat) => phase == Phase.Acting && seat.Playing && !seat.Decided;

    protected void MarkReady(Seat seat)
    {
        seat.Ready = true;
        deadline ??= Now + (long)options.BettingTime.TotalMilliseconds;
    }

    protected void Publish()
    {
        shift = Dealer.ShiftAt(LocalNow);
        if (phase == Phase.Betting) boost = shift is null ? 1 : Dealer.Boost;
        for (var index = 0; index < seats.Length; index++)
        {
            if (seats[index] is not { Streams.Count: > 0 } seat) continue;
            var view = View(index);
            foreach (var views in seat.Streams) views.Writer.TryWrite(view);
        }
        if (spectators.Count == 0) return;
        var spectated = View(-1);
        foreach (var views in spectators) views.Writer.TryWrite(spectated);
    }

    async Task Run()
    {
        while (await Betting())
        {
            var playing = await Deal();
            await Opened(playing);
            await Acting(playing);
            await DealerTurn(playing);
            await Done(playing);
        }
    }

    async Task<bool> Betting()
    {
        for (;;)
        {
            TimeSpan wait;
            lock (gate)
            {
                Seat[] seated = [.. seats.OfType<Seat>()];
                if (seated.Length == 0)
                {
                    running = false;
                    return false;
                }
                if (seated.Any(seat => seat.Ready) && (seated.All(seat => seat.Ready) || Now >= deadline)) return true;
                if (Dealer.ShiftAt(LocalNow) != shift) Publish();
                var untilNextMinute = 60_000 - Now % 60_000;
                wait = TimeSpan.FromMilliseconds(Math.Max(0, deadline is { } end ? Math.Min(end - Now, untilNextMinute) : untilNextMinute));
            }
            await wake.WaitAsync(wait);
        }
    }

    async Task<Seat[]> Deal()
    {
        Seat[] playing;
        Card[][] hands;
        Card[] dealerCards;
        lock (gate)
        {
            round++;
            phase = Phase.Dealing;
            deadline = null;
            boost = Dealer.ShiftAt(LocalNow) is null ? 1 : Dealer.Boost;
            foreach (var seat in seats.OfType<Seat>())
            {
                seat.Playing = seat.Ready;
                seat.DrawnTier = seat.Playing ? Tiers.DrawTier(boost) : Tier.None;
                seat.Hands = seat.Playing ? [new Hand()] : [];
            }
            playing = [.. seats.OfType<Seat>().Where(seat => seat.Playing)];
            (hands, dealerCards) = Stage([.. playing.Select(seat => seat.DrawnTier)]);
            Publish();
        }
        for (var pass = 0; pass < 2; pass++)
        {
            for (var index = 0; index < playing.Length; index++)
            {
                await Wait(1);
                lock (gate)
                {
                    playing[index].Hands[0].Cards.Add(hands[index][pass]);
                    Publish();
                }
            }
            await Wait(1);
            lock (gate)
            {
                dealer.Add(dealerCards[pass]);
                Publish();
            }
        }
        return playing;
    }

    async Task Acting(Seat[] playing)
    {
        lock (gate)
        {
            phase = Phase.Acting;
            deadline = Now + (long)options.ActionTime.TotalMilliseconds;
            foreach (var seat in playing.Where(seat => seat.Leaving && !seat.Decided)) Expire(seat);
            Publish();
        }
        for (;;)
        {
            TimeSpan wait;
            lock (gate)
            {
                if (playing.All(seat => seat.Decided)) break;
                if (Now >= deadline)
                {
                    foreach (var seat in playing.Where(seat => !seat.Decided)) Expire(seat);
                    break;
                }
                wait = TimeSpan.FromMilliseconds(deadline!.Value - Now);
            }
            await wake.WaitAsync(wait);
        }
        lock (gate)
        {
            phase = Phase.Dealer;
            deadline = null;
            Publish();
        }
    }

    async Task Done(Seat[] playing)
    {
        lock (gate)
        {
            phase = Phase.Done;
            foreach (var seat in playing.Where(seat => seat.Result is null)) Settle(seat);
            Publish();
        }
        await Wait(8);
        lock (gate)
        {
            for (var index = 0; index < seats.Length; index++)
            {
                if (seats[index] is not { } seat) continue;
                if (seat.Leaving)
                {
                    Remove(index);
                    continue;
                }
                seat.Ready = seat.Playing = seat.Folded = seat.Decided = false;
                seat.Prize = null;
                seat.Chips = 0;
                seat.Hands = [];
                seat.Active = 0;
                seat.Result = null;
                seat.Tier = null;
            }
            dealer.Clear();
            board.Clear();
            dealerShown = boardShown = 0;
            phase = Phase.Betting;
            Publish();
        }
    }

    async IAsyncEnumerable<string> Stream(Seat? seat, Channel<string> views, [EnumeratorCancellation] CancellationToken aborted)
    {
        using var abort = aborted.Register(() => views.Writer.TryComplete());
        try
        {
            await foreach (var view in views.Reader.ReadAllAsync()) yield return view;
        }
        finally
        {
            lock (gate)
            {
                if (seat is null) spectators.Remove(views);
                else
                {
                    seat.Streams.Remove(views);
                    if (seat.Streams.Count == 0) LeaveUnlessWatched(seat);
                }
            }
        }
    }

    void LeaveUnlessWatched(Seat seat)
    {
        var streamCloses = ++seat.StreamCloses;
        _ = Task.Delay(Grace).ContinueWith(_ =>
        {
            lock (gate)
                if (seat.Streams.Count == 0 && seat.StreamCloses == streamCloses) Leave(seat);
        });
    }

    void Leave(Seat seat)
    {
        var index = Array.IndexOf(seats, seat);
        if (index < 0) return;
        if (phase == Phase.Betting)
        {
            Remove(index);
            if (!seats.Any(other => other is { Ready: true })) deadline = null;
        }
        else
        {
            seat.Leaving = true;
            if (CanAct(seat)) Expire(seat);
        }
        wake.Release();
        Publish();
    }

    void Remove(int index)
    {
        foreach (var views in seats[index]!.Streams) views.Writer.TryComplete();
        seats[index] = null;
    }

    Seat? Find(string? token) => seats.FirstOrDefault(seat => seat is not null && seat.Token == token);

    string View(int you) => JsonSerializer.Serialize(new TableView(
        game, round, phase, deadline, boost, you < 0 ? null : you,
        [.. dealer.Select((card, index) => index < dealerShown ? card : (Card?)null)],
        [.. board.Select((card, index) => index < boardShown ? card : (Card?)null)],
        [.. seats.Select((seat, index) => seat is null ? null : new SeatView(
            seat.Name, seat.Avatar, seat.Ready, seat.Playing, seat.Prize, seat.Chips,
            [.. seat.Hands.Select(hand => new HandView([.. hand.Cards.Select(card => Shows(index, seat, you) ? card : (Card?)null)], hand.Stacks, hand.Done))],
            seat.Active, seat.Folded, seat.Decided, seat.Result, seat.Tier))]), Json);
}
