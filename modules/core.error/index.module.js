import { Toast } from '../core.toast/index.module.js';
import { Telemetry } from '../core.telemetry/index.module.js';

export const ErrorBoundary = {
  init() {
    window.addEventListener('error', (e) => {
      Telemetry?.log?.('error', { message: e.message, src: e.filename, line: e.lineno });
      Toast.show('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    });
    window.addEventListener('unhandledrejection', (e) => {
      Telemetry?.log?.('error', { message: String(e.reason) });
      Toast.show('Beklenmeyen bir hata oluştu.', 'error');
    });
  }
};

