#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

function sh(cmd){ return execSync(cmd, { stdio: ['ignore','pipe','ignore'], encoding: 'utf-8' }).trim(); }

function tags() {
  try {
    const out = sh("git for-each-ref --sort=creatordate --format '%(refname:short)|%(creatordate:iso8601)' refs/tags");
    return out.split(/\n/).filter(Boolean).map(l => { const [t,d] = l.split('|'); return { tag:t, date:new Date(d) }; });
  } catch { return []; }
}

function audit() { try { return JSON.parse(readFileSync('audit/audit.log.json','utf-8')); } catch { return []; } }

const tagList = tags();
const audits = audit();

// Deployment frequency (per week over last 90 days)
const now = Date.now();
const win = 90*24*60*60*1000;
const recentTags = tagList.filter(t => (now - t.date.getTime()) <= win);
const perWeek = {};
for (const t of recentTags) {
  const wk = `${t.date.getUTCFullYear()}-W${Math.ceil((t.date.getUTCDate())/7)}`;
  perWeek[wk] = (perWeek[wk]||0)+1;
}

// Lead time (from oldest commit since previous tag to tag time) approximation
function leadTimeHours(idx){
  if (idx<=0) return null;
  const prev = tagList[idx-1].tag;
  const curr = tagList[idx].tag;
  try {
    const oldest = sh(`git log ${prev}..${curr} --reverse --pretty=%aI | head -n 1`);
    const currDate = tagList[idx].date;
    const first = oldest ? new Date(oldest) : null;
    if (!first) return null;
    return Math.round((currDate - first)/36e5);
  } catch { return null; }
}
const leadTimes = tagList.map((_,i)=>leadTimeHours(i)).filter(v=>v!=null);

// Change failure rate (heuristic): count tags with a matching rollback commit within 24h
const cfrWindow = 24*60*60*1000;
function hasRollbackNear(date){
  return audits.some(r => /rollback|revert/i.test(r.message||'') && Math.abs(new Date(r.timestamp) - date) <= cfrWindow);
}
const failed = recentTags.filter(t => hasRollbackNear(t.date)).length;
const cfr = recentTags.length ? (failed / recentTags.length) : 0;

// MTTR (heuristic): time between a rollback marker and next tag
let mttrs = [];
const rollbackEvents = audits.filter(r=>/rollback|revert/i.test(r.message||''))
  .map(r=>new Date(r.timestamp)).sort((a,b)=>a-b);
for (const ev of rollbackEvents) {
  const next = tagList.find(t => t.date > ev);
  if (next) mttrs.push(Math.round((next.date - ev)/36e5));
}

const metrics = {
  generatedAt: new Date().toISOString(),
  windowDays: 90,
  deploymentFrequency: perWeek,
  leadTimeHours: {
    count: leadTimes.length,
    p50: leadTimes.sort((a,b)=>a-b)[Math.floor(leadTimes.length*0.5)] || null,
    p90: leadTimes[Math.floor(leadTimes.length*0.9)] || null
  },
  changeFailureRate: cfr,
  mttrHours: mttrs.length ? Math.round(mttrs.reduce((a,b)=>a+b,0)/mttrs.length) : null
};

if (!existsSync('metrics')) mkdirSync('metrics');
writeFileSync('metrics/dora.json', JSON.stringify(metrics, null, 2));
writeFileSync('metrics/DORA.md', `# DORA Metrics\n\n- Generated: ${metrics.generatedAt}\n- Window: last ${metrics.windowDays} days\n- Deployments/week: ${Object.values(perWeek).reduce((a,b)=>a+b,0)} total\n- Lead time p50: ${metrics.leadTimeHours.p50 ?? '-'} h, p90: ${metrics.leadTimeHours.p90 ?? '-'} h\n- Change failure rate: ${(metrics.changeFailureRate*100).toFixed(1)}%\n- MTTR: ${metrics.mttrHours ?? '-'} h\n`);
console.log('DORA metrics written to metrics/.');

