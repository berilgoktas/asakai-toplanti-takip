# Asakai Toplantı Takip

Günlük Asakai (sabah) toplantılarını dijital olarak yönetmek için yazılmış bir uygulamadır. Departman bazında konuşma sürelerini ölçer, katılım durumunu (geç kaldı / katılmadı) ve notları kaydeder, geçmiş toplantıları listeler ve Excel raporu üretir.

Arayüz **mobil kullanım için** tasarlanmıştır: toplantı genellikle tablette veya telefonda, ayakta / pano başında yürütülür. Native iOS veya Android mağaza uygulaması değildir; tarayıcıda açılan, PWA olarak ana ekrana eklenebilen bir web uygulamasıdır. Masaüstünde de çalışır, asıl hedef küçük ekran ve dokunmatik kullanımdır.

## Ne işe yarar?

Fabrika / ofis Asakai toplantısında her departman sırayla konuşur. Bu uygulama:

- Toplantıyı başlatıp toplam süreyi tutar
- Her departman için ayrı kronometre çalıştırır
- Geç kalma ve katılmama işaretlerini kaydeder
- Departman notları ekler
- Bitince kaydı PostgreSQL veritabanına yazar
- Geçmiş toplantıları sayfalar, düzenler veya siler
- Aylık özet ve Excel dışa aktarma sunar

Giriş yapmadan kullanılmaz. Kimlik doğrulama Basic Auth ile yapılır.

## Ekranlar

| Ekran | Açıklama |
| --- | --- |
| Toplantı | Canlı takip: başlat / durdur, departman süreleri, notlar |
| Geçmiş | Kayıtlı toplantılar, sayfalama, düzenleme ve silme |
| Raporlar | Ay bazında süre, katılım, geç kalma ve not özetleri |

Excel dışa aktarma, seçilen tarih aralığındaki toplantı ve katılımcı detaylarını iki sayfalık bir dosyada üretir.

## Mobil ve PWA

Proje native mobil uygulama olarak yazılmamıştır. Hedef, telefon veya tablette tarayıcıdan (veya ana ekran ikonundan) toplantıyı yönetmektir.

Bunun için **PWA (Progressive Web App)** kullanılmıştır:

- `vite-plugin-pwa` ile Web App Manifest ve service worker üretilir
- Uygulama adı: Toplanti Takip (`standalone` görünüm)
- `main.tsx` içinde service worker `registerSW({ immediate: true })` ile kaydedilir; güncellemeler otomatik alınır
- Viewport `viewport-fit=cover` ve standalone modda safe-area boşlukları (çentik / home indicator) ayarlanır
- Manifest `orientation: portrait-primary` — dikey kullanım önceliklidir
- Telefon/tablette “Ana ekrana ekle” / “Install app” ile tarayıcı çubuğu olmadan uygulama gibi açılır

PWA, statik arayüz dosyalarını önbelleğe alır. Canlı toplantı kaydı, giriş ve raporlar API + veritabanı istediği için **çevrimdışı tam çalışmaz**. Mağaza (App Store / Play Store) paketi yoktur; HTTPS üzerinden (örneğin Cloudflare) yayınlanınca kurulum önerisi görünür.

## Mimari

Tek bir ürün, iki katman:

```
Tarayıcı
   │
   ▼
Frontend (React + Vite)     port 3005
   │  /api/...
   ▼
Nginx (yalnızca Docker içinde)
   │
   ▼
API (.NET 8)                port 3004
   │
   ▼
PostgreSQL
```

- **Yerel geliştirme:** Vite `3005`, API `3004`. Frontend API adresini `.env` içindeki `VITE_API_BASE_URL` ile bilir.
- **Docker:** Aynı konteynerde hem API hem arayüz çalışır. Kullanıcı `3005` açar; Nginx `/api` isteklerini içerideki `3004` portuna iletir. Bu yüzden dışarıdan tek giriş noktası `3005` yeterlidir.

## Klasörler

```
.
├── AsakaiToplantiFront/   React arayüz
├── AsakaiToplantiApi/     .NET 8 Web API
├── docker/                Nginx ayarı ve konteyner başlangıç scripti
├── Dockerfile             Tek imaj (frontend + API)
├── docker-compose.yml
├── .env.example           Örnek ortam değişkenleri (şifre yok)
└── .env                   Gerçek ayarlar (git'e girmez)
```

## Gereksinimler

**Yerel çalıştırma**

- Node.js 20+
- .NET 8 SDK
- PostgreSQL

**Sunucu / Docker**

