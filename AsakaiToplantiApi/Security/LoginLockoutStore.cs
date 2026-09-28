using System.Collections.Concurrent;
using System.Text.Json;

namespace AsakaiToplantiApi.Security;

public sealed class LoginLockoutStore
{
    public const int MaxFailuresBeforeLock = 10;
    private static readonly TimeSpan BaseLock = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan MaxLock = TimeSpan.FromHours(24);
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _filePath;
    private readonly object _fileLock = new();

    private sealed class Entry
    {
        public int Failures { get; set; }
        public DateTimeOffset LockUntil { get; set; }
    }

    public readonly record struct FailureResult(int Failures, int RemainingAttempts, TimeSpan? LockDuration);

    public LoginLockoutStore(IHostEnvironment env)
    {
        _filePath = Path.Combine(env.ContentRootPath, "login-lockout.json");
        Load();
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

    public FailureResult RegisterFailure(string kullaniciAdi)
    {
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0)
            return new FailureResult(0, MaxFailuresBeforeLock, null);

        var entry = _entries.GetOrAdd(key, _ => new Entry());
        FailureResult result;
        lock (entry)
        {
            entry.Failures++;
            var remainingAttempts = Math.Max(0, MaxFailuresBeforeLock - entry.Failures);
            if (entry.Failures < MaxFailuresBeforeLock)
            {
                result = new FailureResult(entry.Failures, remainingAttempts, null);
            }
            else
            {
                var exponent = entry.Failures - MaxFailuresBeforeLock;
                var minutes = Math.Min(Math.Pow(2, exponent), MaxLock.TotalMinutes);
                var duration = TimeSpan.FromMinutes(minutes);
                if (duration < BaseLock)
                    duration = BaseLock;

                entry.LockUntil = DateTimeOffset.UtcNow + duration;
                result = new FailureResult(entry.Failures, 0, duration);
            }
        }

        Save();
        return result;
    }

    public void Reset(string kullaniciAdi)
    {
        var key = Normalize(kullaniciAdi);
        if (key.Length == 0)
            return;
        if (_entries.TryRemove(key, out _))
            Save();
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_filePath))
                return;
            var json = File.ReadAllText(_filePath);
            var data = JsonSerializer.Deserialize<Dictionary<string, Entry>>(json, JsonOpts);
            if (data == null)
                return;
            foreach (var (name, entry) in data)
            {
                if (string.IsNullOrWhiteSpace(name) || entry == null)
                    continue;
                _entries[name.Trim()] = entry;
            }
        }
        catch
        {
            /* ignore corrupt file */
        }
    }

    private void Save()
    {
        try
        {
            var snapshot = _entries.ToDictionary(
                kv => kv.Key,
                kv => new Entry { Failures = kv.Value.Failures, LockUntil = kv.Value.LockUntil },
                StringComparer.OrdinalIgnoreCase);
            var json = JsonSerializer.Serialize(snapshot);
            lock (_fileLock)
            {
                File.WriteAllText(_filePath, json);
            }
        }
        catch
        {
            /* ignore disk errors */
        }
    }

    private static string Normalize(string? kullaniciAdi) =>
        string.IsNullOrWhiteSpace(kullaniciAdi) ? "" : kullaniciAdi.Trim();
}
