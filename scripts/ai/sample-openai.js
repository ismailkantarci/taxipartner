#!/usr/bin/env node
import OpenAI from 'openai';

import fs from 'node:fs';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Kullanım: node scripts/ai/sample-openai.js "<prompt>" [--diff path]');
  process.exit(1);
}

let prompt = args.join(' ').trim();
let diffContent = '';

const diffFlagIndex = args.findIndex(arg => arg === '--diff');
if (diffFlagIndex !== -1) {
  const diffPath = args[diffFlagIndex + 1];
  if (!diffPath) {
    console.error('--diff parametresi için dosya yolu belirtmelisin.');
    process.exit(1);
  }
  try {
    diffContent = await fs.promises.readFile(diffPath, 'utf8');
    prompt = args.slice(0, diffFlagIndex).join(' ').trim();
  } catch (error) {
    console.error('[diff] dosyası okunamadı:', error?.message ?? error);
    process.exit(1);
  }
}

if (!prompt && diffContent) {
  prompt = `Lütfen aşağıdaki diff için kod incelemesi yap:\n\n${diffContent}`;
}
if (!prompt) {
  console.error('Kullanım: node scripts/ai/sample-openai.js "soru"');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_APIKEY ?? '';
if (!apiKey) {
  console.error('OPENAI_API_KEY ortam değişkeni bulunamadı. Codespaces Secrets üzerinden tanımla.');
  process.exit(1);
}

const client = new OpenAI({ apiKey });
const model = process.env.OPENAI_MODEL ?? 'gpt-5-pro';

try {
  const response = await client.responses.create({
    model,
    input: prompt,
    temperature: 0.4,
  });
  const output = response.output_text ?? JSON.stringify(response, null, 2);
  console.log(output.trim());
} catch (error) {
  console.error('[openai] çağrısı başarısız:', error?.message ?? error);
  process.exit(1);
}
