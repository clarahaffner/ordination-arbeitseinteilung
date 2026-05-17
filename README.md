# Ordination – Arbeitseinteilung (Online-Version)

Diese Anleitung führt Sie Schritt für Schritt durch das Veröffentlichen der App im Internet. Am Ende läuft die App unter einer eigenen URL (z.B. `https://ordination-meine-praxis.netlify.app`) und alle Daten werden zentral in Supabase gespeichert. Mitarbeiter und Ärzte können sich von überall aus anmelden, Änderungen erscheinen in Echtzeit bei allen.

**Sie brauchen ca. 30–45 Minuten und folgende kostenlosen Konten:**
- Ein **Supabase**-Konto (https://supabase.com) – kostenlos für unsere Datenmengen
- Ein **Netlify**-Konto (https://www.netlify.com) – kostenlos für interne Tools
- Optional: ein **GitHub**-Konto (https://github.com) für automatische Updates

---

## TEIL 1 – Datenbank bei Supabase einrichten

### 1.1 Konto erstellen

1. Öffnen Sie https://supabase.com und klicken Sie auf **Start your project**.
2. Registrieren Sie sich mit Ihrer E-Mail oder über GitHub.
3. Klicken Sie auf **New project**.

### 1.2 Projekt anlegen

1. **Name**: z.B. `ordination-arbeitseinteilung`
2. **Database Password**: Setzen Sie ein sicheres Passwort und **notieren Sie es sich**. Es wird normalerweise nicht gebraucht, aber gut, wenn Sie es haben.
3. **Region**: Wählen Sie eine Region in der Nähe, z.B. `Central EU (Frankfurt)`.
4. **Pricing Plan**: `Free`.
5. Klicken Sie auf **Create new project** und warten ca. 1 Minute, bis das Projekt bereit ist.

### 1.3 Datenbank-Tabelle anlegen

1. Im Supabase-Dashboard links auf **SQL Editor** klicken.
2. Auf **New query** klicken.
3. Den kompletten Inhalt der Datei `supabase-schema.sql` (aus diesem Projekt) hineinkopieren.
4. Rechts unten auf **Run** klicken.
5. Sie sollten „Success. No rows returned" sehen.

### 1.4 Zugangsdaten kopieren

1. Links im Menü auf das Zahnrad-Symbol **Settings** klicken.
2. Im Untermenü auf **API** klicken.
3. Sie sehen zwei wichtige Werte – kopieren Sie diese in ein temporäres Dokument:
   - **Project URL** (sieht aus wie `https://abcxyz.supabase.co`)
   - **Project API keys** → **anon public** (langer Text, beginnt mit `eyJ…`)

Den **service_role**-Key NICHT kopieren oder weitergeben – der ist geheim.

---

## TEIL 2 – App vorbereiten

Sie haben zwei Möglichkeiten, das Projekt zu Netlify zu bekommen. Die einfachste ist Variante A.

### Variante A – Per Drag-and-Drop (am einfachsten, kein Git nötig)

#### 2.A.1 Lokal vorbereiten

1. Installieren Sie **Node.js** (https://nodejs.org) – LTS-Version. Falls Sie es bereits haben, überspringen.
2. Entpacken Sie das Projekt-ZIP in einen Ordner, z.B. `Dokumente/ordination-app`.
3. Öffnen Sie ein Terminal/eine Eingabeaufforderung in diesem Ordner:
   - **Windows**: Im Datei-Explorer in den Ordner gehen, in die Adressleiste `cmd` tippen und Enter drücken.
   - **macOS**: Rechtsklick auf den Ordner → „Neues Terminal-Tab im Ordner".

#### 2.A.2 Konfiguration eintragen

1. Im Projektordner die Datei `.env.example` kopieren und in `.env` umbenennen.
2. `.env` mit einem Texteditor öffnen und die Werte aus Schritt 1.4 eintragen:
   ```
   VITE_SUPABASE_URL=https://abcxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   ```

#### 2.A.3 App bauen

Im Terminal eingeben:
```
npm install
npm run build
```

Das dauert 1–2 Minuten. Danach gibt es einen neuen Ordner `dist` mit der fertigen App.

#### 2.A.4 Bei Netlify hochladen

1. Bei https://app.netlify.com anmelden.
2. Unten auf der Übersichtsseite finden Sie ein Feld **„Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"**.
3. Den `dist`-Ordner aus dem Projekt dort hineinziehen.
4. Netlify lädt hoch und vergibt eine URL wie `https://funny-cat-123.netlify.app`.
5. Den Namen können Sie unter **Site settings → Change site name** anpassen, z.B. auf `ordination-meine-praxis`.

**Fertig!** Die App ist online. Wenn Sie etwas ändern, müssen Sie `npm run build` neu ausführen und den `dist`-Ordner erneut hochladen.

---

### Variante B – Über GitHub (etwas mehr Setup, dafür automatische Updates)

#### 2.B.1 GitHub-Repository erstellen

1. Bei https://github.com anmelden, oben rechts **+ → New repository**.
2. **Repository name**: z.B. `ordination-arbeitseinteilung`.
3. **Private** auswählen (damit nur Sie es sehen).
4. **Create repository** klicken.

#### 2.B.2 Projekt hochladen

Im Projektordner ein Terminal öffnen und:
```
git init
git add .
git commit -m "Erste Version"
git branch -M main
git remote add origin https://github.com/IHR-USER/ordination-arbeitseinteilung.git
git push -u origin main
```

#### 2.B.3 Bei Netlify verknüpfen

1. Bei Netlify auf **Add new site → Import an existing project**.
2. **GitHub** auswählen und Zugriff auf das Repository erlauben.
3. Repository auswählen.
4. **Build settings** (sollten automatisch korrekt sein):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Environment variables** hinzufügen (oben rechts auf der Seite):
   - `VITE_SUPABASE_URL` = Ihre Supabase-URL
   - `VITE_SUPABASE_ANON_KEY` = Ihr Anon-Key
6. **Deploy site** klicken. Nach 1–2 Minuten ist die App online.

Bei dieser Variante: Wenn Sie später am Code etwas ändern, einfach `git push` machen – Netlify baut die App automatisch neu.

---

## TEIL 3 – Erste Anmeldung

1. Die App-URL öffnen (z.B. `https://ordination-meine-praxis.netlify.app`).
2. Mit **Administrator** und Passwort `admin` anmelden.
3. **Wichtig: Sofort das Admin-Passwort ändern!** Im Code in `src/App.jsx` die Funktion `createInitialData` anpassen oder das Passwort über die DB-Konsole ändern.
4. Mitarbeiter und Ärzte unter „Mitarbeiter" und „Ärzte" anlegen.
5. Aufgaben unter „Aufgaben" anpassen, falls nötig.

---

## Wichtige Hinweise

### Sicherheit
- Diese Variante verwendet eine **einfache Passwort-Authentifizierung in der App selbst**, kein professionelles Login-System. Die Passwörter werden in der Datenbank im Klartext gespeichert. Das ist für eine interne Praxis-App akzeptabel, aber:
  - Geben Sie die URL nicht öffentlich weiter.
  - Verwenden Sie nicht das gleiche Passwort wie für andere Konten.
  - Wer die URL kennt und technisch versiert ist, könnte die Datenbank direkt auslesen.
- Für höhere Sicherheit kann später auf **Supabase Auth** (echte E-Mail-Anmeldung) umgestellt werden.

### Backups
- Supabase macht automatisch tägliche Backups (Free Plan: 7 Tage Aufbewahrung).
- Zusätzlich können Sie im Supabase-Dashboard unter **Database → Backups** manuell ein Backup erstellen.

### Echtzeit-Updates
- Wenn der Administrator einen Mitarbeiter zuteilt, sehen alle anderen eingeloggten Nutzer das innerhalb von 1–2 Sekunden automatisch.

### Bei Problemen
- **App lädt nicht / weißer Bildschirm**: Browser-Konsole öffnen (F12) und nach Fehlermeldungen suchen. Meist liegt es an falschen Supabase-Zugangsdaten.
- **Speicher-Indikator zeigt „Fehler"**: Verbindung zu Supabase prüfen, ggf. Browser-Cache leeren.
- **Anpassungen vornehmen**: Code-Datei ist `src/App.jsx`. Nach Änderungen `npm run build` und neu hochladen.

---

## Dateien im Projekt

| Datei | Was sie macht |
|---|---|
| `src/App.jsx` | Die komplette App (UI, Logik) |
| `src/lib/supabase.js` | Verbindung zur Datenbank |
| `src/main.jsx` | Startpunkt der React-App |
| `src/index.css` | Globale Stile |
| `index.html` | HTML-Grundgerüst |
| `package.json` | Liste der Abhängigkeiten |
| `vite.config.js` | Build-Konfiguration |
| `tailwind.config.js` | Styling-Framework-Konfiguration |
| `netlify.toml` | Netlify-Einstellungen |
| `supabase-schema.sql` | SQL für die Datenbank-Einrichtung |
| `.env.example` | Vorlage für die Konfiguration |

---

Viel Erfolg! Bei Fragen oder Problemen einfach Bescheid sagen.
