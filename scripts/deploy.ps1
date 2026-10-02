# ==============================================================================
# Script de Deploy e Publicação Automatizada - bibianodenis-dev
# ==============================================================================
param(
    [string]$CommitMessage = "feat: update autonomous Pong simulation and profile documentation"
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "🚀 Iniciando Pipeline de Publicação no GitHub" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Verificar se o Git está instalado
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Git não encontrado no PATH. Instale o Git antes de prosseguir."
    exit 1
}

# 2. Configurar ou Verificar Remoto
$ExpectedRemote = "https://github.com/bibianodenis-dev/bibianodenis-dev.git"
$CurrentRemote = git remote get-url origin 2>$null

if (-not $CurrentRemote) {
    Write-Host "📡 Adicionando repositório remoto: $ExpectedRemote" -ForegroundColor Yellow
    git remote add origin $ExpectedRemote
} elseif ($CurrentRemote -ne $ExpectedRemote -and $CurrentRemote -ne "https://github.com/bibianodenis-dev/bibianodenis-dev") {
    Write-Host "🔄 Atualizando URL do remoto origin para: $ExpectedRemote" -ForegroundColor Yellow
    git remote set-url origin $ExpectedRemote
} else {
    Write-Host "✅ Remoto origin configurado corretamente: $CurrentRemote" -ForegroundColor Green
}

# 3. Garantir branch main
$CurrentBranch = git rev-parse --abbrev-ref HEAD
if ($CurrentBranch -ne "main") {
    Write-Host "🔀 Mudando para branch 'main'..." -ForegroundColor Yellow
    git branch -M main
}

# 4. Gerar simulação atualizada do Pong
Write-Host "🎮 Compilando simulação autônoma de Ping Pong..." -ForegroundColor Magenta
python scripts/generate_pong.py
node scripts/generate_pong_svg.js

# 5. Adicionar arquivos ao Git (respeitando .gitignore)
Write-Host "📦 Preparando arquivos para commit..." -ForegroundColor Blue
git add .

# 6. Realizar Commit se houver alterações
$Status = git status --porcelain
if ($Status) {
    Write-Host "📝 Criando commit: '$CommitMessage'" -ForegroundColor Green
    git commit -m "$CommitMessage"
} else {
    Write-Host "ℹ️ Nenhuma alteração pendente para commit." -ForegroundColor DarkGray
}

# 7. Realizar Push para o GitHub
Write-Host "🚀 Enviando commits para origin/main..." -ForegroundColor Cyan
git push -u origin main

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "🎉 Repositório publicado com sucesso no GitHub!" -ForegroundColor Green
Write-Host "🔗 Ver perfil: https://github.com/bibianodenis-dev" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
