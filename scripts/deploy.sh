#!/usr/bin/env bash
# ==============================================================================
# Script de Deploy e Publicação Automatizada - Linux / macOS / Git Bash
# ==============================================================================
set -e

COMMIT_MSG="${1:-feat: update autonomous Pong simulation and profile documentation}"

echo "====================================================="
echo "🚀 Iniciando Pipeline de Publicação no GitHub"
echo "====================================================="

EXPECTED_REMOTE="https://github.com/bibianodenis-dev/bibianodenis-dev.git"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$CURRENT_REMOTE" ]; then
    echo "📡 Adicionando repositório remoto: $EXPECTED_REMOTE"
    git remote add origin "$EXPECTED_REMOTE"
elif [ "$CURRENT_REMOTE" != "$EXPECTED_REMOTE" ] && [ "$CURRENT_REMOTE" != "https://github.com/bibianodenis-dev/bibianodenis-dev" ]; then
    echo "🔄 Atualizando URL do remoto origin..."
    git remote set-url origin "$EXPECTED_REMOTE"
else
    echo "✅ Remoto origin verificado: $CURRENT_REMOTE"
fi

git branch -M main

echo "🎮 Compilando simulação autônoma de Ping Pong..."
python scripts/generate_pong.py
node scripts/generate_pong_svg.js

echo "📦 Preparando arquivos para commit..."
git add .

if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Criando commit: '$COMMIT_MSG'"
    git commit -m "$COMMIT_MSG"
else
    echo "ℹ️ Nenhuma alteração pendente para commit."
fi

echo "🚀 Enviando commits para origin/main..."
git push -u origin main

echo "====================================================="
echo "🎉 Repositório publicado com sucesso no GitHub!"
echo "🔗 Ver perfil: https://github.com/bibianodenis-dev"
echo "====================================================="
