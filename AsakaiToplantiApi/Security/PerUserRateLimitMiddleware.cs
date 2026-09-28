using System.Security.Claims;

namespace AsakaiToplantiApi.Security;

public sealed class PerUserRateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly PerUserRateLimitStore _store;

    public PerUserRateLimitMiddleware(RequestDelegate next, PerUserRateLimitStore store)
    {
        _next = next;
        _store = store;
    }

    public async Task Invoke(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var key = RateLimitKey(context);
        if (!_store.TryAcquire(key, out var retryAfter))
        {
            var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers.RetryAfter = seconds.ToString();
            await context.Response.WriteAsJsonAsync(new
            {
                message = $"Dakikada en fazla {PerUserRateLimitStore.LimitPerMinute} istek yapilabilir. {seconds} saniye sonra tekrar deneyin."
            });
            return;
        }

        await _next(context);
    }

    private static string RateLimitKey(HttpContext context)
    {
        var name = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity.Name
            : context.User.FindFirst(ClaimTypes.Name)?.Value;

        if (!string.IsNullOrWhiteSpace(name))
            return "user:" + name.Trim();

        return "ip:" + ClientIp(context);
    }

    private static string ClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
            return forwarded.Split(',')[0].Trim();

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
