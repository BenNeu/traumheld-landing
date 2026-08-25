#!/usr/bin/env node
/**
 * Mein Traumheld – Ratgeber Build
 * --------------------------------
 * Wandelt Markdown-Artikel aus ratgeber-src/articles/ in fertige HTML-Seiten um,
 * baut die Blog-Uebersicht (ratgeber/index.html), sitemap.xml und robots.txt.
 *
 * Aufruf:  node build-ratgeber.js
 * Keine externen Abhaengigkeiten noetig (reines Node).
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://mein-traumheld.de';
const SRC = path.join(ROOT, 'ratgeber-src', 'articles');
const TPL = path.join(ROOT, 'ratgeber-src', 'templates');
const OUT = path.join(ROOT, 'ratgeber');
// Zweiter Bereich: die kostenlosen Gute-Nacht-Geschichten unter /geschichten/.
// Eigener Quell- und Ausgabeordner, aber dasselbe Skript – sonst wuerden sich
// die beiden Laeufe gegenseitig die sitemap.xml ueberschreiben.
const SRC_G = path.join(ROOT, 'ratgeber-src', 'geschichten');
const OUT_G = path.join(ROOT, 'geschichten');
const YEAR = new Date().getFullYear();

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// ---------- Helpers ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}
function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Frontmatter ----------
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  });
  return { data, body: m[2] };
}

// ---------- Inline Markdown ----------
function inline(text) {
  let t = esc(text);
  // images  ![alt](src)
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${escAttr(src)}" alt="${escAttr(alt)}" loading="lazy">`);
  // links  [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${escAttr(url)}">${label}</a>`);
  // bold  **text**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic  *text*  or  _text_
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  // inline code  `code`
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

// ---------- Block Markdown ----------
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];

    // blank
    if (/^\s*$/.test(line)) { i++; continue; }

    // heading  ## / ### / ####
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const txt = h[2].trim();
      out.push(`<h${level} id="${slugify(txt)}">${inline(txt)}</h${level}>`);
      i++; continue;
    }

    // horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, '')); i++;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`); i++;
      }
      out.push(`<ul>${buf.join('')}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`); i++;
      }
      out.push(`<ol>${buf.join('')}</ol>`);
      continue;
    }

    // paragraph (collect until blank or block start)
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i])
        && !/^(#{2,4})\s/.test(lines[i])
        && !/^\s*>\s?/.test(lines[i])
        && !/^\s*[-*+]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])
        && !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' ').trim())}</p>`);
  }
  return out.join('\n');
}

function wordCount(md) {
  return md.replace(/[#>*`_\-]/g, ' ').split(/\s+/).filter(Boolean).length;
}

// ---------- FAQ-Extraktion (fuer FAQPage-Schema / GEO) ----------
// Erkennt eine H2-Sektion "Häufige Fragen" (oder "FAQ") und liest darin
// fettgedruckte Fragen (**Frage?**) mit den folgenden Absaetzen als Antwort.
function plainText(md) {
  return md
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
function extractFaq(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const faqs = [];
  let inFaq = false;
  let current = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (inFaq) { if (current && current.a.length) faqs.push(current); current = null; }
      inFaq = /häufige fragen|haeufige fragen|faq/i.test(h2[1]);
      continue;
    }
    if (!inFaq) continue;
    const q = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (q) {
      if (current && current.a.length) faqs.push(current);
      current = { q: plainText(q[1]), a: [] };
      continue;
    }
    if (current && line.trim()) current.a.push(plainText(line));
  }
  if (current && current.a.length) faqs.push(current);
  return faqs.map(f => ({ q: f.q, a: f.a.join(' ') }));
}

// ---------- Load ----------
const articleTpl = fs.readFileSync(path.join(TPL, 'article.html'), 'utf8');
const indexTpl = fs.readFileSync(path.join(TPL, 'index.html'), 'utf8');

// Copy stylesheet into output
fs.copyFileSync(path.join(TPL, 'styles.css'), path.join(OUT, 'ratgeber.css'));

if (!fs.existsSync(SRC)) { console.error('Kein articles-Ordner gefunden:', SRC); process.exit(1); }
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.md'));

const articles = [];
for (const file of files) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  if (!data.title) { console.warn('WARN: ueberspringe (kein title):', file); continue; }

  const slug = data.slug || slugify(data.title);
  const date = data.date || new Date().toISOString().slice(0, 10);
  const author = data.author || 'Mein Traumheld';
  const category = data.category || 'Ratgeber';
  const description = data.description || '';
  const keywords = data.keywords || '';
  const image = data.image ? (data.image.startsWith('http') ? data.image : `/ratgeber/${data.image.replace(/^\/?ratgeber\//, '')}`) : '';
  const imageAlt = data.imageAlt || data.title;
  const url = `${SITE}/ratgeber/${slug}.html`;
  const readingTime = Math.max(1, Math.round(wordCount(body) / 200));

  const bodyHtml = mdToHtml(body);

  const hero = image
    ? `<img class="hero-img" src="${escAttr(image)}" alt="${escAttr(imageAlt)}">`
    : `<div class="hero-grad"></div>`;
  const ogImage = image ? (image.startsWith('http') ? image : SITE + image) : `${SITE}/logo.png`;

  const schemaBlocks = [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: description,
    image: ogImage,
    datePublished: date,
    dateModified: date,
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'Mein Traumheld',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Ratgeber', item: `${SITE}/ratgeber/` },
      { '@type': 'ListItem', position: 3, name: data.title, item: url }
    ]
  }];

  // FAQPage-Schema, wenn der Artikel eine FAQ-Sektion hat (SEO + GEO)
  const faqs = extractFaq(body);
  if (faqs.length) {
    schemaBlocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }
  const jsonld = JSON.stringify(schemaBlocks);

  const html = articleTpl
    .replace(/{{TITLE}}/g, escAttr(data.title))
    .replace(/{{DESCRIPTION}}/g, escAttr(description))
    .replace(/{{KEYWORDS}}/g, escAttr(keywords))
    .replace(/{{AUTHOR}}/g, escAttr(author))
    .replace(/{{CATEGORY}}/g, escAttr(category))
    .replace(/{{CANONICAL}}/g, url)
    .replace(/{{OG_IMAGE}}/g, escAttr(ogImage))
    .replace(/{{DATE_ISO}}/g, date)
    .replace(/{{DATE_DISPLAY}}/g, fmtDate(date))
    .replace(/{{READING_TIME}}/g, readingTime)
    .replace(/{{JSONLD}}/g, jsonld)
    .replace(/{{HERO}}/g, hero)
    .replace(/{{ARTICLE_BODY}}/g, bodyHtml)
    .replace(/{{YEAR}}/g, YEAR);

  fs.writeFileSync(path.join(OUT, `${slug}.html`), html);
  articles.push({ slug, title: data.title, description, date, category, image, imageAlt, url });
  console.log('✓ Artikel gebaut:', `${slug}.html`);
}

// Sort newest first
articles.sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- Index ----------
const cards = articles.map(a => {
  const thumb = a.image
    ? `<img class="card-thumb" src="${escAttr(a.image)}" alt="${escAttr(a.imageAlt)}" loading="lazy">`
    : `<div class="card-thumb"></div>`;
  return `      <a class="card" href="/ratgeber/${a.slug}.html">
        ${thumb}
        <div class="card-body">
          <span class="eyebrow">${escAttr(a.category)}</span>
          <h2>${esc(a.title)}</h2>
          <p>${esc(a.description)}</p>
          <div class="card-meta">${fmtDate(a.date)}</div>
        </div>
      </a>`;
}).join('\n');

const indexHtml = indexTpl
  .replace('{{CARDS}}', cards || '<p style="color:#9999cc">Bald gibt es hier die ersten Artikel.</p>')
  .replace(/{{YEAR}}/g, YEAR);
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
console.log('✓ Blog-Index gebaut: ratgeber/index.html');

// ---------- GESCHICHTEN ----------
// Kostenlose Gute-Nacht-Geschichten unter /geschichten/. Warum eigener Bereich:
// Fuer "gute nacht geschichten" (56.800 Suchen/Monat, Difficulty 17) liefert
// Google ausschliesslich Sammlungen mit echten Geschichten – kein einziger
// Ratgeber steht in den Top 8. Die Ratgeber-Artikel koennen darauf nicht
// ranken, weil sie ueber Geschichten schreiben statt welche zu sein.
const geschichten = [];
if (fs.existsSync(SRC_G)) {
  if (!fs.existsSync(OUT_G)) fs.mkdirSync(OUT_G, { recursive: true });
  const storyTpl = fs.readFileSync(path.join(TPL, 'story.html'), 'utf8');
  const storyIndexTpl = fs.readFileSync(path.join(TPL, 'story-index.html'), 'utf8');

  for (const file of fs.readdirSync(SRC_G).filter(f => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(SRC_G, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    if (!data.title) { console.warn('WARN: ueberspringe (kein title):', file); continue; }

    const slug = data.slug || slugify(data.title);
    const date = data.date || new Date().toISOString().slice(0, 10);
    const alter = data.category || 'Zum Vorlesen';
    const description = data.description || '';
    const url = `${SITE}/geschichten/${slug}.html`;
    // Vorlesezeit steht im Frontmatter; fehlt sie, aus der Wortzahl schaetzen.
    // 130 Woerter je Minute – Vorlesen ist langsamer als Lesen.
    const vorlesezeit = data.lesezeit || `${Math.max(1, Math.round(wordCount(body) / 130))} Minuten`;
    const image = data.image ? (data.image.startsWith('http') ? data.image : `/geschichten/${data.image.replace(/^\/?geschichten\//, '')}`) : '';
    const ogImage = image ? (image.startsWith('http') ? image : SITE + image) : `${SITE}/logo.png`;
    const hero = image
      ? `<img class="hero-img" src="${escAttr(image)}" alt="${escAttr(data.imageAlt || data.title)}">`
      : `<div class="hero-grad"></div>`;

    const schema = [{
      '@context': 'https://schema.org',
      '@type': 'ShortStory',
      name: data.title,
      headline: data.title,
      description: description,
      inLanguage: 'de',
      typicalAgeRange: alter.replace(/\s*Jahre\s*$/, '').replace('–', '-'),
      datePublished: date,
      author: { '@type': 'Organization', name: 'Mein Traumheld' },
      publisher: {
        '@type': 'Organization',
        name: 'Mein Traumheld',
        logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` }
      },
      isPartOf: { '@type': 'CollectionPage', name: 'Gute-Nacht-Geschichten zum Vorlesen', '@id': `${SITE}/geschichten/` },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Gute-Nacht-Geschichten', item: `${SITE}/geschichten/` },
        { '@type': 'ListItem', position: 3, name: data.title, item: url }
      ]
    }];

    const html = storyTpl
      .replace(/{{TITLE}}/g, escAttr(data.title))
      .replace(/{{DESCRIPTION}}/g, escAttr(description))
      .replace(/{{KEYWORDS}}/g, escAttr(data.keywords || ''))
      .replace(/{{AUTHOR}}/g, escAttr(data.author || 'Mein Traumheld'))
      .replace(/{{CATEGORY}}/g, escAttr(alter))
      .replace(/{{CANONICAL}}/g, url)
      .replace(/{{OG_IMAGE}}/g, escAttr(ogImage))
      .replace(/{{DATE_ISO}}/g, date)
      .replace(/{{VORLESEZEIT}}/g, escAttr(vorlesezeit))
      .replace(/{{JSONLD}}/g, JSON.stringify(schema))
      .replace(/{{HERO}}/g, hero)
      .replace(/{{ARTICLE_BODY}}/g, mdToHtml(body))
      .replace(/{{RATGEBER_LINK}}/g, escAttr(data.ratgeberLink || '/ratgeber/'))
      .replace(/{{RATGEBER_TEXT}}/g, esc(data.ratgeberText || 'Alle Ratgeber-Artikel'))
      .replace(/{{YEAR}}/g, YEAR);

    fs.writeFileSync(path.join(OUT_G, `${slug}.html`), html);
    geschichten.push({ slug, title: data.title, description, date, alter, vorlesezeit, url, image, imageAlt: data.imageAlt || data.title });
    console.log('✓ Geschichte gebaut:', `${slug}.html`);
  }

  // Uebersicht nach Alter gruppiert. Die Reihenfolge ist fest, nicht
  // alphabetisch – von den Kleinsten aufwaerts.
  const REIHENFOLGE = ['3–5 Jahre', '5–6 Jahre', '6–8 Jahre'];
  const gruppen = {};
  for (const g of geschichten) (gruppen[g.alter] = gruppen[g.alter] || []).push(g);
  const bekannt = REIHENFOLGE.filter(a => gruppen[a]);
  const uebrige = Object.keys(gruppen).filter(a => !REIHENFOLGE.includes(a)).sort();

  const gruppenHtml = [...bekannt, ...uebrige].map(alter => {
    const karten = gruppen[alter].map(g => {
      const thumb = g.image
        ? `<img class="card-thumb" src="${escAttr(g.image)}" alt="${escAttr(g.imageAlt)}" loading="lazy">`
        : `<div class="card-thumb"></div>`;
      return `      <a class="card" href="/geschichten/${g.slug}.html">
        ${thumb}
        <div class="card-body">
          <span class="eyebrow">${escAttr(g.alter)}</span>
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.description)}</p>
          <div class="card-meta">${escAttr(g.vorlesezeit)} Vorlesezeit</div>
        </div>
      </a>`;
    }).join('\n');
    return `    <h2 class="index-head" style="margin-top:2rem">Geschichten für ${esc(alter)}</h2>\n    <div class="card-grid">\n${karten}\n    </div>`;
  }).join('\n\n');

  const sammlungSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Gute-Nacht-Geschichten zum Vorlesen',
    description: 'Kostenlose Gute-Nacht-Geschichten zum Vorlesen fuer Kinder von 3 bis 8 Jahren.',
    inLanguage: 'de',
    url: `${SITE}/geschichten/`,
    hasPart: geschichten.map(g => ({ '@type': 'ShortStory', name: g.title, url: g.url }))
  };

  const indexG = storyIndexTpl
    .replace('{{GRUPPEN}}', gruppenHtml || '<p style="color:#9999cc">Bald gibt es hier die ersten Geschichten.</p>')
    .replace(/{{JSONLD}}/g, JSON.stringify(sammlungSchema))
    .replace(/{{YEAR}}/g, YEAR);
  fs.writeFileSync(path.join(OUT_G, 'index.html'), indexG);
  console.log('✓ Geschichten-Index gebaut: geschichten/index.html');
}

// ---------- Sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, lastmod: today, priority: '1.0' },
  { loc: `${SITE}/ratgeber/`, lastmod: today, priority: '0.8' },
  { loc: `${SITE}/geschichten/`, lastmod: today, priority: '0.9' },
  ...geschichten.map(g => ({ loc: g.url, lastmod: g.date, priority: '0.7' })),
  ...articles.map(a => ({ loc: a.url, lastmod: a.date, priority: '0.7' })),
  { loc: `${SITE}/impressum.html`, lastmod: today, priority: '0.3' },
  { loc: `${SITE}/datenschutz.html`, lastmod: today, priority: '0.3' },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('✓ sitemap.xml gebaut');

// ---------- robots.txt ----------
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
console.log('✓ robots.txt gebaut');

// ---------- llms.txt (GEO: strukturierter Einstieg fuer KI-Crawler) ----------
const byCategory = {};
for (const a of articles) {
  (byCategory[a.category] = byCategory[a.category] || []).push(a);
}
const nachAlter = {};
for (const g of geschichten) (nachAlter[g.alter] = nachAlter[g.alter] || []).push(g);
const geschichtenSektion = geschichten.length
  ? Object.keys(nachAlter).sort().map(alter =>
      `## Gute-Nacht-Geschichten: ${alter}\n\n` +
      nachAlter[alter].map(g => `- [${g.title}](${g.url}): ${g.description}`).join('\n')
    ).join('\n\n')
  : '';

const llmsSections = Object.keys(byCategory).sort().map(cat =>
  `## Ratgeber: ${cat}\n\n` +
  byCategory[cat].map(a => `- [${a.title}](${a.url}): ${a.description}`).join('\n')
).join('\n\n');

const llms = `# Mein Traumheld

> Mein Traumheld ist eine App fuer personalisierte Gute-Nacht-Geschichten. Jeden Abend erhaelt das Kind vollautomatisch eine neue, professionell vertonte Hoergeschichte, in der es selbst der Held ist (eigener Name, Alter, Interessen, Haustiere, Freunde). 14 Tage kostenlos testbar, danach ab 9,99 Euro/Monat (Standard: 1 Geschichte/Woche) oder 44,99 Euro/Monat (Premium: taeglich eine neue Geschichte). Daten werden auf Servern in Deutschland gespeichert. Verfuegbar im Apple App Store, Google Play folgt.

Zielgruppe: Eltern von Kindern zwischen 3 und 10 Jahren, die ein verlaessliches, ruhiges Abendritual suchen.

## Wichtige Seiten

- [Startseite mit Gratis-Hoerprobe und Preisen](${SITE}/): Produktueberblick, kostenlose Beispielgeschichte zum Anhoeren, Preise und Plaene
- [Ratgeber-Uebersicht](${SITE}/ratgeber/): Alle Elternratgeber zu Einschlafen, Ritualen, Geschichten und kindlichen Gefuehlen
- [Gute-Nacht-Geschichten zum Vorlesen](${SITE}/geschichten/): Kostenlose Geschichten zum Vorlesen, nach Alter sortiert

${geschichtenSektion}

${llmsSections}

## Rechtliches

- [Impressum](${SITE}/impressum.html)
- [Datenschutz](${SITE}/datenschutz.html)
`;
fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);
console.log('✓ llms.txt gebaut');

console.log(`\nFertig. ${articles.length} Artikel und ${geschichten.length} Geschichten verarbeitet.`);
