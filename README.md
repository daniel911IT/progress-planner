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

Vite zeigt die lokale Vorschau unter `/progress-planner/` an. `localhost` gilt als sicherer Ursprung; der Entwicklungsserver selbst registriert den Service Worker nicht, damit er während der Entwicklung keine veralteten Dateien ausliefert.

## Veröffentlichung über GitHub Pages

Der Workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) baut die App bei jedem Push auf `main` und veröffentlicht `client/dist` über GitHub Pages. Der Produktionsbuild verwendet den Projektpfad `/progress-planner/`; Manifest, Icons, gebündelte Assets und Service Worker bleiben innerhalb dieses Pfads.

1. Lade den Workflow auf den Branch `main` hoch.
2. Öffne das Repository auf GitHub und gehe zu **Settings → Pages**.
3. Stelle unter **Build and deployment → Source** die Option **GitHub Actions** ein.
4. Prüfe unter **Actions**, ob der Lauf „Deploy Progress Planner to GitHub Pages“ erfolgreich war.
5. Die Projektseite wird unter `https://daniel911IT.github.io/progress-planner/` erreichbar sein. Öffne sie einmal in Safari und füge sie über **Teilen → Zum Home-Bildschirm** hinzu.

Weitere Build-Einstellungen sind nicht nötig: Der Workflow verwendet Node.js 22, `npm ci`, `npm run build` und lädt `client/dist` als Pages-Artefakt hoch. Er benötigt keinen `gh-pages`-Branch.

**Sichtbarkeit:** GitHub Pages-Websites sind grundsätzlich öffentlich erreichbar, auch wenn das Quellrepository privat ist. Private Pages-Veröffentlichung erfordert GitHub Enterprise Cloud. Im veröffentlichten App-Code befinden sich keine Nutzerdaten; Projekte, Teilbereiche, Achievements und Verlauf bleiben in IndexedDB auf dem Gerät. GitHub sieht beim Abruf der App übliche Verbindungsmetadaten. [GitHub-Dokumentation zu Pages-Veröffentlichungsquellen und Sichtbarkeit](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Die lokale Datenbank ist an die exakte Origin gebunden. Wenn du die Domain oder den Pfad änderst, exportiere vorher eine JSON-Sicherung und importiere sie auf der neuen Adresse.

## Auf dem iPhone installieren

1. Öffne die veröffentlichte HTTPS-Adresse in Safari.
2. Tippe auf **Teilen → Zum Home-Bildschirm**.
3. Lass **Als Web-App öffnen** aktiviert, falls Safari diese Option anzeigt, und tippe auf **Hinzufügen**.
4. Öffne Progress Planner über das neue Home-Bildschirm-Symbol.

Die App verwendet das Web App Manifest im Standalone-Modus, ein eigenes iOS-Touch-Icon und iOS-Safe-Area-Abstände. Der Service Worker cached App-Shell, Skripte, Styles und Icons. Daher lässt sich die Oberfläche nach dem ersten erfolgreichen Laden auch offline öffnen. Für ein iPhone-Backup wähle beim Export in der Teilen-Ansicht **In Dateien sichern → Auf meinem iPhone**.

## Daten und Sicherungen

- Projekte, Teilbereiche, Fortschrittswerte, Achievements und Änderungsverlauf werden lokal in IndexedDB gespeichert.
- Jede Erstellung, Bearbeitung, Fortschrittsänderung und Löschung wird als Verlaufseintrag lokal festgehalten und in der Projektansicht angezeigt.
- **Download-Symbol** exportiert einen JSON-Datenbestand mit Projekten, Teilbereichen, Achievements und vollständigem Verlauf. Auf iOS öffnet sich dafür die Teilen-Ansicht.
- **Upload-Symbol** importiert eine Sicherung. Der Import prüft die Daten und ersetzt danach den gesamten aktuellen lokalen Datenbestand in einer IndexedDB-Transaktion.
- Für die einmalige Übernahme alter MariaDB-Daten öffne vor dem Abschalten des bisherigen Servers dessen `GET /api/projects`-Adresse im Browser und speichere die JSON-Antwort als Datei. Der Import akzeptiert dieses alte Array-Format und übernimmt Projekte sowie Teilbereiche. Die alte Anwendung hat keinen Änderungsverlauf gespeichert; frühere Verlaufseinträge können deshalb nicht rekonstruiert werden.
- Updates der App ändern nur den Cache des Service Workers. Das versionierte IndexedDB-Schema wird nicht gelöscht; spätere Schemaänderungen müssen über IndexedDB-Upgrades migriert werden.

IndexedDB bleibt nach dem Schließen der App erhalten. Der Browser darf lokale Daten aber löschen, wenn du Website-Daten oder die App entfernst oder das Gerät Speicher freigibt. Die App bittet den Browser zusätzlich um persistente Speicherung, sofern dieser sie unterstützt. Exportiere regelmäßig eine JSON-Sicherung; eine Gerätespeicherung ist kein Ersatz für ein Backup.

Verwende für Daten, die du behalten möchtest, den normalen Safari-Modus und entferne die Home-Bildschirm-App oder Website-Daten nicht. Änderungen werden an die Origin gebunden gespeichert und nicht automatisch auf iCloud oder ein anderes Gerät kopiert.

## PWA-Prüfung

```sh
npm run check:pwa
```

Der Befehl baut das Projekt und prüft Manifest, `/progress-planner/`-Pfade, Standalone-Modus, PNG-Icon-Abmessungen, Apple-Metadaten, Service-Worker-Scope und Offline-Cache. GitHub Pages stellt die HTTPS-Adresse bereit.

## Projektstruktur

- `client/src/App.vue`: Dashboard, Projektverwaltung, Verlauf, Sicherungsimport und -export
- `client/src/storage.ts`: IndexedDB-Schema, lokale CRUD-Transaktionen, Änderungsverlauf und Backup-Validierung
- `client/public/manifest.webmanifest`: Name, Icons, Start-URL und Standalone-Modus
- `client/public/sw.js`: versionierter Cache der statischen App-Dateien
- `client/public/icons/`: PNG-App-Icons und SVG-Master
- `client/vite.config.ts`: lokale Entwicklung an `/`, Produktionsbuild für `/progress-planner/`
- `.github/workflows/deploy-pages.yml`: Build und automatische Veröffentlichung auf GitHub Pages
