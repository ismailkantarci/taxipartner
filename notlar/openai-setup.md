# OpenAI API Kurulumu (Codespaces)

1. GitHub Codespaces Settings → Secrets → Codespaces bölümüne gidin.
2. `OPENAI_API_KEY` adıyla gizli anahtar ekleyin (değerinizi buraya yapıştırın). Ek olarak şu değerleri isteğe bağlı tanımlayabilirsiniz:
   - `OPENAI_MODEL` (varsayılan: `gpt-5-pro`)
   - `OPENAI_CODEX_MODEL` (`gpt-5-codex`)
3. Yeni secret’ı kaydedin. Aktif Codespace devam ediyorsa terminalde `source scripts/bootstrap_env.sh` veya `./tp setup` çalıştırarak ortam değişkenlerini yeniden yükleyin.
4. Doğrulama: `node scripts/ai/sample-openai.js "selam"` komutunu çalıştırın. Hata alırsanız `OPENAI_API_KEY` ve ağ erişiminin açık olduğuna emin olun.
5. Kullanım notları: `scripts/ai/sample-openai.js` komutu `--diff path` parametresiyle diff dosyalarını da inceleyebilir. Örnek:
   ```bash
   git diff > /tmp/current.diff
   node scripts/ai/sample-openai.js "Bu diff’i kod incele" --diff /tmp/current.diff
   ```
