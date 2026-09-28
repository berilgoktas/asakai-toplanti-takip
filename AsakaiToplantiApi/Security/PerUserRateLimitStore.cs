using System.Collections.Concurrent;

namespace AsakaiToplantiApi.Security;

public sealed class PerUserRateLimitStore
{
    public const int LimitPerMinute = 50;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private readonly ConcurrentDictionary<string, WindowEntry> _entries = new(StringComparer.OrdinalIgnoreCase);

    private sealed class WindowEntry
    {
        public DateTimeOffset StartedAt;
        public int Count;
    }

    public bool TryAcquire(string key, out TimeSpan retryAfter)
    {
        retryAfter = TimeSpan.Zero;
        if (string.IsNullOrWhiteSpace(key))
            key = "unknown";

        var now = DateTimeOffset.UtcNow;
        var entry = _entries.GetOrAdd(key, _ => new WindowEntry { StartedAt = now, Count = 0 });
        lock (entry)
        {
            if (now - entry.StartedAt >= Window)
            {
                entry.StartedAt = now;
                entry.Count = 0;
            }

            if (entry.Count >= LimitPerMinute)
            {
                retryAfter = Window - (now - entry.StartedAt);
                if (retryAfter < TimeSpan.Zero)
                    retryAfter = TimeSpan.Zero;
                return false;
            }

            entry.Count++;
            return true;
        }
    }
}
