import { attachRoutes } from './main.router';
import { integrateNavIntoExistingLayout } from './ui/topnav.integrate';

try { await import('./i18n/loader'); } catch {}
try { await import('./ui/mountGuard'); } catch {}
try { await import('./ui/globalGuard'); } catch {}

attachRoutes();

try {
  void integrateNavIntoExistingLayout();
} catch (error) {
  console.warn('[nav-integrate] failed', error);
}
