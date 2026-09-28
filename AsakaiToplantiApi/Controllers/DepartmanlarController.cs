using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace AsakaiToplantiApi.Controllers;

[ApiController]
[Authorize]
[Route("api/departmanlar")]
public class DepartmanlarController : ControllerBase
{
    private readonly IConfiguration _cfg;
    public DepartmanlarController(IConfiguration cfg) => _cfg = cfg;

    [HttpGet]
    public IActionResult Get()
    {
        var list = new List<DepartmanDto>();
        using var c = new NpgsqlConnection(_cfg.GetConnectionString("Default"));
        c.Open();
        using var cmd = new NpgsqlCommand(
            "SELECT DepartmanId, DepartmanAdi, Sira FROM dbo.Departmanlar ORDER BY Sira", c);
        using var rd = cmd.ExecuteReader();
        while (rd.Read())
            list.Add(new DepartmanDto(rd.GetInt32(0), rd.GetString(1), rd.GetInt32(2)));
        return Ok(list);
    }
}
