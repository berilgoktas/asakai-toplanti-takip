using Microsoft.AspNetCore.Mvc;
using Npgsql;
using AsakaiToplantiApi.Security;

namespace AsakaiToplantiApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _cfg;
    private readonly LoginLockoutStore _lockout;
    public AuthController(IConfiguration cfg, LoginLockoutStore lockout)
    {
        _cfg = cfg;
        _lockout = lockout;
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto body)
    {
        if (string.IsNullOrWhiteSpace(body.KullaniciAdi) || string.IsNullOrWhiteSpace(body.Sifre))
            return BadRequest(new { message = "Kullanici adi ve sifre zorunlu." });

        if (_lockout.IsLocked(body.KullaniciAdi, out var remaining))
            return TooMany(remaining);

        using var c = new NpgsqlConnection(_cfg.GetConnectionString("Default"));
        c.Open();

        int kullaniciId;
        string kullaniciAdi;
        string adSoyad;

        using (var cmd = new NpgsqlCommand(@"
            SELECT KullaniciId, KullaniciAdi, COALESCE(AdSoyad, '')
            FROM dbo.Kullanicilar
            WHERE KullaniciAdi = @KullaniciAdi
              AND Sifre = @Sifre
              AND IsAktif = TRUE", c))
        {
            cmd.Parameters.AddWithValue("@KullaniciAdi", body.KullaniciAdi);
            cmd.Parameters.AddWithValue("@Sifre", body.Sifre);
            using var rd = cmd.ExecuteReader();
            if (!rd.Read())
            {
                var lockFor = _lockout.RegisterFailure(body.KullaniciAdi);
                if (lockFor != null)
                    return TooMany(lockFor.Value);
                return Unauthorized(new { message = "Kullanici adi veya sifre hatali." });
            }

            kullaniciId = rd.GetInt32(0);
            kullaniciAdi = rd.GetString(1);
            adSoyad = rd.GetString(2);
        }

        _lockout.Reset(body.KullaniciAdi);
        return Ok(new
        {
            message = "Basic Auth aktif. Authorization header ile devam edin.",
            kullaniciId,
            kullaniciAdi,
            adSoyad
        });
    }

    private ObjectResult TooMany(TimeSpan remaining)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        Response.Headers.RetryAfter = seconds.ToString();
        return StatusCode(StatusCodes.Status429TooManyRequests, new { message = LockoutText.WaitMessage(remaining) });
    }
}
