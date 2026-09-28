-- =====================================================
-- AsakaiToplantiDB Veritabani Kurulum Script'i
-- Hedef: SSMS / SQL Server 2016+
-- Collation: Turkish_CI_AS
-- =====================================================

USE master;
GO

IF DB_ID(N'AsakaiToplantiDB') IS NULL
BEGIN
    CREATE DATABASE AsakaiToplantiDB
    COLLATE Turkish_CI_AS;
END
GO

USE AsakaiToplantiDB;
GO

-- =====================================================
-- 1) Kullanicilar
-- =====================================================
IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Kullanicilar
    (
        KullaniciId      INT             IDENTITY(1,1) NOT NULL,
        KullaniciAdi     NVARCHAR(50)    NOT NULL,
        Sifre            NVARCHAR(100)   NOT NULL,
        AdSoyad          NVARCHAR(100)   NULL,
        IsAktif          BIT             NOT NULL CONSTRAINT DF_Kullanicilar_IsAktif DEFAULT (1),
        OlusturmaTarihi  DATETIME2(0)    NOT NULL CONSTRAINT DF_Kullanicilar_OlusturmaTarihi DEFAULT (SYSDATETIME()),
        SonGirisTarihi   DATETIME2(0)    NULL,
        CONSTRAINT PK_Kullanicilar PRIMARY KEY CLUSTERED (KullaniciId),
        CONSTRAINT UQ_Kullanicilar_KullaniciAdi UNIQUE (KullaniciAdi)
    );
END
GO

-- =====================================================
-- 2) Departmanlar  (sabit liste, App.tsx defaultParticipants ile birebir)
-- =====================================================
IF OBJECT_ID(N'dbo.Departmanlar', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departmanlar
    (
        DepartmanId   INT             IDENTITY(1,1) NOT NULL,
        DepartmanAdi  NVARCHAR(100)   NOT NULL,
        Sira          INT             NOT NULL,
        CONSTRAINT PK_Departmanlar PRIMARY KEY CLUSTERED (DepartmanId),
        CONSTRAINT UQ_Departmanlar_DepartmanAdi UNIQUE (DepartmanAdi)
    );
END
GO

-- =====================================================
-- 3) Toplantilar
-- =====================================================
IF OBJECT_ID(N'dbo.Toplantilar', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Toplantilar
    (
        ToplantiId            INT          IDENTITY(1,1) NOT NULL,
        ToplantiTarihi        DATE         NOT NULL,
        BaslangicSaati        TIME(0)      NOT NULL,
        BitisSaati            TIME(0)      NOT NULL,
        ToplamSureSn          INT          NOT NULL CONSTRAINT DF_Toplantilar_ToplamSureSn DEFAULT (0),
        OlusturanKullaniciId  INT          NULL,
        OlusturmaTarihi       DATETIME2(0) NOT NULL CONSTRAINT DF_Toplantilar_OlusturmaTarihi DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_Toplantilar PRIMARY KEY CLUSTERED (ToplantiId),
        CONSTRAINT FK_Toplantilar_Kullanicilar FOREIGN KEY (OlusturanKullaniciId)
            REFERENCES dbo.Kullanicilar (KullaniciId)
    );
END
GO

-- =====================================================
-- 4) ToplantiKatilimcilari  (Toplanti <-> Departman, ek alanlarla)
--    Notlar: kullanici tercihine gore tek kolonda satir sonu (CHAR(13)+CHAR(10)) ile birlestirilmis
-- =====================================================
IF OBJECT_ID(N'dbo.ToplantiKatilimcilari', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ToplantiKatilimcilari
    (
        ToplantiKatilimciId  INT             IDENTITY(1,1) NOT NULL,
        ToplantiId           INT             NOT NULL,
        DepartmanId          INT             NOT NULL,
        KonusmaSuresiSn      INT             NOT NULL CONSTRAINT DF_ToplantiKatilimcilari_KonusmaSuresiSn DEFAULT (0),
        GecGeldi             BIT             NOT NULL CONSTRAINT DF_ToplantiKatilimcilari_GecGeldi DEFAULT (0),
        Katilmadi            BIT             NOT NULL CONSTRAINT DF_ToplantiKatilimcilari_Katilmadi DEFAULT (0),
        Notlar               NVARCHAR(MAX)   NULL,
        CONSTRAINT PK_ToplantiKatilimcilari PRIMARY KEY CLUSTERED (ToplantiKatilimciId),
        CONSTRAINT FK_ToplantiKatilimcilari_Toplantilar FOREIGN KEY (ToplantiId)
            REFERENCES dbo.Toplantilar (ToplantiId) ON DELETE CASCADE,
        CONSTRAINT FK_ToplantiKatilimcilari_Departmanlar FOREIGN KEY (DepartmanId)
            REFERENCES dbo.Departmanlar (DepartmanId),
        CONSTRAINT UQ_ToplantiKatilimcilari_ToplantiDept UNIQUE (ToplantiId, DepartmanId),
        CONSTRAINT CK_ToplantiKatilimcilari_Durum CHECK (NOT (GecGeldi = 1 AND Katilmadi = 1))
    );
END
GO

-- =====================================================
-- Index'ler
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Toplantilar_ToplantiTarihi' AND object_id = OBJECT_ID(N'dbo.Toplantilar'))
    CREATE INDEX IX_Toplantilar_ToplantiTarihi ON dbo.Toplantilar (ToplantiTarihi DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ToplantiKatilimcilari_ToplantiId' AND object_id = OBJECT_ID(N'dbo.ToplantiKatilimcilari'))
    CREATE INDEX IX_ToplantiKatilimcilari_ToplantiId ON dbo.ToplantiKatilimcilari (ToplantiId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ToplantiKatilimcilari_DepartmanId' AND object_id = OBJECT_ID(N'dbo.ToplantiKatilimcilari'))
    CREATE INDEX IX_ToplantiKatilimcilari_DepartmanId ON dbo.ToplantiKatilimcilari (DepartmanId);
GO

-- =====================================================
-- Seed: Departmanlar (sabit 12 kayit)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Departmanlar)
BEGIN
    INSERT INTO dbo.Departmanlar (DepartmanAdi, Sira) VALUES
    (N'AKSİYON TAKİBİ',           1),
    (N'İSG & İNSAN KAYNAKLARI',   2),
    (N'KALİTE & ÇEVRE',           3),
    (N'SATIŞ & PAZARLAMA',        4),
    (N'BAKIM & ONARIM',           5),
    (N'PLANLAMA',                 6),
    (N'SATIN ALMA',               7),
    (N'TALAŞLI İMALAT',           8),
    (N'KALIPLI İMALAT',           9),
    (N'SEVKİYAT & LOJİSTİK',     10),
    (N'SÜREKLİ İYİLEŞTİRME',     11),
    (N'TASARIM MERKEZİ',         12);
END
GO

-- =====================================================
-- Seed: Default admin (App.tsx'teki admin/123 ile birebir)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Kullanicilar WHERE KullaniciAdi = N'admin')
BEGIN
    INSERT INTO dbo.Kullanicilar (KullaniciAdi, Sifre, AdSoyad)
    VALUES (N'admin', N'123', N'Sistem Yöneticisi');
END
GO

-- =====================================================
-- Dogrulama
-- =====================================================
SELECT * FROM dbo.Kullanicilar;
SELECT * FROM dbo.Departmanlar ORDER BY Sira;
SELECT * FROM dbo.Toplantilar;
SELECT * FROM dbo.ToplantiKatilimcilari;
GO