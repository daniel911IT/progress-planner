# Progress Planner

Progress Planner ist eine responsive Webanwendung, um langfristige Ziele in Teilbereiche aufzuteilen und deren Fortschritt festzuhalten.

## Starten

Voraussetzungen: Node.js 20 oder neuer sowie Docker mit Docker Compose (oder eine lokal installierte MariaDB).

1. `.env.example` als `.env` im Projektordner kopieren und bei Bedarf Zugangsdaten anpassen.
2. MariaDB starten: `docker compose up -d database`
3. Abhängigkeiten installieren: `npm install`
4. Frontend und API starten: `npm run dev`
5. Die von Vite ausgegebene Adresse im Browser öffnen (standardmäßig `http://localhost:5173`).

Die API läuft standardmäßig auf Port 3001. Bei einer lokal installierten MariaDB können die Verbindungswerte in `.env` angepasst werden. Das Datenbankschema liegt in `database/schema.sql`; Docker Compose wendet es beim erstmaligen Anlegen des Datenbank-Volumes automatisch an.

## Aufbau

- `client/`: Vue 3, TypeScript, Tailwind CSS, Chart.js und responsive Oberfläche
- `server/`: Express API und MariaDB-Zugriff
- `database/schema.sql`: Tabellen und Datenbankbedingungen

Ein Projekt enthält beliebig viele Teilbereiche. Der Fortschritt wird pro Bereich in 5-%-Schritten gespeichert. Der Projektfortschritt ist das gewichtete Mittel der Teilbereiche; bei der Standardgewichtung 1 zählt jeder Bereich gleich viel. Ein Projekt ohne Teilbereiche startet bei 0 %.

## API

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- `POST /api/projects/:id/subareas`
- `PUT /api/subareas/:id`, `DELETE /api/subareas/:id`
