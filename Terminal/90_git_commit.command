#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "[error] git komutu bulunamadı. Git'i kur ve tekrar dene."
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[error] Bu klasör bir git deposu değil."
  exit 1
fi

default_files=(
  "Terminal/01_env_check.command"
  "Terminal/02_install_dependencies.command"
  "Terminal/03_prisma_prepare.command"
  "Terminal/10_start_identity.command"
  "Terminal/20_start_admin.command"
  "Terminal/30_start_identity_spa.command"
  "Terminal/40_start_tailwind.command"
  "Terminal/90_git_commit.command"
  "Terminal/README.md"
  ".env"
  "identity/.env"
  "prisma/identity/dev.db"
)

echo "[info] Proje kökü: $PROJECT_ROOT"

git status -sb

echo
read -r -p "Varsayılan dosyaları stage etmek ister misin? (y/N) " answer
answer=$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')
if [[ "$answer" == "y" ]]; then
  for file in "${default_files[@]}"; do
    if [[ -e "$file" ]]; then
      git add "$file"
    fi
  done
  echo "[info] Varsayılan dosyalar eklendi."
else
  echo "[info] Varsayılan dosyalar eklenmedi."
fi

echo
read -r -p "Ekstra dosya veya desen eklemek istiyorsan yaz (boş geçmek için Enter): " extra
if [[ -n "$extra" ]]; then
  git add $extra
fi

git status -sb

echo
if git diff --cached --quiet; then
  echo "[warn] Stage edilmiş değişiklik yok. Commit atılmadı."
  exit 0
fi

while true; do
  read -r -p "Commit mesajı: " message
  if [[ -n "$message" ]]; then
    break
  fi
  echo "[warn] Commit mesajı boş olamaz."
done

if git commit -m "$message"; then
  echo "[ok] Commit oluşturuldu."
else
  echo "[error] Commit başarısız oldu. Ayrıntılar yukarıda."
  exit 1
fi

echo
read -r -p "Değişiklikleri uzak depoya göndermek ister misin? (y/N) " push_answer
push_answer=$(printf '%s' "$push_answer" | tr '[:upper:]' '[:lower:]')
if [[ "$push_answer" == "y" ]]; then
  git push && echo "[ok] Push tamamlandı." || echo "[warn] Push başarısız oldu."
else
  echo "[info] Push atlanıyor."
fi
