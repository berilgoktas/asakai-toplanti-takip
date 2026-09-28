using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace AsakaiToplantiApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _cfg;
    public AuthController(IConfiguration cfg) => _cfg = cfg;

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto body)
    {
        if (string.IsNullOrWhiteSpace(body.KullaniciAdi) || string.IsNullOrWhiteSpace(body.Sifre))
            return BadRequest(new { message = "Kullanici adi ve sifre zorunlu." });

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
                return Unauthorized(new { message = "Kullanici adi veya sifre hatali." });

            kullaniciId = rd.GetInt32(0);
            kullaniciAdi = rd.GetString(1);
            adSoyad = rd.GetString(2);
        }

        return Ok(new
        {
            message = "Basic Auth aktif. Authorization header ile devam edin.",
            kullaniciId,
            kullaniciAdi,
            adSoyad
        });
    }
}
