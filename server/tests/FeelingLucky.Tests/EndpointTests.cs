using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FeelingLucky;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace FeelingLucky.Tests;

public class EndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    record Joined(int Seat, string Token);

    static async Task<JsonElement> ViewWhere(StreamReader stream, Func<JsonElement, bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        for (;;)
        {
            var line = await stream.ReadLineAsync(timeout.Token) ?? throw new EndOfStreamException();
            if (!line.StartsWith("data: ")) continue;
            var view = JsonDocument.Parse(line["data: ".Length..]).RootElement;
            if (condition(view)) return view;
        }
    }

    static string Phase(JsonElement view) => view.GetProperty("phase").GetString()!;

    static HttpRequestMessage Request(HttpMethod method, string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body) };
        request.Headers.Add("X-Seat-Token", token);
        return request;
    }

    [Fact]
    public async Task A_spectator_sees_two_players_take_their_seats_play_a_blackjack_round_and_a_full_table_refuse_a_third()
    {
        using var client = factory.WithWebHostBuilder(host => host.ConfigureServices(services => services.Configure<FeelingLuckyOptions>(options =>
        {
            options.Seats = 2;
            options.Pace = TimeSpan.FromMilliseconds(20);
            options.BettingTime = TimeSpan.FromSeconds(5);
            options.ActionTime = TimeSpan.FromSeconds(5);
        }))).CreateClient();

        var spectating = await client.GetAsync("/feeling-lucky/blackjack", HttpCompletionOption.ResponseHeadersRead);
        using var spectator = new StreamReader(await spectating.Content.ReadAsStreamAsync());
        Assert.Equal(JsonValueKind.Null, (await ViewWhere(spectator, _ => true)).GetProperty("you").ValueKind);

        List<Joined> players = [];
        foreach (var (name, seat) in new[] { ("Ada", (int?)1), ("Bob", null) })
        {
            var joined = await client.PostAsJsonAsync("/feeling-lucky/blackjack/seats", new { name, seat });
            Assert.Equal(HttpStatusCode.OK, joined.StatusCode);
            players.Add((await joined.Content.ReadFromJsonAsync<Joined>())!);
        }
        Assert.Equal([1, 0], players.Select(player => player.Seat));
        Assert.All(players, player => Assert.Matches("^[0-9a-f]{32}$", player.Token));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/feeling-lucky/blackjack/seats", new { name = "Cy" })).StatusCode);

        var streams = new List<StreamReader>();
        foreach (var player in players)
        {
            var response = await client.SendAsync(Request(HttpMethod.Get, "/feeling-lucky/blackjack", player.Token), HttpCompletionOption.ResponseHeadersRead);
            Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
            streams.Add(new StreamReader(await response.Content.ReadAsStreamAsync()));
        }
        for (var index = 0; index < players.Count; index++)
        {
            var first = await ViewWhere(streams[index], _ => true);
            Assert.Equal("betting", Phase(first));
            Assert.Equal(players[index].Seat, first.GetProperty("you").GetInt32());
        }

        foreach (var player in players)
        {
            var bet = await client.SendAsync(Request(HttpMethod.Post, "/feeling-lucky/blackjack/actions", player.Token, new { action = "bet", prize = "mug", chips = 2 }));
            Assert.Equal(HttpStatusCode.NoContent, bet.StatusCode);
        }

        var done = await Task.WhenAll(players.Select(async (player, index) =>
        {
            var view = await ViewWhere(streams[index], view => Phase(view) is "acting" or "done");
            if (Phase(view) == "done") return view;
            Assert.Equal(JsonValueKind.Null, view.GetProperty("dealer")[1].ValueKind);
            var stand = await client.SendAsync(Request(HttpMethod.Post, "/feeling-lucky/blackjack/actions", player.Token, new { action = "stand" }));
            Assert.Contains(stand.StatusCode, new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict });
            return await ViewWhere(streams[index], view => Phase(view) == "done");
        }));

        foreach (var view in done)
        {
            Assert.Equal(1, view.GetProperty("round").GetInt32());
            foreach (var seat in view.GetProperty("seats").EnumerateArray())
            {
                Assert.True(seat.GetProperty("playing").GetBoolean());
                Assert.Equal(JsonValueKind.String, seat.GetProperty("result").ValueKind);
                Assert.Equal(JsonValueKind.String, seat.GetProperty("tier").ValueKind);
            }
        }

        foreach (var player in players)
            Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(Request(HttpMethod.Delete, "/feeling-lucky/blackjack/seats", player.Token))).StatusCode);
        foreach (var stream in streams) stream.Dispose();
    }
}
