import { randomUUID } from 'node:crypto';
const approvals = new Map();
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
export function listRequests() {
    return Array.from(approvals.values()).map((item) => clone(item));
}
export function loadRequest(id) {
    const record = approvals.get(id);
    return record ? clone(record) : undefined;
}
export function saveRequest(record) {
    const id = record.id || randomUUID();
    const payload = {
        ...record,
        id,
        updatedAt: new Date().toISOString()
    };
    approvals.set(id, payload);
    return clone(payload);
}
export function upsertRequest(record) {
    return saveRequest(record);
}
export function resetRequests() {
    approvals.clear();
}
