#!/bin/bash

# GitHub'a push script'i
# Kullanım: ./push-to-github.sh

echo "🚀 GitHub'a push işlemi başlatılıyor..."

# Mevcut durumu kontrol et
echo "📋 Git durumu kontrol ediliyor..."
git status

# Remote'u kontrol et
echo "🔗 Remote repository kontrol ediliyor..."
git remote -v

# Son commit'i göster
echo "📝 Son commit:"
git log --oneline -1

# Push yap
echo "⬆️  GitHub'a push yapılıyor..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Başarılı! Kod GitHub'a aktarıldı."
    echo "🔗 Repository: https://github.com/archeronur/optcg"
else
    echo "❌ Push başarısız oldu."
    echo ""
    echo "💡 Çözüm önerileri:"
    echo "1. GitHub credentials kontrol edin"
    echo "2. SSH key kullanın: git remote set-url origin git@github.com:archeronur/optcg.git"
    echo "3. Personal Access Token kullanın"
    echo "4. GitHub Desktop veya VS Code Git extension kullanın"
fi
