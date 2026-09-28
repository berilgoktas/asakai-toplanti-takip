using System.Collections.Concurrent;

namespace AsakaiToplantiApi.Security;

public sealed class LoginLockoutStore
{
    public const int MaxFailuresBeforeLock = 10;
    private static readonly TimeSpan BaseLock = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan MaxLock = TimeSpan.FromHours(24);

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);

    private sealed class Entry
    {
        public int Failures;
        public DateTimeOffset LockUntil;
    }

    public bool IsLocked(string kullaniciAdi, out TimeSpan remaining)
    {
        remaining = TimeSpan.Zero;
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0 || !_entries.TryGetValue(key, out var entry))
            return false;

        lock (entry)
        {
            var now = DateTimeOffset.UtcNow;
            if (entry.LockUntil <= now)
                return false;

            remaining = entry.LockUntil - now;
            return true;
        }
    }

    public TimeSpan? RegisterFailure(string kullaniciAdi)
    {
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0)
            return null;

        var entry = _entries.GetOrAdd(key, _ => new Entry());
        lock (entry)
        {
            entry.Failures++;
            if (entry.Failures < MaxFailuresBeforeLock)
                return null;

            var exponent = entry.Failures - MaxFailuresBeforeLock;
            var minutes = Math.Min(Math.Pow(2, exponent), MaxLock.TotalMinutes);
            var duration = TimeSpan.FromMinutes(minutes);
            if (duration < BaseLock)
                duration = BaseLock;

            entry.LockUntil = DateTimeOffset.UtcNow + duration;
            return duration;
        }
    }

    public void Reset(string kullaniciAdi)
    {
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0)
            return;
        _entries.TryRemove(key, out _);
    }

    private static string Normalize(string? kullaniciAdi) =>
        string.IsNullOrWhiteSpace(kullaniciAdi) ? "" : kullaniciAdi.Trim();
}
