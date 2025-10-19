import {
  listApprovals,
  startApproval,
  applyApproval,
  type ApprovalItem,
  type ApprovalMutationResponse
} from './api';
import { t } from './i18n';

export function mountApprovalsPage(root: HTMLElement, currentUserId: string) {
  root.innerHTML = '';
  const wrap = document.createElement('div');

  const form = document.createElement('div');
  form.className = 'users-detail';
  const opPlaceholder = t('approvalOpPlaceholder') || 'operation key (e.g. vehicle.decommission)';
  const tenantPlaceholder = t('tenantIdPlaceholder') || 'tenantId (e.g. TENANT_DEMO_1)';
  const targetPlaceholder = t('approvalObjectPlaceholder') || 'targetId (optional)';
  const startApprovalLabel = t('triggerApproval') || 'Trigger approval';
  form.innerHTML = `
    <h3 style="font-weight:600;margin-bottom:8px">${t('fourEyes')} – ${startApprovalLabel}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
      <input id="apOp" placeholder="${opPlaceholder}" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <input id="apTenant" placeholder="${tenantPlaceholder}" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <input id="apTarget" placeholder="${targetPlaceholder}" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px">
      <button id="apStart" style="padding:8px;border-radius:8px;background:#0369a1;color:#fff">${startApprovalLabel}</button>
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
      if (!items.length) {
        listBox.innerHTML = `<div class="empty">${esc(t('approvalsEmpty') || 'No approvals queued.')}</div>`;
        return;
      }
      listBox.innerHTML = `<h3 style="font-weight:600;margin-bottom:8px">${esc(
        t('approvalsListTitle') || t('approvalsTitle') || 'Approvals'
      )}</h3>`;
      items.forEach((approval) => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px';
        card.innerHTML = `
          <div><b>${esc(t('approvalOpLabel') || 'Operation')}:</b> ${esc(approval.op)}</div>
          <div><b>${esc(t('approvalStatusLabel') || 'Status')}:</b> ${esc(formatStatus(approval.status))}</div>
          <div><b>${esc(t('approvalInitiatorLabel') || 'Initiator')}:</b> ${esc(approval.initiatorUserId || '-')}</div>
          ${
            approval.targetId
              ? `<div><b>${esc(t('approvalObjectLabel') || 'Target')}:</b> ${esc(approval.targetId)}</div>`
              : ''
          }
          <div><b>${esc(t('approvalApproversLabel') || 'Approvers')}:</b> ${esc(
            formatApprovers(approval)
          )}</div>
        `;
        if (approval.status === 'PENDING') {
          const btn = document.createElement('button');
          btn.textContent = t('approvalApproveAction') || 'Approve';
          btn.style.cssText = 'padding:6px 10px;border-radius:8px;background:#16a34a;color:#fff;margin-top:6px';
          btn.onclick = async () => {
            const response: ApprovalMutationResponse = await applyApproval(approval.id, currentUserId);
            if (!response.ok) {
              alert(response.error || t('errorGeneric') || 'Error');
            }
            await refresh();
          };
          card.appendChild(btn);
        }
        listBox.appendChild(card);
      });
    } catch (error) {
      listBox.innerHTML =
        "<div style='border:1px solid #fca5a5;background:#fee2e2;padding:12px;border-radius:8px;color:#991b1b'>" +
        esc(
          errorMessage(error) ||
            t('approvalsLoadFailed') ||
            t('errorGeneric') ||
            'Failed to load approvals.'
        ) +
        '</div>';
    }
  }

  const startButton = form.querySelector<HTMLButtonElement>('#apStart');
  const opInput = form.querySelector<HTMLInputElement>('#apOp');
  const tenantInput = form.querySelector<HTMLInputElement>('#apTenant');
  const targetInput = form.querySelector<HTMLInputElement>('#apTarget');
  if (!startButton || !opInput || !tenantInput || !targetInput) {
    throw new Error('Approval form inputs are missing');
  }

  startButton.onclick = async () => {
    const op = opInput.value.trim();
    const tenantId = tenantInput.value.trim();
    const targetId = targetInput.value.trim() || undefined;
    if (!op) {
      alert(t('approvalOpRequired') || 'Operation identifier is required.');
      return;
    }
    if (!tenantId) {
      alert(t('tenantIdRequired') || 'Tenant ID is required.');
      return;
    }
    try {
      const response = await startApproval(op, tenantId, currentUserId, targetId);
      if (!response.ok) {
        alert(response.error || t('errorGeneric') || 'Error');
      } else {
        targetInput.value = '';
        opInput.value = '';
      }
      await refresh();
    } catch (error) {
      alert(errorMessage(error) || t('errorGeneric') || 'Failed to trigger approval.');
    }
  };

  refresh();
}

function formatStatus(status: string | undefined) {
  switch (status) {
    case 'PENDING':
      return t('approvalStatusPending') || 'Pending';
    case 'APPROVED':
      return t('approvalStatusApproved') || 'Approved';
    case 'REJECTED':
      return t('approvalStatusRejected') || 'Rejected';
    case 'CANCELLED':
      return t('approvalStatusCancelled') || 'Cancelled';
    default:
      return status || '-';
  }
}

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatApprovers(item: ApprovalItem): string {
  const approvers = item.approvals ?? [];
  if (!approvers.length) {
    return '-';
  }
  return approvers.map((approver) => approver.userId).join(', ');
}

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return undefined;
}
