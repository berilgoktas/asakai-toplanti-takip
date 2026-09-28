using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace AsakaiToplantiApi.Controllers;

[ApiController]
[Authorize]
[Route("api/toplantilar")]
public class ToplantilarController : ControllerBase
{
    private readonly IConfiguration _cfg;
    public ToplantilarController(IConfiguration cfg) => _cfg = cfg;

    private NpgsqlConnection Open()
    {
        var c = new NpgsqlConnection(_cfg.GetConnectionString("Default"));
        c.Open();
        return c;
    }

    private int? CurrentUserId()
    {
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
        return int.TryParse(sub, out var id) ? id : null;
    }

    private static List<string> NotlariParcala(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return new List<string>();
        return raw.Split('\n', StringSplitOptions.None)
                  .Select(s => s.TrimEnd('\r'))
                  .Where(s => s.Length > 0)
                  .ToList();
    }

    private static string? NotlariBirlestir(List<string>? notlar)
    {
        if (notlar == null || notlar.Count == 0) return null;
        return string.Join("\n", notlar.Where(n => !string.IsNullOrWhiteSpace(n)));
    }

    private static DateTime ReadDate(NpgsqlDataReader rd, int i)
    {
        var v = rd.GetValue(i);
        return v switch
        {
            DateTime dt => dt,
            DateOnly d => d.ToDateTime(TimeOnly.MinValue),
            _ => Convert.ToDateTime(v)
        };
    }

    private static TimeSpan ReadTime(NpgsqlDataReader rd, int i)
    {
        var v = rd.GetValue(i);
        return v switch
        {
            TimeSpan ts => ts,
            TimeOnly t => t.ToTimeSpan(),
            _ => TimeSpan.Parse(v.ToString()!)
        };
    }

