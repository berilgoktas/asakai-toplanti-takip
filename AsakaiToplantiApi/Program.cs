using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi.Models;
using AsakaiToplantiApi.Security;

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);
ApplyPostgresConnection(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Asakai Toplanti API", Version = "v1" });
    c.AddSecurityDefinition("Basic", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "basic",
        In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Basic" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("ViteFrontend", policy =>
        policy.WithOrigins(
                "http://localhost:3005",
                "http://127.0.0.1:3005",
                "http://10.0.0.4:3030")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddAuthentication("Basic")
    .AddScheme<AuthenticationSchemeOptions, BasicAuthenticationHandler>("Basic", null);

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseWhen(
        ctx => ctx.Request.Path.StartsWithSegments("/swagger"),
        branch =>
        {
            branch.Use(async (context, next) =>
            {
                var authResult = await context.AuthenticateAsync("Basic");
                if (!authResult.Succeeded)
                {
                    context.Response.Headers.Append("WWW-Authenticate", "Basic realm=\"Swagger\"");
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsync("Swagger icin kimlik dogrulama gerekli.");
                    return;
                }

                await next();
            });
        });

    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ViteFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static void LoadDotEnv()
{
    var candidates = new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), ".env"),
        Path.Combine(Directory.GetCurrentDirectory(), "..", ".env"),
    };

    foreach (var candidate in candidates)
    {
        var path = Path.GetFullPath(candidate);
        if (!File.Exists(path)) continue;

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line[0] == '#') continue;

            var eq = line.IndexOf('=');
            if (eq <= 0) continue;

            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
            {
                value = value[1..^1];
            }

            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                Environment.SetEnvironmentVariable(key, value);
        }

        return;
    }
}

static void ApplyPostgresConnection(IConfigurationManager cfg)
{
    var host = cfg["POSTGRES_HOST"];
    if (string.IsNullOrWhiteSpace(host)) return;

    var port = cfg["POSTGRES_PORT"] ?? "5432";
    var db = cfg["POSTGRES_DB"] ?? "AsakaiToplantiDB";
    var user = cfg["POSTGRES_USER"] ?? "admin";
    var password = cfg["POSTGRES_PASSWORD"] ?? "";
    cfg["ConnectionStrings:Default"] =
        $"Host={host};Port={port};Database={db};Username={user};Password={password}";
}
