import { listApprovals, startApproval, applyApproval } from './api';
import { t } from './i18n';

export function mountApprovalsPage(root: HTMLElement, currentUserId: string) {
  root.innerHTML = '';
  const wrap = document.createElement('div');

  const form = document.createElement('div');
  form.className = 'users-detail';
  form.innerHTML = `
    <h3 style="font-weight:600;margin-bottom:8px">${t('fourEyes')} – ${t('triggerApproval')}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
      <input id="apOp" placeholder="operation key (e.g. vehicle.decommission)" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <input id="apTenant" placeholder="tenantId (e.g. TENANT_DEMO_1)" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <input id="apTarget" placeholder="targetId (optional)" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <button id="apStart" style="padding:8px;border-radius:8px;background:#0369a1;color:#fff">${t('triggerApproval')}</button>
    </div>
  `;

  const listBox = document.createElement('div');
  listBox.className = 'users-detail';
  listBox.style.marginTop = '12px';

  wrap.append(form, listBox);
  root.appendChild(wrap);

  async function refresh() {
    try {
      const items = await listApprovals();
      listBox.innerHTML = "<h3 style='font-weight:600;margin-bottom:8px'>Pending / Approved</h3>";
      items.forEach((a: any) => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px';
        card.innerHTML = `
          <div><b>Op:</b> ${a.op}</div>
          <div><b>Status:</b> ${a.status}</div>
          <div><b>Initiator:</b> ${a.initiatorUserId}</div>
          <div><b>Approvals:</b> ${(a.approvals || []).map((ap: any) => ap.userId).join(', ') || '-'}</div>
        `;
        if (a.status === 'PENDING') {
          const btn = document.createElement('button');
          btn.textContent = 'Approve';
          btn.style.cssText = 'padding:6px 10px;border-radius:8px;background:#16a34a;color:#fff;margin-top:6px';
          btn.onclick = async () => {
            const r = await applyApproval(a.id, currentUserId);
            if (!r?.ok) {
              alert(r?.error || 'Fehler');
            }
            await refresh();
          };
          card.appendChild(btn);
        }
        listBox.appendChild(card);
      });
    } catch (error: any) {
      listBox.innerHTML = "<div style='border:1px solid #fca5a5;background:#fee2e2;padding:12px;border-radius:8px;color:#991b1b'>" +
        (error?.message || 'Onay listesi alınamadı. Lütfen önce giriş yapın.') +
        '</div>';
    }
  }

  (form.querySelector('#apStart') as HTMLButtonElement).onclick = async () => {
    const op = (form.querySelector('#apOp') as HTMLInputElement).value.trim();
    const tenantId = (form.querySelector('#apTenant') as HTMLInputElement).value.trim();
    const targetId = (form.querySelector('#apTarget') as HTMLInputElement).value.trim() || undefined;
    if (!op || !tenantId) {
      alert('op ve tenantId zorunludur.');
      return;
    }
    try {
      const res = await startApproval(op, tenantId, currentUserId, targetId);
      if (!res?.ok) {
        alert(res?.error || 'Hata');
      } else {
        if (form.querySelector('#apTarget')) {
          (form.querySelector('#apTarget') as HTMLInputElement).value = '';
        }
        (form.querySelector('#apOp') as HTMLInputElement).value = '';
      }
      await refresh();
    } catch (error: any) {
      alert(error?.message || 'Onay tetiklenemedi.');
    }
  };

  refresh();
}
