#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html','utf-8');
function req(pattern, name){
  if (!pattern.test(html)) { console.error(`Missing or weak ${name}`); process.exitCode = 1; }
}

req(/Content-Security-Policy/i, 'CSP');
req(/default-src 'self'/, 'CSP default-src');
req(/script-src 'self'/, 'CSP script-src');
req(/style-src 'self'/, 'CSP style-src');
req(/img-src 'self' data:/, 'CSP img-src');
req(/object-src 'none'/, 'CSP object-src');
req(/frame-ancestors 'none'/i, 'frame-ancestors none');
req(/base-uri 'self'/i, 'base-uri self');

if (process.exitCode) {
  console.error('Security header checks failed.');
  process.exit(1);
}
console.log('Security header checks OK');

