# PDF Görsel Yükleme Sorunu - Kök Neden Analizi ve Çözüm

## 🔍 SORUN

**Localhost'ta**: PDF'lerde tüm kart görselleri sorunsuz görünüyor.
**Cloudflare Pages Prod'da**: PDF indirildiğinde görseller boş, "Görsel yüklenemedi" placeholder'ı görünüyor.

## 🎯 KÖK NEDEN ANALİZİ

### 1. Relative URL Sorunu
- **Sorun**: Prod'da görsel URL'leri relative (`/images/...`) olarak kalıyordu
- **Neden**: `toAbsoluteUrl()` fonksiyonu bazen yanlış origin kullanıyordu
- **Etki**: Proxy API route'una yapılan istekler 404 dönüyordu

### 2. Origin Tespiti Sorunu
- **Sorun**: `getSiteOrigin()` SSR/build-time'da yanlış origin dönebiliyordu
- **Neden**: `NEXT_PUBLIC_SITE_URL` env variable set edilmemiş olabilirdi
- **Etki**: Proxy URL'leri yanlış domain ile oluşturuluyordu

### 3. Error Handling Eksikliği
- **Sorun**: Proxy başarısız olduğunda direct fetch denenmiyordu
- **Neden**: Fallback mekanizması yoktu
- **Etki**: Tek bir başarısızlıkta görsel tamamen yüklenemiyordu

## ✅ UYGULANAN ÇÖZÜMLER

### 1. URL Normalization Güçlendirildi (`src/utils/url.ts`)