- Docker ve Docker Compose
- Dışarıdaki bir PostgreSQL (konteyner kendi veritabanını ayağa kaldırmaz)

## Ortam değişkenleri

Repoda `.env` yoktur. Klonladıktan sonra:

```bash
cp .env.example .env
```

Windows:

```powershell
copy .env.example .env
```

`.env` içine kendi değerlerinizi yazın:

| Değişken | Açıklama |
| --- | --- |
| `POSTGRES_HOST` | PostgreSQL sunucu adresi |
| `POSTGRES_PORT` | PostgreSQL portu |
| `POSTGRES_DB` | Veritabanı adı |
| `POSTGRES_USER` | Veritabanı kullanıcısı |
| `POSTGRES_PASSWORD` | Veritabanı şifresi |
| `VITE_API_BASE_URL` | Yerel geliştirmede API adresi (`http://localhost:3004`) |

`.env` dosyasını asla commit etmeyin. Şifre, token, gerçek sunucu adresi buraya yazılır.

Docker imajı derlenirken arayüz, API adresini boş bırakır. Canlıda tarayıcı aynı origin üzerinden `/api` çağırır; `VITE_API_BASE_URL` runtime'da kullanılmaz.

## Veritabanı

API PostgreSQL bekler. Sema `dbo` altındadır. Tablolar:

| Tablo | İçerik |
| --- | --- |
| `Kullanicilar` | Giriş hesapları |
| `Departmanlar` | Toplantı satırları (sıralı liste) |
| `Toplantilar` | Toplantı özeti (tarih, saat, toplam süre) |
| `ToplantiKatilimcilari` | Departman süreleri, geç/katılmadı, notlar |

İlk kurulumda en az bir aktif kullanıcı ve departman kayıtları olmadan uygulama boş kalır.

Örnek kullanıcı (kendi şifrenizi yazın):

```sql
INSERT INTO dbo.Kullanicilar (KullaniciAdi, Sifre, AdSoyad, IsAktif)
VALUES ('admin', 'KENDI_SIFRENIZ', 'Yönetici', TRUE);
```

PostgreSQL'de tırnak kullanmadan da çalışır; tanımlayıcılar küçük harfe katlanır. Departman ekleme örneği:

```sql
INSERT INTO dbo.Departmanlar (DepartmanAdi, Sira) VALUES
('AKSİYON TAKİBİ', 1),
('İSG & İNSAN KAYNAKLARI', 2),
('KALİTE & ÇEVRE', 3);
```

Uygulamadaki varsayılan departman sırası: Aksiyon Takibi, İSG & İnsan Kaynakları, Kalite & Çevre, Satış & Pazarlama, Bakım & Onarım, Planlama, Satın Alma, Talaşlı İmalat, MES, Sevkiyat & Lojistik, Sürekli İyileştirme, Tasarım Merkezi.

Şifreler veritabanında düz metin tutulur ve girişte olduğu gibi karşılaştırılır. Bunu bilin; üretimde güçlü ve yalnızca bu uygulamaya özel bir şifre kullanın.

## Yerel geliştirme

1. `.env` oluşturun ve PostgreSQL bilgilerini doldurun.
2. API:

```bash
cd AsakaiToplantiApi
dotnet run --launch-profile http
```

API: `http://localhost:3004`

3. Frontend (ayrı terminal):

```bash
cd AsakaiToplantiFront
npm install
npm run dev
```

Arayüz: `http://localhost:3005`

Geliştirme ortamında CORS, `http://localhost:3005` origin'ine izin verir. Farklı bir adresten açacaksanız `AsakaiToplantiApi/Program.cs` içindeki CORS listesine o adresi eklemeniz gerekir.

Swagger yalnızca Development profilinde açılır ve Basic Auth ister.

## Docker

Tek konteyner: Nginx + .NET API.

```bash
docker compose up --build -d
```

| Port | Ne |
| --- | --- |
| `3005` | Arayüz (Nginx). Dış erişim için bunu kullanın. |
| `3004` | API. Docker içinde Nginx buraya proxy yapar; dışarı açmak zorunlu değildir. |

Durdurmak:

```bash
docker compose down
```

İmajı sıfırdan derlemek (sunucuda script satır sonu / önbellek sorununda):

```bash
docker compose build --no-cache
docker compose up -d
```

Konteyner `.env` dosyasını `env_file` ile okur. PostgreSQL konteynerin ulaşabileceği bir adreste olmalıdır (`localhost` Docker içinde çoğu zaman host makine değildir; gerekirse host adresi veya `host.docker.internal` kullanın).

