export const Telemetry = {
  enabled: true,
  marks: {},
  _last: {}, // simple throttle map per event
  _scrub(obj) {
    try {
      const json = JSON.stringify(obj);
      const scrubbed = json
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}/g, '<redacted-email>')
        .replace(/Bearer\s+[A-Za-z0-9\-_.~+/=]+/gi, 'Bearer [REDACTED]');
      return JSON.parse(scrubbed);
    } catch { return obj; }
  },
  log(event, data = {}) {
    if (!this.enabled) return;
    try {
      const now = Date.now();
      // Basic throttle for noisy events (e.g., error): 2000ms
      const throttleMs = event === 'error' ? 2000 : 0;
      if (throttleMs) {
        const last = this._last[event] || 0;
        if (now - last < throttleMs) return;
        this._last[event] = now;
      }
      const entry = { t: now, event, ...this._scrub(data) };
      const arr = JSON.parse(localStorage.getItem('Telemetry') || '[]');
      arr.push(entry);
      const max = Math.max(0, (window.AppConfigRef?.telemetry?.maxEntries ?? 5000));
      while (arr.length > max) arr.shift();
      localStorage.setItem('Telemetry', JSON.stringify(arr));
    } catch {}
  },
  start(name) { this.marks[name] = performance.now(); },
  end(name, extra = {}) {
    const s = this.marks[name];
    if (s != null) {
      const dur = Math.round(performance.now() - s);
      this.log('perf', { name, dur, ...extra });
      delete this.marks[name];
    }
  }
};
