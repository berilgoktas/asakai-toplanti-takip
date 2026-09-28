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

    public readonly record struct FailureResult(int Failures, int RemainingAttempts, TimeSpan? LockDuration);

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

    public FailureResult RegisterFailure(string kullaniciAdi)
    {
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0)
            return new FailureResult(0, MaxFailuresBeforeLock, null);

        var entry = _entries.GetOrAdd(key, _ => new Entry());
        lock (entry)
        {
            entry.Failures++;
            var remainingAttempts = Math.Max(0, MaxFailuresBeforeLock - entry.Failures);
            if (entry.Failures < MaxFailuresBeforeLock)
                return new FailureResult(entry.Failures, remainingAttempts, null);

            var exponent = entry.Failures - MaxFailuresBeforeLock;
            var minutes = Math.Min(Math.Pow(2, exponent), MaxLock.TotalMinutes);
            var duration = TimeSpan.FromMinutes(minutes);
            if (duration < BaseLock)
                duration = BaseLock;

            entry.LockUntil = DateTimeOffset.UtcNow + duration;
            return new FailureResult(entry.Failures, 0, duration);
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
