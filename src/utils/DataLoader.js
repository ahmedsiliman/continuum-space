// src/utils/DataLoader.js
import Papa from 'papaparse';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const geocodeCache = new Map();

async function geocodeAddress(address) {
  if (!address) return null;
  if (geocodeCache.has(address)) return geocodeCache.get(address);

  try {
    // Add a User-Agent header (a requirement for Nominatim)
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
      headers: { 'User-Agent': 'MyPortfolioProject/1.0' }
    });
    
    // Add a small delay to respect Nominatim's usage policy (1 request/sec)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const data = await response.json();
    if (data && data.length > 0) {
      const location = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(address, location);
      return location;
    }
  } catch (error) {
    console.error(`Geocoding failed:`, error);
  }
  return null;
}

export async function fetchDatabase() {
  try {
    // 1. Fetch all CSV files and the geo cache from the public folder simultaneously
    const [nodesRes, contentRes, detailsRes, aboutMeRes, geoCacheRes] = await Promise.all([
      fetch('/data/nodes.csv'),
      fetch('/data/content.csv'),
      fetch('/data/project_details.csv'),
      fetch('/data/about_me.csv'),
      fetch('/data/geo_cache.json').catch(() => ({ ok: false })) // Optional cache
    ]);

    if (!nodesRes.ok || !contentRes.ok || !detailsRes.ok || !aboutMeRes.ok) {
      throw new Error('Failed to fetch CSV files from /public/data');
    }

    const nodesText = await nodesRes.text();
    const contentText = await contentRes.text();
    const detailsText = await detailsRes.text();
    const aboutMeText = await aboutMeRes.text();
    const geoCache = geoCacheRes.ok ? await geoCacheRes.json() : {};

    // 2. Parse the CSV text into Javascript Arrays
    const rawNodes = Papa.parse(nodesText, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data
      .map((node) => ({
        id: clean(node.id),
        parent_id: clean(node.parent_id),
        title: clean(node.title),
        type: clean(node.type),
        layout: clean(node.layout),
        externalApp: clean(node.externalApp),
        modelData: clean(node.modelData),
        filter: clean(node.filter)
      }))
      .filter((node) => !!node.id);

    const rawContent = Papa.parse(contentText, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data
      .map((content) => ({
        project_id: clean(content.project_id),
        block_order: Number.parseInt(clean(content.block_order) || '0', 10),
        position: clean(content.position),
        type: clean(content.type),
        data: clean(content.data)
      }))
      .filter((content) => !!content.project_id);

    const rawDetails = await Promise.all(
      Papa.parse(detailsText, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data
        .map(async (detail) => {
          const address = clean(detail.address);
          // Use pre-computed coordinate from cache if available, otherwise fallback to runtime geocoding
          let location = geoCache[address] || null;
          if (!location && address) {
            location = await geocodeAddress(address);
          }
          return {
            node_id: clean(detail.node_id),
            title: clean(detail.title),
            description: clean(detail.description),
            image_url: clean(detail.image_url),
            address: address,
            location: location
          };
        })
    );
    const filteredDetails = rawDetails.filter((detail) => !!detail.node_id);

    const aboutMeContent = Papa.parse(aboutMeText, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data
      .map((row) => ({
        position: clean(row.position),
        type: clean(row.type),
        data: clean(row.data)
      }));

    const detailsMap = filteredDetails.reduce((map, detail) => {
      map[detail.node_id] = detail;
      return map;
    }, {});

    // 3. Rebuild the Nested JSON Structure
    const projects = [];

    // Filter out Categories to only process Projects
    const projectNodes = rawNodes.filter(n => n.type === 'Project');

    projectNodes.forEach(node => {
      const projectContent = rawContent
        .filter(c => c.project_id === node.id)
        .sort((a, b) => a.block_order - b.block_order)
        .map(c => ({
          position: c.position,
          type: c.type,
          data: c.data
        }));

      projects.push({
        id: node.id,
        parent_id: node.parent_id,
        title: node.title,
        category: node.parent_id,
        layout: node.layout,
        externalApp: node.externalApp,
        modelData: node.modelData,
        content: projectContent
      });
    });

    // 4. Return the assembled database
    return {
      site: { name: "CONTINUUM SPACE" },
      nodes: rawNodes,
      projects: projects,
      details: detailsMap,
      aboutMeContent: aboutMeContent
    };

  } catch (error) {
    console.error("Failed to load CSV database:", error);
    return null;
  }
}