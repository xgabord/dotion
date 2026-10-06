# Dotion

Minimalista, Notion-like belső workspace a LAAVA / MATÉZZ / Matchai napi operációjához.

## MVP v0.1

- több felhasználós, jelszó nélküli belépés
- Home dashboard
- Task lista + Kanban
- státusz / prioritás / felelős / határidő
- jobbról nyíló task panel
- checklist + kommentek
- social media tartalomlista + egyszerű naptár
- termékfeltöltési állapot
- Inbox → feladat
- jegyzetek
- globális keresés (⌘K)
- responsive mobilnézet
- gyors hozzáadás
- JSON-alapú tartós adatmentés

A fókusz a specifikáció fő elve: **megnyitom → látom mit kell csinálnom → megcsinálom → készre állítom**.

## Futtatás

```bash
npm install
PORT=3004 npm start
```

Health check: `/health`

## xCloud

- App type: Node.js / SSR
- Port: `3004`
- Start command: `npm start`
- Node: 22+
- Ajánlott env:
  - `PORT=3004`

