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
- **Node.js version**: `22.x` (or latest)

#### Environment Variables (gerekirse):
- Şu an için environment variable gerekmiyor

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

## 🎉 Başarılı Deploy Sonrası

Site otomatik olarak:
- HTTPS ile çalışır
- Global CDN'den servis edilir
- Her commit'te otomatik deploy olur