Konteyner ayağa kalkmazsa log:

```bash
docker logs asakai-toplanti
```

Windows'ta script'i kaydedip Linux'ta çalıştırırken `exec /start.sh: no such file or directory` görürseniz imajı `--no-cache` ile yeniden derleyin. Dockerfile satır sonlarındaki CR karakterini temizler.

## Cloudflare ile dışarı açmak

Amaç: sunucudaki `3005` portunu kendi alan adınızla HTTPS üzerinden yayınlamak. Token, hesap e-postası veya gerçek domain bu repoda tutulmaz.

### 1) Cloudflare Tunnel (önerilen)

Sunucuyu internete port açmadan bağlamak için.

1. Cloudflare Zero Trust içinde bir Tunnel oluşturun.
2. Sunucuya `cloudflared` kurun ve Cloudflare'in verdiği komutla tüneli bağlayın. Token'ı `.env` veya sunucu secret'ına yazın; GitHub'a koymayın.
3. Public hostname ekleyin, örneğin `asakai.sizin-alanadiniz.com`.
4. Servis adresi: `http://localhost:3005`  
   (Nginx hem HTML hem `/api` verdiği için tüneli `3004`'e bağlamayın.)
5. SSL/TLS modu **Full** veya **Full (strict)** olabilir; tünelde Cloudflare zaten HTTPS sonlandırır, origin HTTP kalabilir.

Örnek `config.yml` iskeleti (değerleri kendiniz doldurun):

```yaml
tunnel: TUNNEL_ID
credentials-file: /path/to/credentials.json

ingress:
  - hostname: asakai.sizin-alanadiniz.com
    service: http://localhost:3005
  - service: http_status:404
```

### 2) DNS + proxy (sunucunun gerçekten public IP'si varsa)

1. Alan adını Cloudflare'e alın.
2. A (veya CNAME) kaydı oluşturun, Proxy (turuncu bulut) açık olsun.
3. Sunucuda 443/80'i bir reverse proxy (Nginx, Caddy) ile `3005`'e yönlendirin.
4. SSL/TLS: **Full** veya **Full (strict)**. Flexible kullanmayın; tarayıcı-Cloudflare arası HTTPS, origin HTTP karışınca sorun çıkar.

### Cloudflare sonrası kontrol listesi

- Tarayıcıda `https://asakai.sizin-alanadiniz.com` açılıyor mu?
- Giriş çalışıyor mu? (`/api/auth/login` aynı host üzerinden gitmeli)
- CORS hatası: Docker + `3005` + tünel senaryosunda olmamalı. API'yi ayrı host/porttan sunuyorsanız `Program.cs` CORS listesine `https://asakai.sizin-alanadiniz.com` ekleyin.
- Mixed content: sayfa HTTPS iken API'yi `http://...` ile çağırmayın.

## API özeti

Taban adres yerel: `http://localhost:3004`  
Docker / Cloudflare: `https://sizin-alanadiniz.com/api/...`

| Metod | Yol | Auth | İş |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Hayır | Kullanıcı adı / şifre kontrolü |
| GET | `/api/departmanlar` | Basic | Departman listesi |
| GET | `/api/toplantilar` | Basic | Toplantı özetleri |
| GET | `/api/toplantilar/{id}` | Basic | Toplantı + katılımcılar |
| POST | `/api/toplantilar` | Basic | Yeni kayıt |
| PUT | `/api/toplantilar/{id}` | Basic | Güncelleme |
| DELETE | `/api/toplantilar/{id}` | Basic | Silme |

Login JSON gövdesi: `kullaniciAdi`, `sifre`. Sonraki isteklerde `Authorization: Basic ...` header'ı gerekir.

## Güvenlik notları

- `.env`, veritabanı şifresi, Cloudflare tunnel token ve gerçek sunucu adresleri git'e girmez.
- Public repoda `appsettings.json` bağlantı dizesi boştur; değerler ortam değişkeninden gelir.
- Uygulama şifreleri hash'lemez. Yalnızca güvenilen ağ / VPN / Cloudflare Access arkasında kullanın.
- Gerekirse Cloudflare Access ile ek oturum katmanı koyabilirsiniz; bu projenin kendi login ekranının yerini otomatik almaz.

## Lisans / kullanım

Şirket içi Asakai takip aracı olarak yazılmıştır. Klonlayan kişi kendi veritabanını, kullanıcılarını ve yayın adresini kendisi tanımlar.
