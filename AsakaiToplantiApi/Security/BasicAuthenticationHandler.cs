using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Npgsql;

namespace AsakaiToplantiApi.Security;

public class BasicAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly IConfiguration _cfg;

    public BasicAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration cfg)
        : base(options, logger, encoder)
    {
        _cfg = cfg;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var authHeaderValues))
            return Task.FromResult(AuthenticateResult.Fail("Authorization header yok."));

        var authHeader = authHeaderValues.ToString();
        if (!authHeader.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
            return Task.FromResult(AuthenticateResult.Fail("Authorization Basic formatinda olmali."));

        string decoded;
        try
        {
            var token = authHeader["Basic ".Length..].Trim();
            var credentialBytes = Convert.FromBase64String(token);
            decoded = Encoding.UTF8.GetString(credentialBytes);
        }
        catch
        {
            return Task.FromResult(AuthenticateResult.Fail("Basic token cozumlenemedi."));
        }

        var split = decoded.Split(':', 2);
        if (split.Length != 2 || string.IsNullOrWhiteSpace(split[0]) || string.IsNullOrWhiteSpace(split[1]))
            return Task.FromResult(AuthenticateResult.Fail("Kullanici adi/sifre gecersiz."));

        var kullaniciAdi = split[0];
        var sifre = split[1];

        using var c = new NpgsqlConnection(_cfg.GetConnectionString("Default"));
        c.Open();

        using var cmd = new NpgsqlCommand(@"
            SELECT KullaniciId, KullaniciAdi
            FROM dbo.Kullanicilar
            WHERE KullaniciAdi = @KullaniciAdi
              AND Sifre = @Sifre
              AND IsAktif = TRUE", c);
        cmd.Parameters.AddWithValue("@KullaniciAdi", kullaniciAdi);
        cmd.Parameters.AddWithValue("@Sifre", sifre);

        using var rd = cmd.ExecuteReader();
        if (!rd.Read())
            return Task.FromResult(AuthenticateResult.Fail("Kullanici adi veya sifre hatali."));

        var kullaniciId = rd.GetInt32(0).ToString();
        var claimName = rd.GetString(1);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, kullaniciId),
            new Claim(ClaimTypes.Name, claimName)
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
