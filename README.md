# Progress Planner

Progress Planner ist eine private, lokale Vue-3-Webanwendung für iPhone und iPad. Projekte, Teilbereiche, Fortschritte und Änderungsverlauf werden in IndexedDB im Browser des Geräts gespeichert. Es gibt kein Backend, keine Datenbank außerhalb des Geräts, keine Anmeldung und keine Synchronisierung.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```sh
npm ci
npm run dev
```

Für einen lokalen PWA-Test einschließlich Service Worker:

```sh
npm run build
npm run preview
```

Vite zeigt die lokale Adresse an. `localhost` gilt als sicherer Ursprung; der Entwicklungsserver selbst registriert den Service Worker nicht, damit er während der Entwicklung keine veralteten Dateien ausliefert.

## Veröffentlichung als statische PWA

Das Projekt ist für Cloudflare Pages vorbereitet. Die Git-Integration unterstützt private GitHub-Repositories; das Repository bleibt privat. [Cloudflare Pages Git-Integration](https://developers.cloudflare.com/pages/configuration/git-integration/) · [Build-Einstellungen](https://developers.cloudflare.com/pages/configuration/build-configuration/)

1. In Cloudflare **Workers & Pages → Create application → Pages → Connect to Git** wählen und das private Progress-Planner-Repository verbinden.
2. Build-Einstellungen setzen:

   - Framework preset: `Vite`
   - Root directory: `/` (Repository-Wurzel)
   - Build command: `npm ci && npm run build`
   - Build output directory: `client/dist`
   - Environment variable: `NODE_VERSION=22`

3. Als Produktionsbranch den Branch wählen, den du veröffentlichen möchtest, und **Save and Deploy** starten.
4. Die fertige HTTPS-Adresse einmal in Safari auf dem iPhone öffnen und die App zum Home-Bildschirm hinzufügen.

Vite baut mit `base: '/'` für die Root-Adresse eines Pages-Projekts oder einer eigenen Domain. Behalte dieselbe Adresse nach der ersten Nutzung bei: IndexedDB ist an genau diese Origin gebunden. Wenn du später die Domain wechselst, exportiere vorher eine Sicherung und importiere sie unter der neuen Adresse.

Die Pages-Adresse ist standardmäßig über das Internet erreichbar, auch wenn das GitHub-Repository privat ist. Dort liegt ausschließlich der statische App-Code; alle Ziele bleiben in IndexedDB auf deinem iPhone. Der Hosting-Anbieter sieht trotzdem übliche Verbindungsmetadaten wie die IP-Adresse, mit der die statischen Dateien abgerufen werden. Es gibt keine API-Aufrufe, Analyse-Skripte, externen Schrift-CDNs oder Übertragung deiner Projektinhalte. Wenn auch die App-Seite selbst zugriffsbeschränkt sein soll, muss das beim Hosting separat eingerichtet werden.

## Auf dem iPhone installieren

1. Öffne die veröffentlichte HTTPS-Adresse in Safari.
2. Tippe auf **Teilen → Zum Home-Bildschirm**.
3. Lass **Als Web-App öffnen** aktiviert, falls Safari diese Option anzeigt, und tippe auf **Hinzufügen**.
4. Öffne Progress Planner über das neue Home-Bildschirm-Symbol.

Die App verwendet das Web App Manifest im Standalone-Modus, ein eigenes iOS-Touch-Icon und iOS-Safe-Area-Abstände. Der Service Worker cached App-Shell, Skripte, Styles und Icons. Daher lässt sich die Oberfläche nach dem ersten erfolgreichen Laden auch offline öffnen. Für ein iPhone-Backup wähle beim Export in der Teilen-Ansicht **In Dateien sichern → Auf meinem iPhone**.

## Daten und Sicherungen

- Alle Projekte, Teilbereiche und Fortschrittswerte werden lokal in IndexedDB gespeichert.
- Jede Erstellung, Bearbeitung, Fortschrittsänderung und Löschung wird als Verlaufseintrag lokal festgehalten und in der Projektansicht angezeigt.
- **Download-Symbol** exportiert einen JSON-Datenbestand mit Projekten, Teilbereichen und vollständigem Verlauf. Auf iOS öffnet sich dafür die Teilen-Ansicht.
- **Upload-Symbol** importiert eine Sicherung. Der Import prüft die Daten und ersetzt danach den gesamten aktuellen lokalen Datenbestand in einer IndexedDB-Transaktion.
- Für die einmalige Übernahme alter MariaDB-Daten öffne vor dem Abschalten des bisherigen Servers dessen `GET /api/projects`-Adresse im Browser und speichere die JSON-Antwort als Datei. Der Import akzeptiert dieses alte Array-Format und übernimmt Projekte sowie Teilbereiche. Die alte Anwendung hat keinen Änderungsverlauf gespeichert; frühere Verlaufseinträge können deshalb nicht rekonstruiert werden.
- Updates der App ändern nur den Cache des Service Workers. Das versionierte IndexedDB-Schema wird nicht gelöscht; spätere Schemaänderungen müssen über IndexedDB-Upgrades migriert werden.

IndexedDB bleibt nach dem Schließen der App erhalten. Der Browser darf lokale Daten aber löschen, wenn du Website-Daten oder die App entfernst oder das Gerät Speicher freigibt. Die App bittet den Browser zusätzlich um persistente Speicherung, sofern dieser sie unterstützt. Exportiere regelmäßig eine JSON-Sicherung; eine Gerätespeicherung ist kein Ersatz für ein Backup.

Verwende für Daten, die du behalten möchtest, den normalen Safari-Modus und entferne die Home-Bildschirm-App oder Website-Daten nicht. Änderungen werden an die Origin gebunden gespeichert und nicht automatisch auf iCloud oder ein anderes Gerät kopiert.

## PWA-Prüfung

```sh
npm run check:pwa
```

Der Befehl baut das Projekt und prüft Manifest, Standalone-Modus, PNG-Icon-Abmessungen, Apple-Metadaten, Service-Worker-Registrierung und Offline-Cache. Öffentliches Installieren erfordert HTTPS; Cloudflare Pages stellt die HTTPS-Adresse für das Projekt bereit.

## Projektstruktur

- `client/src/App.vue`: Dashboard, Projektverwaltung, Verlauf, Sicherungsimport und -export
- `client/src/storage.ts`: IndexedDB-Schema, lokale CRUD-Transaktionen, Änderungsverlauf und Backup-Validierung
- `client/public/manifest.webmanifest`: Name, Icons, Start-URL und Standalone-Modus
- `client/public/sw.js`: versionierter Cache der statischen App-Dateien
- `client/public/icons/`: PNG-App-Icons und SVG-Master
- `client/vite.config.ts`: Vite-Build für statisches Hosting an der Origin-Wurzel
