import { AppState } from '../core.state/app.state.module.js';

export default {
  init(target){
    const get = () => { try { return JSON.parse(localStorage.getItem('Telemetry')||'[]'); } catch { return []; } };
    const data = get();
    const byType = data.reduce((acc, e)=>{ acc[e.event]=(acc[e.event]||0)+1; return acc; },{});
    const types = Object.keys(byType).sort((a,b)=>byType[b]-byType[a]);

    target.innerHTML = `
      <h1 class="text-xl font-bold mb-4">${AppState.getTranslation?.('sidebar.analytics') || 'Analytics'}</h1>
      <div class="flex gap-2 mb-4">
        <button id="expJson" class="px-3 py-2 rounded bg-gray-800 text-white">Export JSON</button>
        <button id="expCsv" class="px-3 py-2 rounded bg-gray-700 text-white">Export CSV</button>
        <button id="clearTel" class="px-3 py-2 rounded bg-red-600 text-white">Clear</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="border rounded p-3">
          <h2 class="font-semibold mb-2">Events by Type</h2>
          <table class="w-full text-sm"><thead><tr><th class="text-left">Event</th><th class="text-right">Count</th></tr></thead>
          <tbody id="tb"></tbody></table>
        </div>
        <div class="border rounded p-3 overflow-x-auto">
          <h2 class="font-semibold mb-2">Sample (last 20)</h2>
          <pre class="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">${JSON.stringify(data.slice(-20), null, 2)}</pre>
        </div>
        <div class="border rounded p-3 md:col-span-2">
          <h2 class="font-semibold mb-2">Bar Chart</h2>
          <div id="chart" class="space-y-1"></div>
        </div>
      </div>
    `;

    const tb = target.querySelector('#tb');
    types.forEach(k=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="py-1">${k}</td><td class="py-1 text-right">${byType[k]}</td>`;
      tb.appendChild(tr);
    });

    // ASCII bar chart (CSP dostu, inline style yok)
    const max = Math.max(1, ...types.map(k=>byType[k]));
    const chart = target.querySelector('#chart');
    types.forEach(k=>{
      const pct = Math.round((byType[k]/max)*20); // 20 blok
      const bar = '█'.repeat(pct) + '░'.repeat(20-pct);
      const div = document.createElement('div');
      div.className = 'font-mono text-xs';
      div.textContent = `${(bar)} ${k} (${byType[k]})`;
      chart.appendChild(div);
    });

    const expJson = target.querySelector('#expJson');
    const expCsv = target.querySelector('#expCsv');
    const clearTel = target.querySelector('#clearTel');
    expJson?.addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(get(), null, 2)], {type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='telemetry.json'; a.click();
    });
    expCsv?.addEventListener('click', ()=>{
      const arr = get();
      const keys = ['t','event','name','dur','route'];
      const head = keys.join(',');
      const rows = arr.map(e=> keys.map(k=> '"'+String(e[k]??'').replace(/\"/g,'\"\"')+'"').join(','));
      const bom='\ufeff';
      const blob = new Blob([bom + head + '\n' + rows.join('\n')], {type:'text/csv;charset=utf-8'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='telemetry.csv'; a.click();
    });
    clearTel?.addEventListener('click', ()=>{ localStorage.removeItem('Telemetry'); location.reload(); });
  }
};
