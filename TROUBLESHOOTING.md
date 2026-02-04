# 🔧 Sorun Giderme Rehberi

## Frontend Çalışmıyor Sorunu

### 1. Sunucuyu Başlatma

Terminal'de şu komutları çalıştırın:

```bash
cd "/Users/onur/Documents/onur/Kod/OP kopyası"

# Önce çalışan tüm Next.js süreçlerini durdurun
pkill -f "next dev"

# .next cache'ini temizleyin
rm -rf .next

# node_modules'ü temizleyip yeniden yükleyin (opsiyonel)
# rm -rf node_modules
# npm install

# Sunucuyu başlatın
npm run dev
```

### 2. Port Kontrolü

Eğer port 3000 kullanılıyorsa:

```bash
# Port 3000'i kullanan süreci bulun
lsof -ti:3000

# Süreci durdurun
kill -9 $(lsof -ti:3000)
```

Alternatif port kullanmak için:

```bash
PORT=3001 npm run dev
```

### 3. Tarayıcıda Kontrol

1. Tarayıcıyı açın: `http://localhost:3000`
2. Developer Console'u açın (F12 veya Cmd+Option+I)
3. Console sekmesinde hataları kontrol edin
4. Network sekmesinde istekleri kontrol edin

### 4. Yaygın Hatalar ve Çözümleri

#### "Cannot find module" hatası
```bash
rm -rf node_modules .next
npm install
npm run dev
```

#### "Port already in use" hatası
```bash
kill -9 $(lsof -ti:3000)
npm run dev
```

#### "Module not found" hatası
- `tsconfig.json` dosyasındaki path mapping'i kontrol edin
- `@/*` path'inin doğru olduğundan emin olun

### 5. Build Hatalarını Kontrol Etme

```bash
npm run build
```

Build başarılı olursa, dev sunucusu da çalışmalı.

### 6. Logları İnceleme

Sunucu loglarında şu hataları arayın:
- Import/export hataları
- TypeScript hataları
- Module resolution hataları

### 7. Manuel Test

Basit bir test sayfası oluşturun:

`src/app/test/page.tsx`:
```tsx
export default function Test() {
  return <div>Test works!</div>;
}
```

Sonra `http://localhost:3000/test` adresine gidin.

## Destek

Sorun devam ederse:
1. Terminal'deki tam hata mesajını kaydedin
2. Tarayıcı console'daki hataları kaydedin
3. `npm run build` çıktısını kontrol edin
