namespace AsakaiToplantiApi.Security;

internal static class LockoutText
{
    public static string WaitMessage(TimeSpan remaining)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        if (seconds < 60)
            return $"Cok fazla hatali giris. {seconds} saniye sonra tekrar deneyin.";

        var minutes = Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes));
        return $"Cok fazla hatali giris. {minutes} dakika sonra tekrar deneyin.";
    }
}
