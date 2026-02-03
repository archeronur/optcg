# Lorcana Proxy Baskı Sitesi

Disney Lorcana kartları için profesyonel proxy baskı aracı. Bu uygulama ile deck listenizi yükleyip, yüksek kaliteli PDF çıktısı alabilirsiniz.

## 🚀 Özellikler

- **Çoklu Giriş Formatı**: Metin, URL ve CSV desteği
- **Otomatik Kart Çözümleme**: Lorcana API ile kart bilgilerini otomatik bulma
- **Profesyonel Baskı Ayarları**: Bleed, crop marks, güvenlik payı
- **Grid Düzenleri**: 3x3, 3x4, 4x3 sayfa düzenleri
- **Gerçek Zamanlı Önizleme**: Sayfa bazında önizleme
- **Çok Dilli Destek**: Türkçe ve İngilizce
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## 🛠️ Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd lorcana-proxy-print
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Development server'ı başlatın**
```bash
npm run dev
```

4. **Tarayıcıda açın**
```
http://localhost:3000
```

## 📖 Kullanım

### 1. Deck Girişi

#### Metin Girişi
```
4x Stitch - Rock Star (TFC 101)
3x Ariel - Spectacular Singer (ROTF 45)
2x Simba - Future King (UR 12)
1x Elsa - Snow Queen
```

#### URL Girişi
- Dreamborn.ink deck URL'leri
- Lorcana.gg deck URL'leri

#### CSV Yükleme
CSV dosyanız şu sütunları içermelidir:
```csv
Name,Count,Set,Number
Stitch - Rock Star,4,TFC,101
Ariel - Spectacular Singer,3,ROTF,45
```

### 2. Baskı Ayarları

- **Grid Düzeni**: Sayfa başına kart sayısı
- **Bleed**: 3mm kesim payı
- **Crop Marks**: Kesim işaretleri
- **Güvenlik Payı**: 2-10mm arası ayarlanabilir

### 3. PDF İndirme

1. Deck'inizi yükleyin
2. Baskı ayarlarını yapın
3. "PDF İndir" butonuna tıklayın
4. PDF dosyası otomatik indirilecek

## 🎨 Baskı Kalitesi

- **Yüksek Çözünürlük**: 300 DPI baskı kalitesi
- **A4 Format**: Standart kağıt boyutu
- **Profesyonel Düzen**: Baskı için optimize edilmiş layout
- **Bleed Desteği**: Kesim hatalarını önler

## 🔧 Teknik Detaylar

### Teknolojiler
- **Frontend**: Next.js 14, React 18, TypeScript
- **PDF**: pdf-lib kütüphanesi
- **Styling**: CSS3, Responsive Design
- **API**: Lorcana API entegrasyonu

### Mimari
- **App Router**: Next.js 14 App Router
- **API Routes**: Server-side proxy API
- **Service Worker**: Offline desteği
- **Performance**: Debouncing, throttling, memoization

### Dosya Yapısı
```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   └── page.tsx        # Ana sayfa
├── services/           # API servisleri
├── types/              # TypeScript tipleri
└── utils/              # Yardımcı fonksiyonlar
    ├── deckParser.ts   # Deck parsing
    ├── pdfGenerator.ts # PDF oluşturma
    └── translations.ts # Çeviri servisi
```

## 🚀 Production Build

```bash
# Production build
npm run build

# Production server başlat
npm start

# Performance test
npm run perf
```

## 🌐 Deployment

### Firebase Hosting (Önerilen)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Vercel
```bash
npm install -g vercel
vercel
```

## 📱 Responsive Design

- **Desktop**: 2 kolonlu layout
- **Tablet**: Tek kolon, optimize edilmiş spacing
- **Mobile**: Dikey tab navigation, tam genişlik butonlar

## 🔍 Sorun Giderme

### PDF İndirilemiyor
1. İnternet bağlantınızı kontrol edin
2. Tarayıcı popup blocker'ını kapatın
3. Daha az kart ile deneyin

### Kartlar Bulunamıyor
1. Kart adını doğru yazdığınızdan emin olun
2. Set kodunu belirtin (örn: TFC, ROTF)
3. API bağlantısını kontrol edin

### Performans Sorunları
1. Büyük desteler için daha uzun süre bekleyin
2. Tarayıcı cache'ini temizleyin
3. Daha az kart ile test edin

## 📄 Lisans

Bu proje eğitim ve kişisel kullanım amaçlıdır. Ticari kullanım için lisans gerekebilir.

## ⚠️ Yasal Uyarı

- Proxy kartlar resmi turnuvalarda kullanılamaz
- Tüm kart görselleri Disney/Ravensburger'e aittir
- Telif hakkı yasalarına saygı gösterin
- Sadece kişisel kullanım ve pratik amaçlıdır

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📞 Destek

Sorunlarınız için:
- GitHub Issues kullanın
- Detaylı hata mesajları ekleyin
- Tarayıcı ve işletim sistemi bilgisi verin

## 🎯 Roadmap

- [ ] PNG export desteği
- [ ] Daha fazla grid düzeni
- [ ] Kart arkası desteği
- [ ] Batch processing
- [ ] Cloud storage entegrasyonu
- [ ] Sosyal medya paylaşımı

---

**Not**: Bu proje Disney Lorcana ile resmi bir bağlantısı olmayan, topluluk tarafından geliştirilen bir araçtır.
