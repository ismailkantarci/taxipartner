import { attachRoutes } from './main.router';
import { integrateNavIntoExistingLayout } from './ui/topnav.integrate';

// MP-18 Fix Pack: hydrate runtime dictionary with static locales
try { await import('./i18n/loader'); } catch {}
// SaaS Hardening: global fetch guard for toast-based error handling
try { await import('./core/fetch.guard'); } catch {}
try { await import('./ui/mountGuard'); } catch {}
try { await import('./ui/globalGuard'); } catch {}

attachRoutes();

try {
  void integrateNavIntoExistingLayout();
} catch (error) {
  console.warn('[nav-integrate] failed', error);
}
