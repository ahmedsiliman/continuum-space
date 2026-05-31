// src/utils/DataLoader.js
import Papa from 'papaparse';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export async function fetchDatabase() {
  try {
    // 1. Fetch both CSV files from the public folder simultaneously
    const [nodesRes, contentRes] = await Promise.all([
      fetch('/data/nodes.csv'),
      fetch('/data/content.csv')
    ]);

    if (!nodesRes.ok || !contentRes.ok) {
      throw new Error('Failed to fetch CSV files from /public/data');
    }

    const nodesText = await nodesRes.text();
    const contentText = await contentRes.text();

    // 2. Parse the CSV text into Javascript Arrays
    const rawNodes = Papa.parse(nodesText, { header: true, skipEmptyLines: true }).data
      .map((node) => ({
        id: clean(node.id),
        parent_id: clean(node.parent_id),
        title: clean(node.title),
        type: clean(node.type),
        layout: clean(node.layout),
        externalApp: clean(node.externalApp),
        modelData: clean(node.modelData)
      }))
      .filter((node) => !!node.id);

    const rawContent = Papa.parse(contentText, { header: true, skipEmptyLines: true }).data
      .map((content) => ({
        project_id: clean(content.project_id),
        block_order: Number.parseInt(clean(content.block_order) || '0', 10),
        position: clean(content.position),
        type: clean(content.type),
        data: clean(content.data)
      }))
      .filter((content) => !!content.project_id);

    // 3. Rebuild the Nested JSON Structure
    const projects = [];

    // Filter out Categories to only process Projects
    const projectNodes = rawNodes.filter(n => n.type === 'Project');

    projectNodes.forEach(node => {
      // Find all content blocks that belong to this specific project
      // and sort them by the block_order column

      const projectContent = rawContent
        .filter(c => c.project_id === node.id)
        .sort((a, b) => a.block_order - b.block_order)
        .map(c => ({
          position: c.position,
          type: c.type,
          data: c.data
        }));

      // Reconstruct the exact JSON object your Layout Router expects
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
      site: { name: "CONTINUUM SPACE", /* ... */ },
      nodes: rawNodes,
      projects: projects
    };

  } catch (error) {
    console.error("Failed to load CSV database:", error);
    return null;
  }
}