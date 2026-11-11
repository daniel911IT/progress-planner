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

const sourceFiles = ['src/App.vue', 'src/storage.ts', 'src/main.ts'].map((file) => readFileSync(join(process.cwd(), file), 'utf8'));
if (sourceFiles.some((source) => /fetch\s*\(|\/api\//.test(source))) fail('App-Code enthält einen externen API-Aufruf.');
else pass('App-Code enthält keine API-Aufrufe.');

const appSource = sourceFiles[0];
const storageSource = sourceFiles[1];
if (!storageSource.includes('indexedDB.open') || !storageSource.includes("const HISTORY = 'history'")) fail('IndexedDB-Projekt- oder Verlaufspeicher fehlt.');
else pass('Projekte und Änderungsverlauf werden in IndexedDB gespeichert.');
if (!appSource.includes('dataStore.exportBackup()') || !appSource.includes('dataStore.importBackup(backup)')) fail('JSON-Export oder -Import fehlt.');
else pass('JSON-Export und -Import sind in der Oberfläche verbunden.');
if (!storageSource.includes('navigator.storage?.persist')) fail('Die App bittet den Browser nicht um persistente lokale Speicherung.');
else pass('Persistente Speicherung wird beim Browser angefragt.');

const repository = join(process.cwd(), '..');
if (existsSync(join(repository, 'server')) || existsSync(join(repository, 'database'))) fail('Backend- oder Datenbankverzeichnis ist noch vorhanden.');
else pass('Build ist frei von Backend und MariaDB.');

const viteConfig = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const readme = readFileSync(join(repository, 'README.md'), 'utf8');
if (!/base:\s*'\/'/.test(viteConfig) || !readme.includes('Cloudflare Pages')) fail('Root-Pfad oder HTTPS-Hosting-Anleitung fehlt.');
else pass('Statisches HTTPS-Hosting ist dokumentiert und für den Root-Pfad konfiguriert.');

if (process.exitCode) process.exit(process.exitCode);
console.log('PWA-Dateien und lokale Installationsvoraussetzungen sind vollständig. Öffentliches Installieren setzt eine erreichbare HTTPS-Domain voraus.');
