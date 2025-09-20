import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

export default defineConfig({
  server: {
    port: 5173,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method === 'POST' && req.url === '/api/release-log') {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', async () => {
              try {
                const json = JSON.parse(data || '[]');
                const target = path.join(process.cwd(), 'modules', 'ReleaseManagement', 'release-log.json');
                await fs.writeFile(target, JSON.stringify(json, null, 2));
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
              } catch (e) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: e?.message || 'invalid json' }));
              }
            });
            return; // handled
          }
          if (req.method === 'POST' && req.url === '/api/ai/summarize') {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', async () => {
              try {
                const body = JSON.parse(data || '{}');
                const notes = String(body?.notes || '').slice(0, 4000);
                const apiKey = process.env.OPENAI_API_KEY;
                const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
                if (!apiKey) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: false, error: 'OPENAI_API_KEY is not set on server' }));
                  return;
                }
                const prompt = `Summarize the following release changes and produce concise release notes in Turkish (tr), German (de), and English (en). Keep it one sentence per language, neutral tone, and suitable for a changelog bullet.\n\nChanges:\n${notes}`;
                const r = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model,
                    messages: [
                      { role: 'system', content: 'You are a helpful release notes assistant.' },
                      { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                  })
                });
                if (!r.ok) {
                  const t = await r.text().catch(()=> '');
                  throw new Error(`OpenAI API error: ${r.status} ${t}`);
                }
                const j = await r.json();
                const text = j?.choices?.[0]?.message?.content || '';
                // Heuristically split into three lines if possible
                let tr = '', de = '', en = '';
                const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
                if (lines.length >= 3) { [tr, de, en] = lines.slice(0,3); }
                else { tr = text; de = text; en = text; }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, description: { tr, de, en } }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: e?.message || 'ai_failed' }));
              }
            });
            return;
          }
        } catch {}
        next();
      });
    }
  },
});
