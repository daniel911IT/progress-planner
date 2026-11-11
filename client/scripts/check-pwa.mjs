import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const fail = (message) => {
  console.error(`PWA-Prüfung fehlgeschlagen: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`✓ ${message}`);

if (!existsSync(dist)) {
  fail('client/dist fehlt. Führe zuerst npm run build aus.');
  process.exit();
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/.test(html)) fail('index.html bindet das Manifest nicht ein.');
else pass('Manifest ist in index.html eingebunden.');

const manifestPath = join(dist, 'manifest.webmanifest');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  fail('manifest.webmanifest fehlt oder ist kein gültiges JSON.');
}

if (manifest) {
  if (manifest.name !== 'Progress Planner') fail('Manifestname ist nicht „Progress Planner“.');
  else pass('Manifestname ist korrekt.');
  if (manifest.start_url !== '/' || manifest.scope !== '/') fail('start_url und scope müssen zur App-Root passen.');
  else pass('Start-URL und Scope passen zur App-Root.');
  if (manifest.display !== 'standalone') fail('display ist nicht auf standalone gesetzt.');
  else pass('Standalone-Modus ist gesetzt.');

  for (const expectedSize of [192, 512]) {
    const icon = manifest.icons?.find((entry) => entry.sizes === `${expectedSize}x${expectedSize}` && entry.type === 'image/png');
    if (!icon) {
      fail(`Manifest enthält kein ${expectedSize}×${expectedSize} PNG-Icon.`);
      continue;
    }
    const iconPath = join(dist, icon.src.replace(/^\//, ''));
    if (!existsSync(iconPath)) {
      fail(`Icon fehlt im Build: ${icon.src}`);
      continue;
    }
    const png = readFileSync(iconPath);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== expectedSize || height !== expectedSize) fail(`${icon.src} hat ${width}×${height} statt ${expectedSize}×${expectedSize}.`);
    else pass(`${expectedSize}×${expectedSize} PNG-Icon ist vorhanden.`);
    const purposes = icon.purpose?.split(/\s+/) ?? [];
    if (!purposes.includes('any') || !purposes.includes('maskable')) fail(`${icon.src} muss für any und maskable deklariert sein.`);
  }
}

if (!/name="apple-mobile-web-app-capable"\s+content="yes"/.test(html)) fail('iOS-Standalone-Metadaten fehlen.');
else pass('iOS-Web-App-Metadaten sind vorhanden.');
if (!/rel="apple-touch-icon"/.test(html) || !existsSync(join(dist, 'icons', 'apple-touch-icon.png'))) fail('Apple Touch Icon fehlt oder ist nicht in index.html eingebunden.');
else pass('Apple Touch Icon ist vorhanden.');

const serviceWorkerPath = join(dist, 'sw.js');
if (!existsSync(serviceWorkerPath)) {
  fail('sw.js fehlt im Produktions-Build.');
} else {
  const sw = readFileSync(serviceWorkerPath, 'utf8');
  if (!sw.includes("url.pathname.startsWith('/api/')")) fail('Service Worker umgeht API-Aufrufe nicht.');
  else pass('API-Aufrufe werden vom Cache ausgeschlossen.');
  if (!sw.includes("request.mode === 'navigate'") || !sw.includes('caches.match(\'/\')')) fail('Offline-Fallback für App-Navigation fehlt.');
  else pass('App-Shell kann offline geöffnet werden.');
}

const assetRefs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)].map((match) => match[1]);
if (!assetRefs.length) fail('Gebündelte JavaScript- oder CSS-Dateien werden nicht referenziert.');
else {
  const sw = existsSync(serviceWorkerPath) ? readFileSync(serviceWorkerPath, 'utf8') : '';
  for (const asset of assetRefs) {
    if (!existsSync(join(dist, asset.replace(/^\//, '')))) fail(`Gebündelte Datei fehlt: ${asset}`);
  }
  if (sw.includes('html.matchAll') && sw.includes("path.startsWith('/')")) pass('Service Worker entdeckt die gebündelten JS-/CSS-Dateien im App-Shell-HTML für den Offline-Cache.');
  else fail('Service Worker kann die gebündelten JS-/CSS-Dateien nicht aus dem App-Shell-HTML ermitteln.');
}

const javascript = assetRefs.find((asset) => asset.endsWith('.js'));
if (javascript && readFileSync(join(dist, javascript.replace(/^\//, '')), 'utf8').includes('serviceWorker.register("/sw.js"')) pass('App registriert den Service Worker im Produktions-Build.');
else fail('Service Worker wird im Produktions-Build nicht registriert.');

const stylesheets = assetRefs.filter((asset) => asset.endsWith('.css'));
if (stylesheets.some((asset) => readFileSync(join(dist, asset.replace(/^\//, '')), 'utf8').includes('safe-area-inset'))) pass('Mobile Safe-Area-Abstände sind in den Styles enthalten.');
else fail('Mobile Safe-Area-Abstände fehlen in den Styles.');

if (!existsSync(join(process.cwd(), '..', 'docker-compose.production.yml')) || !existsSync(join(process.cwd(), '..', 'Caddyfile'))) fail('HTTPS-Produktionskonfiguration mit Caddy fehlt.');
else pass('HTTPS-Produktionskonfiguration ist vorhanden.');

if (process.exitCode) process.exit(process.exitCode);
console.log('PWA-Dateien und lokale Installationsvoraussetzungen sind vollständig. Öffentliches Installieren setzt eine erreichbare HTTPS-Domain voraus.');
