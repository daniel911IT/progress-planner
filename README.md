# Progress Planner

Progress Planner ist eine responsive Webanwendung, um langfristige Ziele in Teilbereiche aufzuteilen und deren Fortschritt festzuhalten. Die Vue-Anwendung ist als Progressive Web App (PWA) installierbar.

## Lokale Entwicklung

Voraussetzungen: Node.js 20 oder neuer sowie Docker mit Docker Compose (oder eine lokal installierte MariaDB).

1. `.env.example` als `.env` im Projektordner kopieren.
2. MariaDB starten: `docker compose up -d database`
3. Abhängigkeiten installieren: `npm install`
4. Frontend und API starten: `npm run dev`
5. Die von Vite ausgegebene Adresse im Browser öffnen (standardmäßig `http://localhost:5173`).

Die API läuft standardmäßig auf Port 3001. Bei einer lokal installierten MariaDB können die Verbindungswerte in `.env` angepasst werden. Das Datenbankschema liegt in `database/schema.sql`; Docker Compose wendet es beim erstmaligen Anlegen des Datenbank-Volumes automatisch an. `localhost` gilt als sicherer Ursprung. Um die PWA lokal einschließlich Service Worker zu prüfen, baue sie mit `npm run build`, starte `npm --workspace client run preview` und öffne die ausgegebene localhost-Adresse. Der Service Worker wird bewusst nur im Produktions-Build registriert, damit der Vite-Entwicklungsserver keine veralteten Dateien cached.

## Produktivbetrieb mit HTTPS

Installationen auf Android und iOS benötigen eine öffentlich erreichbare HTTPS-Adresse. Das optionale Produktions-Setup verwendet Caddy für TLS-Zertifikate und die Weiterleitung von Web-App und API.

1. Richte für deine Domain einen DNS-A-Eintrag auf den Server ein. Die Ports 80 und 443 müssen von außen erreichbar sein.
2. Kopiere `.env.example` nach `.env` und trage deine Domain (`DOMAIN`) sowie sichere, eigene Werte für `DB_PASSWORD` und `DB_ROOT_PASSWORD` ein.
3. Starte die Produktivversion mit `docker compose -f docker-compose.production.yml up -d --build`.
4. Öffne `https://<deine-domain>` und prüfe, ob der Browser eine sichere Verbindung anzeigt. Caddy fordert das Zertifikat automatisch an und erneuert es.

`docker-compose.production.yml` hält die Datenbank im internen Docker-Netzwerk. Die API wird unter derselben HTTPS-Origin wie das Frontend bereitgestellt, damit Manifest, Service Worker und `/api` ohne Mixed Content funktionieren.

## PWA auf Android installieren

1. Öffne die HTTPS-Adresse in Chrome oder einem anderen PWA-fähigen Browser.
2. Tippe im Browsermenü auf **App installieren** oder **Zum Startbildschirm hinzufügen**. Je nach Browser kann auch ein Installationssymbol in der Adressleiste erscheinen.
3. Bestätige **Installieren**. Progress Planner erscheint danach auf dem Startbildschirm und in der App-Übersicht.

## PWA auf iPhone oder iPad installieren

1. Öffne die HTTPS-Adresse in **Safari**.
2. Tippe auf **Teilen** und dann auf **Zum Home-Bildschirm**.
3. Lass **Als Web-App öffnen** aktiviert, falls Safari diese Option anzeigt, und tippe auf **Hinzufügen**.
4. Starte Progress Planner über das neue Symbol auf dem Home-Bildschirm.

## PWA-Prüfung und Offline-Verhalten

- Das Web App Manifest (`client/public/manifest.webmanifest`) enthält den Namen, `start_url`, den `standalone`-Modus sowie die Icons in 192 × 192 und 512 × 512 Pixeln.
- Der Service Worker (`client/public/sw.js`) wird beim Produktions-Build registriert. Er cached die App-Oberfläche, die erzeugten JS-/CSS-Dateien und Icons; API-Aufrufe und Projektdaten werden bewusst nicht zwischengespeichert.
- Die Seite muss über HTTPS laufen. Für die lokale Entwicklung sind `localhost` und `127.0.0.1` sichere Ursprünge.
- Auf iOS sind zusätzlich Apple-Web-App-Metadaten und ein Touch-Icon eingebunden. Safe-Area-Abstände berücksichtigen Displayaussparungen und den Home-Indikator.
- Zum Prüfen auf Desktop-Chrome: **DevTools → Application → Manifest** sowie **Service Workers** öffnen. Dort sollten Name, Icons, `standalone` und ein aktiver Service Worker ohne Installationsfehler erscheinen.
- Automatische Build-Prüfung: `npm run check:pwa` baut Frontend und API und prüft anschließend Manifest, Icon-Abmessungen, Offline-Cache, Service-Worker-Registrierung, iOS-Metadaten und HTTPS-Konfiguration.

Die Oberfläche kann nach dem ersten Laden offline geöffnet werden. Änderungen an Projekten und Teilbereichen benötigen weiterhin eine Verbindung zur API und MariaDB.

## Aufbau

- `client/`: Vue 3, TypeScript, Tailwind CSS, Chart.js und responsive Oberfläche
- `server/`: Express API und MariaDB-Zugriff
- `database/schema.sql`: Tabellen und Datenbankbedingungen
- `client/public/manifest.webmanifest`: PWA-Manifest
- `client/public/sw.js`: Cache- und Offline-Verhalten
- `client/public/icons/`: App-Icons und SVG-Master
- `docker-compose.production.yml`, `Caddyfile`: HTTPS-Produktivbetrieb

Ein Projekt enthält beliebig viele Teilbereiche. Der Fortschritt wird pro Bereich in 5-%-Schritten gespeichert. Der Projektfortschritt ist das gewichtete Mittel der Teilbereiche; bei der Standardgewichtung 1 zählt jeder Bereich gleich viel. Ein Projekt ohne Teilbereiche startet bei 0 %.

## API

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- `POST /api/projects/:id/subareas`
- `PUT /api/subareas/:id`, `DELETE /api/subareas/:id`
