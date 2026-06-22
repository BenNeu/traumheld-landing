# Ratgeber-System – Anleitung für den Content-Creator

Dieses System macht aus einem Markdown-Artikel plus einem Bild eine fertige, SEO-optimierte Seite auf `mein-traumheld.de/ratgeber/`. Kein Framework, keine Abhängigkeiten, reines Node.

## Workflow in 4 Schritten

### 1. Artikel als Markdown anlegen
Lege eine neue Datei an unter:

```
ratgeber-src/articles/DEIN-SLUG.md
```

Beginne die Datei mit diesem Frontmatter-Block (zwischen den `---`), danach folgt der Artikeltext als Markdown:

```markdown
---
title: "Die Überschrift des Artikels"
description: "1 bis 2 Sätze für Google und das Teilen. Max. 155 Zeichen."
slug: dein-slug
date: 2026-06-22
author: Ben Neuendorf
category: Einschlafen
keywords: hauptkeyword, nebenkeyword, noch eins
image: images/dein-slug.jpg
imageAlt: "Bildbeschreibung für Google und Screenreader"
---

Hier beginnt der Artikel. Normale Absätze einfach durch Leerzeilen trennen.

## Zwischenüberschrift

Text, **fett**, [Link](https://mein-traumheld.de), Listen:

- Punkt eins
- Punkt zwei

> Ein hervorgehobenes Zitat.
```

**Frontmatter-Felder:**

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `title` | ja | Überschrift, erscheint als H1 und im Browser-Tab |
| `description` | ja | Meta-Description für Google, max. 155 Zeichen |
| `slug` | empfohlen | Datei- und URL-Name, nur Kleinbuchstaben und Bindestriche. Fehlt er, wird er aus dem Titel erzeugt |
| `date` | ja | Format `JJJJ-MM-TT`, steuert die Sortierung |
| `author` | nein | Standard: Mein Traumheld |
| `category` | nein | Kleines Label über dem Titel, z. B. Einschlafen |
| `keywords` | nein | Kommagetrennt, für die Meta-Keywords |
| `image` | empfohlen | Pfad zum Hero-Bild, siehe Schritt 2. Ohne Bild gibt es einen dezenten Farbverlauf |
| `imageAlt` | empfohlen | Bildbeschreibung |

### 2. Bild ablegen
Speichere das Artikelbild unter:

```
ratgeber/images/dein-slug.jpg
```

Empfehlung: Querformat 16:9, ca. 1600 x 900 px, als JPG. Der `image:`-Pfad im Frontmatter ist dann `images/dein-slug.jpg`.

### 3. Build ausführen
Im Ordner `landing-page/`:

```bash
node build-ratgeber.js
```

Das Skript erzeugt automatisch:
- die Artikelseite `ratgeber/dein-slug.html` mit allen SEO-Tags, Open Graph und Article-Schema
- die aktualisierte Übersicht `ratgeber/index.html`
- eine frische `sitemap.xml` und `robots.txt`

### 4. Veröffentlichen (Commit und Push)
Coolify deployt automatisch bei jedem Push. Befehl:

```bash
cd "landing-page" && git add . && git commit -m "Neuer Ratgeber-Artikel: DEIN-SLUG" && git push
```

Nach ein bis zwei Minuten ist der Artikel live unter `https://mein-traumheld.de/ratgeber/dein-slug.html`.

## Was Markdown hier kann
Überschriften `##` bis `####`, Absätze, **fett**, *kursiv*, `Inlinecode`, Links, Bilder, Aufzählungen (`-`), nummerierte Listen (`1.`), Zitate (`>`), Trennlinie (`---`).

## Ordnerübersicht

```
landing-page/
├── build-ratgeber.js          ← das Build-Skript (nicht ändern nötig)
├── sitemap.xml                ← automatisch erzeugt
├── robots.txt                 ← automatisch erzeugt
├── ratgeber-src/
│   ├── articles/              ← HIER schreibst du die .md-Artikel
│   └── templates/             ← Design und Layout (article.html, index.html, styles.css)
└── ratgeber/
    ├── index.html             ← Blog-Übersicht (automatisch)
    ├── *.html                 ← fertige Artikel (automatisch)
    ├── ratgeber.css           ← Style (automatisch kopiert)
    └── images/                ← HIER liegen die Artikelbilder
```

## SEO-Hinweise für gute Rankings
- **Ein Hauptkeyword pro Artikel.** Es sollte im Titel, in der Description und in der ersten Zwischenüberschrift vorkommen.
- **Description unter 155 Zeichen**, neugierig machend, mit dem Keyword.
- **Slug kurz und sprechend**, z. B. `einschlafrituale-kinder`, nicht `artikel-1`.
- **Mindestens 600 Wörter** pro Artikel, lieber mehr. Google bevorzugt gründliche Inhalte.
- **Interne Links**: im Text gern auf andere Ratgeber-Artikel verlinken, sobald es mehrere gibt.
- **Bild immer mit `imageAlt`** beschreiben.

## Wiederverwertung für Social Media (GaryVee-Pipeline)
Jeder Artikel ist die Quelle für mehrere Posts:
1. **Headline** → Green-Screen-Reel, in dem Ben über das Thema spricht.
2. **Kernpunkte** → Instagram-Carousel.
3. **Eine Kernaussage** → Caption oder Story.

So wird aus einem geschriebenen Artikel eine ganze Woche Content.
