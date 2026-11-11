import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const repository = join(process.cwd(), '..');
const expectedBase = '/progress-planner/';
const siteOrigin = 'https://pages.example';
const fail = (message) => {
  console.error(`PWA-Prüfung fehlgeschlagen: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`✓ ${message}`);
const outputPath = (url) => join(dist, url.pathname.replace(/^\/progress-planner\//, ''));

if (!existsSync(dist)) {
  fail('client/dist fehlt. Führe zuerst npm run build aus.');
  process.exit();
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const manifestLink = html.match(/<link\s+rel="manifest"\s+href="([^"]+)"/);
if (!manifestLink) fail('index.html bindet das Manifest nicht ein.');
else if (manifestLink[1] !== `${expectedBase}manifest.webmanifest`) fail(`Manifest-Pfad muss unter ${expectedBase} liegen.`);
else pass('Manifest ist unter dem GitHub-Pages-Unterpfad eingebunden.');

const manifestPath = join(dist, 'manifest.webmanifest');
let manifest;
let manifestUrl;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifestUrl = new URL(manifestLink?.[1] ?? `${expectedBase}manifest.webmanifest`, siteOrigin);
} catch {
  fail('manifest.webmanifest fehlt oder ist kein gültiges JSON.');
}

if (manifest && manifestUrl) {
  if (manifest.name !== 'Progress Planner') fail('Manifestname ist nicht „Progress Planner“.');
  else pass('Manifestname ist korrekt.');
  const startUrl = new URL(manifest.start_url, manifestUrl);
  const scopeUrl = new URL(manifest.scope, manifestUrl);
  if (startUrl.pathname !== expectedBase || scopeUrl.pathname !== expectedBase) fail('Manifest-Start-URL und Scope müssen /progress-planner/ verwenden.');
  else pass('Manifest-Start-URL und Scope passen zum Projektpfad.');
  if (manifest.display !== 'standalone') fail('display ist nicht auf standalone gesetzt.');
  else pass('Standalone-Modus ist gesetzt.');

  for (const expectedSize of [192, 512]) {
    const icon = manifest.icons?.find((entry) => entry.sizes === `${expectedSize}x${expectedSize}` && entry.type === 'image/png');
    if (!icon) {
      fail(`Manifest enthält kein ${expectedSize}×${expectedSize} PNG-Icon.`);
      continue;
    }
    const iconUrl = new URL(icon.src, manifestUrl);
    const iconPath = outputPath(iconUrl);
    if (iconUrl.pathname !== `${expectedBase}icons/app-${expectedSize}.png` || !existsSync(iconPath)) {
      fail(`${expectedSize}×${expectedSize} Icon verweist nicht auf eine vorhandene Datei unter dem Projektpfad.`);
      continue;
    }
    const png = readFileSync(iconPath);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== expectedSize || height !== expectedSize) fail(`${icon.src} hat ${width}×${height} statt ${expectedSize}×${expectedSize}.`);
    else pass(`${expectedSize}×${expectedSize} PNG-Icon ist unter dem Projektpfad vorhanden.`);
    const purposes = icon.purpose?.split(/\s+/) ?? [];
    if (!purposes.includes('any') || !purposes.includes('maskable')) fail(`${icon.src} muss für any und maskable deklariert sein.`);
  }
}

if (!/name="apple-mobile-web-app-capable"\s+content="yes"/.test(html)) fail('iOS-Standalone-Metadaten fehlen.');
else pass('iOS-Web-App-Metadaten sind vorhanden.');
const appleIcon = html.match(/<link\s+rel="apple-touch-icon"\s+href="([^"]+)"/);
if (!appleIcon || !existsSync(outputPath(new URL(appleIcon[1], siteOrigin)))) fail('Apple Touch Icon fehlt oder liegt nicht unter dem Projektpfad.');
else pass('Apple Touch Icon ist unter dem Projektpfad eingebunden.');

const serviceWorkerPath = join(dist, 'sw.js');
let sw = '';
if (!existsSync(serviceWorkerPath)) fail('sw.js fehlt im Produktions-Build.');
else {
  sw = readFileSync(serviceWorkerPath, 'utf8');
  if (!sw.includes("new URL('./', self.location.href)") || !sw.includes('APP_BASE.pathname')) fail('Service Worker verwendet keinen scope-relativen Projektpfad.');
  else pass('Service Worker ermittelt den GitHub-Pages-Unterpfad relativ zu seiner URL.');
  if (!sw.includes("request.mode === 'navigate'") || !sw.includes('caches.match(APP_SHELL_URL)')) fail('Offline-Fallback für App-Navigation fehlt.');
  else pass('App-Shell kann unter dem Projektpfad offline geöffnet werden.');
  if (!sw.includes('html.matchAll') || !sw.includes('cache.addAll([...APP_SHELL, ...assets])')) fail('Service Worker cached die gebündelten Assets nicht.');
  else pass('Service Worker cached die gebündelten JS-/CSS-Dateien.');
}

const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))(?:\?[^"']*)?"/g)].map((match) => match[1]);
if (!assetRefs.length) fail('Gebündelte JavaScript- oder CSS-Dateien werden nicht referenziert.');
else {
  for (const asset of assetRefs) {
    const assetUrl = new URL(asset, siteOrigin);
    if (!assetUrl.pathname.startsWith(expectedBase) || !existsSync(outputPath(assetUrl))) fail(`Gebündelte Datei fehlt oder liegt außerhalb des Projektpfads: ${asset}`);
  }
  pass('Gebündelte JavaScript- und CSS-Dateien liegen unter /progress-planner/.');
}

const mainSource = readFileSync(join(process.cwd(), 'src', 'main.ts'), 'utf8');
if (!mainSource.includes('import.meta.env.BASE_URL') || !mainSource.includes('register(`${baseUrl}sw.js`, { scope: baseUrl })')) fail('Service Worker wird nicht relativ zur Vite-Basis registriert.');
else pass('Service Worker wird mit dem /progress-planner/-Scope registriert.');

const stylesheets = assetRefs.filter((asset) => asset.endsWith('.css'));
if (stylesheets.some((asset) => readFileSync(outputPath(new URL(asset, siteOrigin)), 'utf8').includes('safe-area-inset'))) pass('Mobile Safe-Area-Abstände sind in den Styles enthalten.');
else fail('Mobile Safe-Area-Abstände fehlen in den Styles.');

const sourceFiles = ['src/App.vue', 'src/storage.ts', 'src/main.ts'].map((file) => readFileSync(join(process.cwd(), file), 'utf8'));
if (sourceFiles.some((source) => /fetch\s*\(|\/api\//.test(source))) fail('App-Code enthält einen externen API-Aufruf.');
else pass('App-Code enthält keine API-Aufrufe.');
const appSource = sourceFiles[0];
const storageSource = sourceFiles[1];
if (!storageSource.includes('indexedDB.open') || !storageSource.includes("const HISTORY = 'history'")) fail('IndexedDB-Projekt- oder Verlaufspeicher fehlt.');
else pass('Projekte und Änderungsverlauf werden lokal in IndexedDB gespeichert.');
if (!appSource.includes('dataStore.exportBackup()') || !appSource.includes('dataStore.importBackup(backup)')) fail('JSON-Export oder -Import fehlt.');
else pass('JSON-Export und -Import sind in der Oberfläche verbunden.');
if (!storageSource.includes('navigator.storage?.persist')) fail('Die App bittet den Browser nicht um persistente lokale Speicherung.');
else pass('Persistente lokale Speicherung wird beim Browser angefragt.');

if (existsSync(join(repository, 'server')) || existsSync(join(repository, 'database'))) fail('Backend- oder Datenbankverzeichnis ist noch vorhanden.');
else pass('Build ist frei von Backend und MariaDB.');

const viteConfig = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const readme = readFileSync(join(repository, 'README.md'), 'utf8');
if (!viteConfig.includes("'/progress-planner/'") || !readme.includes('GitHub Pages')) fail('GitHub-Pages-Unterpfad oder Hosting-Anleitung fehlt.');
else pass('Build-Pfad und GitHub-Pages-Veröffentlichung sind dokumentiert.');

if (process.exitCode) process.exit(process.exitCode);
console.log('PWA-Dateien, Offline-App-Shell und GitHub-Pages-Pfade wurden geprüft.');