    [HttpGet]
    public IActionResult List()
    {
        using var c = Open();
        var map = new Dictionary<int, ToplantiDetayDto>();
        var order = new List<int>();

        using (var cmd = new NpgsqlCommand(@"
            SELECT ToplantiId, ToplantiTarihi, BaslangicSaati, BitisSaati, ToplamSureSn
            FROM dbo.Toplantilar
            ORDER BY ToplantiTarihi DESC, ToplantiId DESC", c))
        using (var rd = cmd.ExecuteReader())
        {
            while (rd.Read())
            {
                var id = rd.GetInt32(0);
                order.Add(id);
                map[id] = new ToplantiDetayDto(
                    id,
                    ReadDate(rd, 1),
                    ReadTime(rd, 2),
                    ReadTime(rd, 3),
                    rd.GetInt32(4),
                    new List<KatilimciDto>());
            }
        }

        using (var cmd2 = new NpgsqlCommand(@"
            SELECT k.ToplantiId, k.DepartmanId, d.DepartmanAdi, k.KonusmaSuresiSn, k.GecGeldi, k.Katilmadi, k.Notlar
            FROM dbo.ToplantiKatilimcilari k
            INNER JOIN dbo.Departmanlar d ON d.DepartmanId = k.DepartmanId
            ORDER BY d.Sira", c))
        using (var rd2 = cmd2.ExecuteReader())
        {
            while (rd2.Read())
            {
                var toplantiId = rd2.GetInt32(0);
                if (!map.TryGetValue(toplantiId, out var detay))
                    continue;
                detay.Katilimcilar.Add(new KatilimciDto(
                    rd2.GetInt32(1),
                    rd2.GetString(2),
                    rd2.GetInt32(3),
                    rd2.GetBoolean(4),
                    rd2.GetBoolean(5),
                    NotlariParcala(rd2.IsDBNull(6) ? null : rd2.GetString(6))));
            }
        }

        return Ok(order.Select(id => map[id]).ToList());
    }

    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        using var c = Open();

        ToplantiDetayDto? detay = null;
        using (var cmd = new NpgsqlCommand(@"
            SELECT ToplantiId, ToplantiTarihi, BaslangicSaati, BitisSaati, ToplamSureSn
            FROM dbo.Toplantilar WHERE ToplantiId = @Id", c))
        {
            cmd.Parameters.AddWithValue("@Id", id);
            using var rd = cmd.ExecuteReader();
            if (!rd.Read()) return NotFound();
            detay = new ToplantiDetayDto(
                rd.GetInt32(0),
                ReadDate(rd, 1),
                ReadTime(rd, 2),
                ReadTime(rd, 3),
                rd.GetInt32(4),
                new List<KatilimciDto>());
        }

        using (var cmd2 = new NpgsqlCommand(@"
            SELECT k.DepartmanId, d.DepartmanAdi, k.KonusmaSuresiSn, k.GecGeldi, k.Katilmadi, k.Notlar
            FROM dbo.ToplantiKatilimcilari k
            INNER JOIN dbo.Departmanlar d ON d.DepartmanId = k.DepartmanId
            WHERE k.ToplantiId = @Id
            ORDER BY d.Sira", c))
        {
            cmd2.Parameters.AddWithValue("@Id", id);
            using var rd2 = cmd2.ExecuteReader();
            while (rd2.Read())
            {
                detay.Katilimcilar.Add(new KatilimciDto(
                    rd2.GetInt32(0),
                    rd2.GetString(1),
                    rd2.GetInt32(2),
                    rd2.GetBoolean(3),
                    rd2.GetBoolean(4),
                    NotlariParcala(rd2.IsDBNull(5) ? null : rd2.GetString(5))));
            }
        }

        return Ok(detay);
    }

    [HttpPost]
    public IActionResult Create([FromBody] ToplantiKaydetDto body)
    {
        using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            int newId;
            using (var cmd = new NpgsqlCommand(@"
                INSERT INTO dbo.Toplantilar
                    (ToplantiTarihi, BaslangicSaati, BitisSaati, ToplamSureSn, OlusturanKullaniciId)
                VALUES (@ToplantiTarihi, @BaslangicSaati, @BitisSaati, @ToplamSureSn, @KullaniciId)
                RETURNING ToplantiId", c, tx))
            {
                cmd.Parameters.AddWithValue("@ToplantiTarihi", DateOnly.FromDateTime(body.ToplantiTarihi.Date));
                cmd.Parameters.AddWithValue("@BaslangicSaati", TimeOnly.FromTimeSpan(body.BaslangicSaati));
                cmd.Parameters.AddWithValue("@BitisSaati", TimeOnly.FromTimeSpan(body.BitisSaati));
                cmd.Parameters.AddWithValue("@ToplamSureSn", body.ToplamSureSn);
                cmd.Parameters.AddWithValue("@KullaniciId", (object?)CurrentUserId() ?? DBNull.Value);
                newId = Convert.ToInt32(cmd.ExecuteScalar());
            }

            foreach (var k in body.Katilimcilar)
            {
                using var cmd = new NpgsqlCommand(@"
                    INSERT INTO dbo.ToplantiKatilimcilari
                        (ToplantiId, DepartmanId, KonusmaSuresiSn, GecGeldi, Katilmadi, Notlar)
                    VALUES
                        (@ToplantiId, @DepartmanId, @KonusmaSuresiSn, @GecGeldi, @Katilmadi, @Notlar)", c, tx);

                cmd.Parameters.AddWithValue("@ToplantiId", newId);
                cmd.Parameters.AddWithValue("@DepartmanId", k.DepartmanId);
                cmd.Parameters.AddWithValue("@KonusmaSuresiSn", k.KonusmaSuresiSn);
                cmd.Parameters.AddWithValue("@GecGeldi", k.GecGeldi);
                cmd.Parameters.AddWithValue("@Katilmadi", k.Katilmadi);
                cmd.Parameters.AddWithValue("@Notlar", (object?)NotlariBirlestir(k.Notlar) ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }

            tx.Commit();
            return CreatedAtAction(nameof(GetById), new { id = newId }, new { toplantiId = newId });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public IActionResult Update(int id, [FromBody] ToplantiKaydetDto body)
    {
        using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            int affected;
            using (var cmd = new NpgsqlCommand(@"
                UPDATE dbo.Toplantilar
                SET ToplantiTarihi = @ToplantiTarihi,
                    BaslangicSaati = @BaslangicSaati,
                    BitisSaati = @BitisSaati,
                    ToplamSureSn = @ToplamSureSn
                WHERE ToplantiId = @Id", c, tx))
            {
                cmd.Parameters.AddWithValue("@Id", id);
                cmd.Parameters.AddWithValue("@ToplantiTarihi", DateOnly.FromDateTime(body.ToplantiTarihi.Date));
                cmd.Parameters.AddWithValue("@BaslangicSaati", TimeOnly.FromTimeSpan(body.BaslangicSaati));
                cmd.Parameters.AddWithValue("@BitisSaati", TimeOnly.FromTimeSpan(body.BitisSaati));
                cmd.Parameters.AddWithValue("@ToplamSureSn", body.ToplamSureSn);
                affected = cmd.ExecuteNonQuery();
            }

            if (affected == 0)
            {
                tx.Rollback();
                return NotFound();
            }

            using (var del = new NpgsqlCommand(
                "DELETE FROM dbo.ToplantiKatilimcilari WHERE ToplantiId = @Id", c, tx))
            {
                del.Parameters.AddWithValue("@Id", id);
                del.ExecuteNonQuery();
            }

            foreach (var k in body.Katilimcilar)
            {
                using var cmd = new NpgsqlCommand(@"
                    INSERT INTO dbo.ToplantiKatilimcilari
                        (ToplantiId, DepartmanId, KonusmaSuresiSn, GecGeldi, Katilmadi, Notlar)
                    VALUES
                        (@ToplantiId, @DepartmanId, @KonusmaSuresiSn, @GecGeldi, @Katilmadi, @Notlar)", c, tx);
                cmd.Parameters.AddWithValue("@ToplantiId", id);
                cmd.Parameters.AddWithValue("@DepartmanId", k.DepartmanId);
                cmd.Parameters.AddWithValue("@KonusmaSuresiSn", k.KonusmaSuresiSn);
                cmd.Parameters.AddWithValue("@GecGeldi", k.GecGeldi);
                cmd.Parameters.AddWithValue("@Katilmadi", k.Katilmadi);
                cmd.Parameters.AddWithValue("@Notlar", (object?)NotlariBirlestir(k.Notlar) ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }

            tx.Commit();
            return NoContent();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        using var c = Open();
        using var cmd = new NpgsqlCommand("DELETE FROM dbo.Toplantilar WHERE ToplantiId = @Id", c);
        cmd.Parameters.AddWithValue("@Id", id);
        var affected = cmd.ExecuteNonQuery();
        return affected == 0 ? NotFound() : NoContent();
    }
}
