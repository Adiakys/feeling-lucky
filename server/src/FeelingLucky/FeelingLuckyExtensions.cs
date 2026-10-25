using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace FeelingLucky;

public static class FeelingLuckyExtensions
{
    public static IServiceCollection AddFeelingLucky(this IServiceCollection services, Action<FeelingLuckyOptions>? configure = null)
    {
        var options = services.AddOptions<FeelingLuckyOptions>();
        if (configure is not null) options.Configure(configure);
        services.AddSingleton<Table, BlackjackTable>();
        services.AddSingleton<Table, HoldemTable>();
        return services;
    }

    public static RouteGroupBuilder MapFeelingLucky(this IEndpointRouteBuilder endpoints)
    {
        var tables = endpoints.ServiceProvider.GetServices<Table>().ToDictionary(table => table.Game);
        var group = endpoints.MapGroup("/feeling-lucky");

        group.MapPost("/{game}/seats", IResult (string game, JoinRequest? request, HttpContext context) =>
        {
            if (!tables.TryGetValue(game, out var table)) return TypedResults.NotFound();
            var user = context.User.Identity is { IsAuthenticated: true, Name: { } signedIn } ? signedIn : null;
            var joined = table.Join(user, request?.Name ?? user, request?.Avatar, request?.Seat);
            return joined is var (seat, token)
                ? TypedResults.Text(JsonSerializer.Serialize(new { seat, token }, Table.Json), "application/json")
                : TypedResults.Conflict();
        });

        group.MapGet("/{game}", IResult (string game, [FromHeader(Name = "X-Seat-Token")] string? token, CancellationToken aborted) =>
            tables.TryGetValue(game, out var table) && table.Watch(token, aborted) is { } views
                ? TypedResults.ServerSentEvents(views)
                : TypedResults.NotFound());

        group.MapPost("/{game}/actions", IResult (string game, [FromHeader(Name = "X-Seat-Token")] string? token, ActionRequest request) =>
            !tables.TryGetValue(game, out var table) ? TypedResults.NotFound()
            : table.Act(token, request) switch
            {
                null => TypedResults.NotFound(),
                true => TypedResults.NoContent(),
                false => TypedResults.Conflict(),
            });

        group.MapDelete("/{game}/seats", IResult (string game, [FromHeader(Name = "X-Seat-Token")] string? token) =>
        {
            if (!tables.TryGetValue(game, out var table)) return TypedResults.NotFound();
            table.Leave(token);
            return TypedResults.NoContent();
        });

        return group;
    }
}

internal record JoinRequest(string? Name, string? Avatar, int? Seat);

internal record ActionRequest(string Action, string? Prize, int? Chips);