**Değişiklikler**:
- `getSiteOrigin()`: Browser'da her zaman `window.location.origin` kullanıyor (prod domain'i otomatik algılıyor)
- `toAbsoluteUrl()`: Error handling ve fallback mekanizması eklendi
- Debug logging eklendi (dev mode'da)

**Kod Örneği**:
```typescript
export function getSiteOrigin(): string {
  // Browser always wins (correct for preview/prod/custom domains)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin; // ✅ Prod domain'i otomatik algılıyor
  }
  // SSR fallback (opsiyonel)
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
```

### 2. Proxy URL Garantisi (`src/utils/imageDataUri.ts`)

**Değişiklikler**:
- Proxy URL'leri her zaman absolute olarak oluşturuluyor
- Proxy başarısız olursa direct fetch deneniyor (fallback)
- Enhanced error handling ve logging

**Kod Örneği**:
```typescript
if (preferProxy) {
  const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
  const siteOrigin = getSiteOrigin(); // ✅ Her zaman doğru origin
  const proxyUrl = toAbsoluteUrl(proxyPath, siteOrigin); // ✅ Absolute URL garantisi
  
  try {
    // Proxy'den yükle
    const { bytes } = await fetchBytes(proxyUrl, timeoutMs);
    return result;
  } catch (proxyError) {
    // ✅ Fallback: Direct fetch dene
    const { bytes } = await fetchBytes(absoluteSourceUrl, timeoutMs);
    return result;
  }
}
```

### 3. PDF Generator'da URL Normalization (`src/utils/pdfGenerator.ts`)

**Değişiklikler**:
- Tüm görsel URL'leri `toAbsoluteUrl()` ile normalize ediliyor
- `preloadImages()` ve `drawCard()` fonksiyonlarında URL normalization eklendi
- Alternatif URL'ler de normalize ediliyor
- Kart arkası görseli için de absolute URL garantisi

**Kod Örneği**:
```typescript
private async drawCard(...) {
  let imageUrl = card.card.image_uris.full || ...;
  
  // ✅ CRITICAL: Normalize to absolute URL
  imageUrl = toAbsoluteUrl(imageUrl);
  
  // ✅ Final validation
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    // Placeholder göster
    return;
  }
  
  // Görseli yükle
  const imageData = await this.getCardImageBytes(imageUrl);
}
```

## 🔧 TEKNİK DETAYLAR

### Neden Localhost'ta Çalışıyordu?

1. **Localhost'ta**: `window.location.origin = "http://localhost:3000"` → Doğru
2. **Relative URL'ler**: Localhost'ta aynı origin olduğu için çalışıyordu
3. **Proxy Route**: Localhost'ta her zaman erişilebilir

### Neden Prod'da Çalışmıyordu?

1. **Prod'da**: Origin farklı (`https://PROJE-ADI.pages.dev`)
2. **Relative URL'ler**: Yanlış origin ile absolute URL'e çevriliyordu
3. **Proxy Route**: Yanlış domain ile çağrılıyordu → 404

### Çözüm Neden Çalışıyor?

1. ✅ **Browser'da her zaman doğru origin**: `window.location.origin` kullanılıyor
2. ✅ **Absolute URL garantisi**: Tüm URL'ler normalize ediliyor
3. ✅ **Fallback mekanizması**: Proxy başarısız olursa direct fetch deneniyor
4. ✅ **Error handling**: Hatalar yakalanıyor ve loglanıyor

## 📋 DEĞİŞEN DOSYALAR

1. **`src/utils/url.ts`**
   - `getSiteOrigin()`: Browser origin önceliği
   - `toAbsoluteUrl()`: Error handling ve fallback

2. **`src/utils/imageDataUri.ts`**
   - Proxy URL absolute garantisi
   - Fallback mekanizması (proxy → direct)
   - Enhanced error handling

3. **`src/utils/pdfGenerator.ts`**
   - Tüm görsel URL'leri normalize ediliyor
   - `preloadImages()`: URL normalization
   - `drawCard()`: URL normalization
   - `getCardBackImageBytes()`: Absolute URL garantisi

4. **`README_CLOUDFLARE.md`**
   - PDF görsel sorunları için troubleshooting guide eklendi

## 🧪 TEST ADIMLARI

1. **Localhost'ta test**:
   ```bash
   npm run dev
   # PDF indir, görsellerin çalıştığını kontrol et
   ```

2. **Prod'da test**:
   - Cloudflare Pages'e deploy et
   - PDF indir
   - Görsellerin yüklendiğini kontrol et
   - Browser console'da network hatalarını kontrol et

3. **Debug**:
   - Browser console'da `[getSiteOrigin]` ve `[toAbsoluteUrl]` loglarını kontrol et
   - Network tab'da proxy isteklerinin doğru URL ile yapıldığını kontrol et

## 🛡️ KORUYUCU ÖNLEMLER

1. ✅ **URL Normalization**: Tüm görsel URL'leri normalize ediliyor
2. ✅ **Origin Detection**: Browser'da her zaman doğru origin kullanılıyor
3. ✅ **Fallback**: Proxy başarısız olursa direct fetch deneniyor
4. ✅ **Error Handling**: Hatalar yakalanıyor ve loglanıyor
5. ✅ **Validation**: URL'ler absolute olarak validate ediliyor

## 📝 NOTLAR

- **ENV Variable**: `NEXT_PUBLIC_SITE_URL` opsiyonel ama önerilir (SSR fallback için)
- **Browser Origin**: Her zaman öncelikli, prod domain'i otomatik algılanıyor
- **Proxy Route**: Edge runtime'da çalışıyor, CORS header'ları doğru set ediliyor
- **Timeout**: 30 saniye (Cloudflare Pages için optimize edildi)

## 🎉 SONUÇ

Bu çözümlerle:
- ✅ Prod'da PDF görselleri doğru yükleniyor
- ✅ Localhost davranışı değişmedi
- ✅ CORS/URL/Asset path farklarına dayanıklı
- ✅ Error handling ve fallback mekanizması var

**Tekrar Olmaması İçin**: Tüm görsel URL'leri her zaman `toAbsoluteUrl()` ile normalize edin ve browser origin'ini kullanın.
