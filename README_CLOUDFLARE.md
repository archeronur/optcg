# Cloudflare Pages Deployment Guide

## 🚀 Cloudflare Pages'e Deploy Etme

### 1. GitHub'a Push Edin

```bash
# Git repository oluşturun (eğer yoksa)
git init
git add .
git commit -m "Initial commit"

# GitHub'da yeni repository oluşturun, sonra:
git remote add origin https://github.com/KULLANICI_ADI/REPO_ADI.git
git branch -M main
git push -u origin main
```

### 2. Cloudflare Pages'e Bağlayın

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages** → **Create a project**
2. **Connect to Git** → GitHub hesabınızı bağlayın
3. Repository'nizi seçin
4. Build ayarlarını yapın:

#### Build Settings:
- **Framework preset**: `None` (veya boş bırakın)
- **Build command**: `npm run pages:build`
- **Build output directory**: `.vercel/output/static`
- **Root directory**: `/` (root)
- **Node.js version**: `20.x` veya `22.x` (latest recommended)

#### ÖNEMLİ Build Ayarları:
- Mutlaka `npm run pages:build` kullanın (normal `npm run build` çalışmaz)
- Build output directory: `.vercel/output/static` olmalı
- Node.js versiyonu 20+ olmalı

#### Environment Variables (gerekirse):
- **NEXT_PUBLIC_SITE_URL**: (önerilir) Prod domain’iniz. Absolute URL üretimi ve bazı edge/preview senaryolarında tutarlılık için kullanılır.
  - Örnek: `NEXT_PUBLIC_SITE_URL=https://PROJE-ADI.pages.dev`

### 3. Build Komutları

Cloudflare Pages için Next.js projelerinde `@cloudflare/next-on-pages` paketi kullanılmalıdır. Manuel ayarlar:

- **Build command**: `npm run pages:build`
- **Build output directory**: `.vercel/output/static`

**ÖNEMLİ**: Normal `npm run build` komutu Cloudflare Pages için çalışmaz. Mutlaka `npm run pages:build` kullanın!

### 4. Deploy

Cloudflare Pages otomatik olarak:
- Her `git push` sonrası deploy eder
- Preview deployment'lar oluşturur
- Production URL verir: `https://PROJE-ADI.pages.dev`

## 📝 Notlar

- ✅ API Routes Edge Runtime'da çalışıyor
- ✅ Static export gerekmiyor (Next.js 16 Cloudflare Pages'i destekliyor)
- ✅ Images unoptimized (Cloudflare CDN kullanıyor)
- ✅ CORS headers otomatik ekleniyor

## 🔧 Sorun Giderme

### Build Hatası Alırsanız:
1. Node.js versiyonunu kontrol edin (18+ gerekli)
2. `package.json`'daki dependencies'leri kontrol edin
3. Cloudflare Pages logs'larına bakın

### API Route Çalışmıyorsa:
- Edge Runtime kullanıldığından emin olun (`export const runtime = 'edge'`)
- Cloudflare Pages Functions limitlerini kontrol edin
- API route'ların `/api/` klasöründe olduğundan emin olun
- CORS header'larının doğru ayarlandığını kontrol edin

### PDF Görsel Yükleme Sorunları:

**SORUN**: Localhost'ta PDF görselleri çalışıyor ama Cloudflare Pages prod'da "Görsel yüklenemedi" hatası alıyorsunuz.

**KÖK NEDEN**: 
- Prod'da görsel URL'leri relative olabilir ve absolute URL'e çevrilmemiş olabilir
- Proxy API route'una yapılan istekler yanlış origin ile yapılıyor olabilir
- CORS veya network hataları görsellerin yüklenmesini engelliyor olabilir

**ÇÖZÜM** (Uygulandı):
1. ✅ Tüm görsel URL'leri `toAbsoluteUrl()` ile normalize ediliyor
2. ✅ Proxy URL'leri her zaman absolute olarak oluşturuluyor
3. ✅ `getSiteOrigin()` browser'da `window.location.origin` kullanıyor (prod domain'i otomatik algılıyor)
4. ✅ Fallback mekanizması: Proxy başarısız olursa direct fetch deneniyor
5. ✅ Error handling ve logging güçlendirildi

**KONTROL ADIMLARI**:
- Image proxy API route'unun çalıştığını kontrol edin: `/api/image-proxy`
- Browser console'da network hatalarını kontrol edin (404, CORS, timeout)
- Cloudflare Pages logs'larında API route hatalarını kontrol edin
- Timeout sürelerinin yeterli olduğundan emin olun (30 saniye)
- **Önemli**: Edge runtime'da `User-Agent`, `Referer`, `Accept-Encoding` gibi header'lar **yasaktır**; proxy route bunları set ederse prod'da görsel fetch'leri başarısız olur

**ENV VARIABLE** (Opsiyonel ama önerilir):
- `NEXT_PUBLIC_SITE_URL`: Prod domain'inizi set edin (örn: `https://PROJE-ADI.pages.dev`)
- Bu değişken SSR/build-time fallback için kullanılır, ama browser'da `window.location.origin` her zaman önceliklidir

### Mobil Görünüm Sorunları:
- `is-mobile` class'ının doğru eklendiğini kontrol edin
- CSS media queries'in çalıştığını kontrol edin
- Viewport meta tag'lerinin doğru olduğunu kontrol edin

## 🎉 Başarılı Deploy Sonrası

Site otomatik olarak:
- HTTPS ile çalışır
- Global CDN'den servis edilir
- Her commit'te otomatik deploy olur
