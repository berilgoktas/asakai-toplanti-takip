namespace AsakaiToplantiApi.Security;

internal static class LockoutText
{
    public static string AttemptsMessage(int remainingAttempts)
    {
        return $"Kullanıcı adı veya şifre hatalı. Kalan deneme hakkı: {remainingAttempts}";
    }

    public static string WaitMessage(TimeSpan remaining)
    {
        return $"Giriş kilitlendi. Tekrar denemek için {FormatDuration(remaining)} bekleyin.";
    }

    public static string FormatDuration(TimeSpan remaining)
    {
        var totalSeconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        var minutes = totalSeconds / 60;
        var seconds = totalSeconds % 60;
        if (minutes <= 0)
            return $"{seconds} saniye";
        if (seconds == 0)
            return $"{minutes} dakika";
        return $"{minutes} dakika {seconds} saniye";
    }
}
