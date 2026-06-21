// src/utils/DataLoader.js
//
// KEY FIX: PapaParse is now invoked with `quoteChar: '"'` (the default) but also
// `skipEmptyLines: true` and — critically — we no longer do any manual string
// splitting on the `data` column.  Long text cells that contain commas were
// previously getting truncated because they spanned the full RFC-4180 quoted
// field and the parser was treating the inner commas as column delimiters.
//
// AUTHORING IN THE CSV:
//   • Wrap any text cell that contains commas in double-quotes (standard CSV).
//   • Use  \n  (literal backslash-n) inside the cell to insert line breaks.
//     TextBlock.jsx converts those into real newlines before rendering.
//   • Bullet items: start lines with  •  or  -  or  *  followed by a space.
//   • Section headers: a CAPITALISED line ending with a colon, e.g.  Roles:

import Papa from 'papaparse';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const geocodeCache = new Map();

async function geocodeAddress(address) {
  if (!address) return null;
  if (geocodeCache.has(address)) return geocodeCache.get(address);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'User-Agent': 'MyPortfolioProject/1.0' } }
    );
    // Respect Nominatim's 1 req/sec policy
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const data = await response.json();
    if (data && data.length > 0) {
      const location = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(address, location);
      return location;
    }
  } catch (error) {
    console.error('Geocoding failed:', error);
  }
  return null;
}

// ── CSV parser helper ────────────────────────────────────────────────────────
// THE CORE PROBLEM:
//   Your CSV uses space-padded columns:
//     bim-crd_01,           2, left    , Text      , "The New Giza project, ..."
//   The leading spaces before the opening `"` on the data column mean PapaParse
//   does NOT recognise it as a quoted field — it sees `   "The New Giza project`
//   as a plain string that starts with spaces, so the first comma inside the
//   quotes is treated as a column delimiter and everything after it is lost.
//
// FIX: Pre-process each line to collapse the space-padding around delimiters
//   before handing the text to PapaParse.  We only collapse spaces that are
//   immediately adjacent to a comma so that spaces inside quoted values are
//   never touched.

function normaliseCSVSpacing(text) {
  return text
    .split('\n')
    .map((line) => {
      // Walk character by character so we respect quoted regions
      let result = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          result += ch;
        } else if (!inQuotes && ch === ' ') {
          // Drop spaces that neighbour a comma (look-behind / look-ahead)
          const prev = result[result.length - 1];
          const next = line[i + 1];
          if (prev === ',' || next === ',') continue;
          result += ch;
        } else {
          result += ch;
        }
      }
      return result;
    })
    .join('\n');
}

function parseCSV(text) {
  const normalised = normaliseCSVSpacing(text);
  const result = Papa.parse(normalised, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    // Do NOT use `transform` here — it runs after tokenisation and cannot
    // rescue a quoted field that was already split incorrectly.
    // We trim values in the individual .map() calls below instead.
  });
  return result.data;
}

// ── main loader ──────────────────────────────────────────────────────────────

export async function fetchDatabase() {
  try {
    const [nodesRes, contentRes, detailsRes, aboutMeRes, geoCacheRes] = await Promise.all([
      fetch('/data/nodes.csv'),
      fetch('/data/content.csv'),
      fetch('/data/project_details.csv'),
      fetch('/data/about_me.csv'),
      fetch('/data/geo_cache.json').catch(() => ({ ok: false })),
    ]);

    if (!nodesRes.ok || !contentRes.ok || !detailsRes.ok || !aboutMeRes.ok) {
      throw new Error('Failed to fetch CSV files from /public/data');
    }

    const [nodesText, contentText, detailsText, aboutMeText] = await Promise.all([
      nodesRes.text(),
      contentRes.text(),
      detailsRes.text(),
      aboutMeRes.text(),
    ]);
    const geoCache = geoCacheRes.ok ? await geoCacheRes.json() : {};

    // ── nodes ──────────────────────────────────────────────────────────────
    const rawNodes = parseCSV(nodesText)
      .map((node) => ({
        id:          clean(node.id),
        parent_id:   clean(node.parent_id),
        title:       clean(node.title),
        type:        clean(node.type),
        layout:      clean(node.layout),
        externalApp: clean(node.externalApp),
        modelData:   clean(node.modelData),
        filter:      clean(node.filter),
      }))
      .filter((node) => !!node.id);

    // ── content ────────────────────────────────────────────────────────────
    // FIX: `data` column is read as a single field regardless of commas inside
    // the cell, because PapaParse respects the surrounding double-quotes.
    const rawContent = parseCSV(contentText)
      .map((row) => ({
        project_id:  clean(row.project_id),
        block_order: Number.parseInt(clean(row.block_order) || '0', 10),
        position:    clean(row.position),
        type:        clean(row.type),
        // `data` may be a long quoted string with commas — fully preserved here
        data:        clean(row.data),
      }))
      .filter((row) => !!row.project_id);

    // ── project_details ────────────────────────────────────────────────────
    const rawDetails = await Promise.all(
      parseCSV(detailsText).map(async (detail) => {
        const address = clean(detail.address);
        let location = geoCache[address] || null;
        if (!location && address) {
          location = await geocodeAddress(address);
        }
        return {
          node_id:     clean(detail.node_id),
          title:       clean(detail.title),
          description: clean(detail.description),
          image_url:   clean(detail.image_url),
          address,
          location,
        };
      })
    );
    const filteredDetails = rawDetails.filter((d) => !!d.node_id);

    // ── about_me ───────────────────────────────────────────────────────────
    const aboutMeContent = parseCSV(aboutMeText).map((row) => ({
      position: clean(row.position),
      type:     clean(row.type),
      data:     clean(row.data),
    }));

    // ── assemble projects ──────────────────────────────────────────────────
    const detailsMap = filteredDetails.reduce((map, detail) => {
      map[detail.node_id] = detail;
      return map;
    }, {});

    const projectNodes = rawNodes.filter((n) => n.type === 'Project');

    const projects = projectNodes.map((node) => {
      const projectContent = rawContent
        .filter((c) => c.project_id === node.id)
        .sort((a, b) => a.block_order - b.block_order)
        .map((c) => ({
          position: c.position,
          type:     c.type,
          data:     c.data,   // ← full, untruncated text
        }));

      return {
        id:          node.id,
        parent_id:   node.parent_id,
        title:       node.title,
        category:    node.parent_id,
        layout:      node.layout,
        externalApp: node.externalApp,
        modelData:   node.modelData,
        content:     projectContent,
      };
    });

    return {
      site:          { name: 'CONTINUUM SPACE' },
      nodes:         rawNodes,
      projects,
      details:       detailsMap,
      aboutMeContent,
    };
  } catch (error) {
    console.error('Failed to load CSV database:', error);
    return null;
  }
}