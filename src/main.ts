import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// CR-010: inside the desktop app the host's own plugins replace the browser-only pieces (network, files, links).
// In a normal browser nothing changes and none of the desktop code is loaded.
async function start(): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) return void (await bootstrapApplication(App, appConfig));
  const [{ loadTauriApis }, { installDesktop }] = await Promise.all([import('./app/desktop/desktop-apis'), import('./app/desktop/install-desktop')]);
  const providers = installDesktop(await loadTauriApis());
  // The installed app opens on the home page (the browser build keeps / → deck list, which the V1 tests lock).
  if (location.pathname === '/') history.replaceState(null, '', '/home');
  await bootstrapApplication(App, { ...appConfig, providers: [...appConfig.providers, ...providers] });
}

start().catch((err) => console.error(err));
