# GitHub'a Push Talimatları

## ✅ Durum
Tüm değişiklikler commit edildi ve GitHub'a push için hazır!

**Commit:** `758ee8c - PDF görsel yükleme sorunları düzeltildi - API route eklendi, canvas ve proxy yöntemleri iyileştirildi`

**Repository:** https://github.com/archeronur/optcg.git

## 🚀 Push Yapma Yöntemleri

### Yöntem 1: Otomatik Script (Önerilen)
```bash
./push-to-github.sh
```

### Yöntem 2: Manuel Git Push
```bash
git push origin main
```

### Yöntem 3: SSH ile Push
Eğer SSH key'iniz varsa:
```bash
git remote set-url origin git@github.com:archeronur/optcg.git
git push origin main
```

### Yöntem 4: Personal Access Token ile
```bash
git push https://YOUR_TOKEN@github.com/archeronur/optcg.git main
```

### Yöntem 5: GitHub Desktop
1. GitHub Desktop'ı açın
2. Repository'yi seçin
3. "Push origin" butonuna tıklayın

### Yöntem 6: VS Code Git Extension
1. VS Code'da Source Control panelini açın
2. "..." menüsünden "Push" seçin

## 📦 Commit Edilen Dosyalar

- ✅ `src/utils/pdfGenerator.ts` - PDF görsel yükleme iyileştirmeleri
- ✅ `src/app/api/image-proxy/route.ts` - Yeni API route (server-side proxy)
- ✅ `src/app/page.tsx` - UI iyileştirmeleri
- ✅ `package.json` - Bağımlılık güncellemeleri
- ✅ `TROUBLESHOOTING.md` - Sorun giderme dokümantasyonu

## 🔧 Yapılan İyileştirmeler

1. **Next.js API Route Eklendi**
   - Server-side görsel proxy
   - CORS sorunlarını çözer
   - `/api/image-proxy` endpoint'i

2. **Görsel Yükleme Stratejisi**
   - API route (öncelik 1)
   - Canvas yöntemi (fallback)
   - Direct fetch (fallback)
   - Proxy servisleri (fallback)

3. **Hata Yönetimi**
   - Detaylı loglama
   - Alternatif URL denemeleri
   - Placeholder gösterimi

## ⚠️ Authentication Sorunu

Eğer push sırasında authentication hatası alırsanız:

1. **GitHub Personal Access Token oluşturun:**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - "Generate new token" → "repo" izni verin

2. **SSH Key kullanın:**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Public key'i GitHub'a ekleyin
   cat ~/.ssh/id_ed25519.pub
   ```

3. **Git Credential Helper kullanın:**
   ```bash
   git config --global credential.helper osxkeychain
   ```

## 📝 Sonraki Adımlar

Push başarılı olduktan sonra:
1. GitHub repository'de değişiklikleri kontrol edin
2. Production'a deploy edin (Vercel, Cloudflare Pages, vb.)
3. API route'un çalıştığından emin olun

## 🔗 Linkler

- **Repository:** https://github.com/archeronur/optcg
- **GitHub Desktop:** https://desktop.github.com/
- **Personal Access Tokens:** https://github.com/settings/tokens
