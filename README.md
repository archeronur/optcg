# One Piece TCG Tools

One Piece Trading Card Game için Event Tracker ve Proxy Print araçları.

## Özellikler

### Event Tracker
- Egman Events verilerinden event sonuçları ve analiz
- OP01-OP15 arası tüm setler
- Lider istatistikleri ve sıralama
- Deck listleri ve kart analizleri
- Core/Flex kart analizi

### Proxy Print
- Profesyonel proxy kart baskı aracı
- PDF oluşturma ve indirme
- Çoklu giriş formatı (metin, URL, CSV)
- Grid düzenleri ve baskı ayarları

## Kurulum

```bash
npm install
npm run dev
```

http://localhost:3000 adresinde açılır.

### `Cannot find module './586.js'` (veya benzeri chunk hatası)

Eski `.next` önbelleği ile yeni kod uyumsuz kaldığında oluşur. Çözüm:

```bash
npm run clean && npm run dev
# veya tek seferde production build:
npm run build:clean
```

### Deploy / `next build` “Failed to compile” (ESLint)

Production build sırasında ESLint hataları siteyi düşürebilir. Bu repoda `next.config.js` içinde `eslint.ignoreDuringBuilds: true` kullanılıyor; kalite için yerelde `npm run lint` çalıştırın.

## Teknolojiler

- Next.js 15, React 18, TypeScript
- Tailwind CSS v4
- pdf-lib (PDF oluşturma)
- Veri kaynağı: egmanevents.com

## Çok Dilli Destek

- İngilizce (varsayılan)
- Türkçe

## Yasal Uyarı

Bu site meta değil, Egman Events verilerinden derlenen event analizlerini içermektedir.
Tüm kart görselleri Eiichiro Oda, Bandai, Shonen Jump ve Viz Media'ya aittir.
