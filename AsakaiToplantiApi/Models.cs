namespace AsakaiToplantiApi;

public record LoginDto(string KullaniciAdi, string Sifre);
public record LoginResponseDto(string Token, string KullaniciAdi, string AdSoyad);

public record DepartmanDto(int DepartmanId, string DepartmanAdi, int Sira);

public record KatilimciDto(
    int DepartmanId,
    string DepartmanAdi,
    int KonusmaSuresiSn,
    bool GecGeldi,
    bool Katilmadi,
    List<string> Notlar
);

public record KatilimciKaydetDto(
    int DepartmanId,
    int KonusmaSuresiSn,
    bool GecGeldi,
    bool Katilmadi,
    List<string>? Notlar
);

public record ToplantiOzetDto(
    int ToplantiId,
    DateTime ToplantiTarihi,
    TimeSpan BaslangicSaati,
    TimeSpan BitisSaati,
    int ToplamSureSn
);

public record ToplantiDetayDto(
    int ToplantiId,
    DateTime ToplantiTarihi,
    TimeSpan BaslangicSaati,
    TimeSpan BitisSaati,
    int ToplamSureSn,
    List<KatilimciDto> Katilimcilar
);

public record ToplantiKaydetDto(
    DateTime ToplantiTarihi,
    TimeSpan BaslangicSaati,
    TimeSpan BitisSaati,
    int ToplamSureSn,
    List<KatilimciKaydetDto> Katilimcilar
);
