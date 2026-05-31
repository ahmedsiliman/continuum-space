import * as OBC from '@thatopen/components';
import {
  Vector3,
  Matrix4,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshLambertMaterial,
  LineBasicMaterial,
  LineSegments,
  EdgesGeometry,
  InstancedMesh
} from 'three';

const container = document.getElementById('viewer-container');
const sidebarEl = document.getElementById('sidebar');
const loadingEl = document.getElementById('loading');
const categoryListEl = document.getElementById('category-list');
const sectionStateEl = document.getElementById('section-state');

const btnFlipSection = document.getElementById('btn-flip-section');
const btnXSection = document.getElementById('btn-x-section');
const btnYSection = document.getElementById('btn-y-section');
const btnZSection = document.getElementById('btn-z-section');
const btnShowAll = document.getElementById('btn-show-all');
const btnToggleCategories = document.getElementById('btn-toggle-categories');
const categoriesPanel = document.getElementById('categories-panel');
const categoriesArrow = document.getElementById('categories-arrow');
const btnToggleLevels = document.getElementById('btn-toggle-levels');
const levelsPanel = document.getElementById('levels-panel');
const levelsArrow = document.getElementById('levels-arrow');
const panelSizeSlider = document.getElementById('panel-size-slider');
const panelSizeValue = document.getElementById('panel-size-value');

const btnStyleSolid = document.getElementById('btn-style-solid');
const btnStyleClay = document.getElementById('btn-style-clay');
const btnStyleHiddenLine = document.getElementById('btn-style-hidden-line');

const categoryMaps = new Map();
const rawCategoryMaps = new Map();
const axisNormals = {
  X: new Vector3(1, 0, 0),
  Y: new Vector3(0, 1, 0),
  Z: new Vector3(0, 0, 1)
};

// ─── Visual Style ────────────────────────────────────────────────────────────
const originalMaterials = new Map();
const overlayObjects = [];
let currentStyle = 'solid';
let originalBackground = null;

const styleButtons = {
  solid: btnStyleSolid,
  clay: btnStyleClay,
  'hidden-line': btnStyleHiddenLine
};

function storeOriginalMaterials(scene) {
  scene.traverse((obj) => {
    if (obj.isMesh && !originalMaterials.has(obj.uuid)) {
      // Also save onBeforeRender — ThatOpen LOD meshes use it to update
      // LOD uniforms on the material. If we replace the material without
      // clearing the callback, it crashes trying to set lodSize/color on
      // the new plain Three.js material.
      originalMaterials.set(obj.uuid, {
        material: Array.isArray(obj.material) ? obj.material.slice() : obj.material,
        onBeforeRender: obj.onBeforeRender
      });
    }
  });
}

function clearOverlays() {
  for (const obj of overlayObjects) {
    obj.parent?.remove(obj);
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
    else obj.material?.dispose();
  }
  overlayObjects.length = 0;
}

function restoreOriginalMaterials(scene) {
  scene.traverse((obj) => {
    if (obj.isMesh && originalMaterials.has(obj.uuid)) {
      const stored = originalMaterials.get(obj.uuid);
      obj.material = stored.material;
      obj.onBeforeRender = stored.onBeforeRender;
    }
  });
}

// Replace material AND silence the LOD onBeforeRender callback so it doesn't
// crash trying to write lodSize/color onto a plain Three.js material.
// Also attach a stub `uniforms` object with the keys that ThatOpen's
// OrthoPerspectiveCamera reads/writes on every frame (uZoom, lodSize).
// Without this stub, the camera update loop crashes on `undefined.uZoom`.
function lodStubUniforms() {
  return { uZoom: { value: 1 }, lodSize: { value: 0 } };
}

function swapMaterial(obj, mat) {
  mat.uniforms = lodStubUniforms();
  obj.material = mat;
  obj.onBeforeRender = () => {};
}

// Bake EdgesGeometry for every instance of an InstancedMesh into a single
// LineSegments geometry in world space. This gives proper Revit-style edges
// (angle-thresholded sharp edges only, not all triangulation) at each instance
// position without needing instanced line rendering.
function buildInstancedEdges(instancedMesh, thresholdAngle = 20) {
  try {
    instancedMesh.updateWorldMatrix(true, false);
    const meshWorld = instancedMesh.matrixWorld;

    const baseEdges = new EdgesGeometry(instancedMesh.geometry, thresholdAngle);
    const basePos = baseEdges.attributes.position;
    const vertexCount = basePos.count;
    const instanceCount = instancedMesh.count;

    // Guard against models that are too large
    if (vertexCount * instanceCount > 2_000_000) {
      baseEdges.dispose();
      return null;
    }

    const allPos = new Float32Array(vertexCount * instanceCount * 3);
    const instanceMat = new Matrix4();
    const combined = new Matrix4();
    const v = new Vector3();

    for (let i = 0; i < instanceCount; i++) {
      instancedMesh.getMatrixAt(i, instanceMat);
      combined.multiplyMatrices(meshWorld, instanceMat);
      for (let j = 0; j < vertexCount; j++) {
        v.fromBufferAttribute(basePos, j);
        v.applyMatrix4(combined);
        const off = (i * vertexCount + j) * 3;
        allPos[off]     = v.x;
        allPos[off + 1] = v.y;
        allPos[off + 2] = v.z;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(allPos, 3));
    baseEdges.dispose();
    return geo;
  } catch (_e) {
    return null;
  }
}

function setStyleActive(styleName) {
  for (const [name, btn] of Object.entries(styleButtons)) {
    btn.classList.toggle('active-style', name === styleName);
  }
  currentStyle = styleName;
}

function applyStyle(scene, styleName) {
  clearOverlays();
  restoreOriginalMaterials(scene);
  setStyleActive(styleName);

  // Restore original scene background when leaving hidden-line
  scene.background = originalBackground;

  if (styleName === 'solid') {
    // materials + background already restored above

  } else if (styleName === 'clay') {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        swapMaterial(obj, new MeshLambertMaterial({ color: 0xdedad5, side: 2 }));
      }
    });

  } else if (styleName === 'hidden-line') {
    // White background for a proper technical-drawing look
    scene.background = new Color(0xffffff);

    scene.traverse((obj) => {
      if (obj.isMesh) {
        // White solid fill, LOD callback silenced
        swapMaterial(obj, new MeshBasicMaterial({ color: 0xffffff, side: 2 }));

        if (obj.isInstancedMesh) {
          // Build angle-thresholded edges baked per-instance in world space
          const edgesGeo = buildInstancedEdges(obj);
          if (edgesGeo) {
            const lines = new LineSegments(
              edgesGeo,
              new LineBasicMaterial({ color: 0x1a1a1a })
            );
            lines.userData.isStyleOverlay = true;
            // Geometry is already in world space — add directly to scene root
            scene.add(lines);
            overlayObjects.push(lines);
          } else {
            // Fallback for very dense geometry: wireframe InstancedMesh overlay
            const wireMat = new MeshBasicMaterial({ color: 0x2a2a2a, wireframe: true });
            wireMat.uniforms = lodStubUniforms();
            const wireMesh = new InstancedMesh(obj.geometry, wireMat, obj.count);
            wireMesh.instanceMatrix = obj.instanceMatrix;
            wireMesh.userData.isStyleOverlay = true;
            obj.parent?.add(wireMesh);
            overlayObjects.push(wireMesh);
          }
        }
        // Skip non-InstancedMesh objects — those are ThatOpen internal helpers
        // whose geometry doesn't map to architectural edges
      }
    });
  }
}

function wireStyleControls(world) {
  const scene = world.scene.three;
  originalBackground = scene.background;
  storeOriginalMaterials(scene);
  btnStyleSolid.addEventListener('click', () => applyStyle(scene, 'solid'));
  btnStyleClay.addEventListener('click', () => applyStyle(scene, 'clay'));
  btnStyleHiddenLine.addEventListener('click', () => applyStyle(scene, 'hidden-line'));
  setStyleActive('solid');
}
// ─────────────────────────────────────────────────────────────────────────────

const preferredCategoryGroups = [
  { label: 'Walls', patterns: [/WALL/] },
  { label: 'Floors', patterns: [/SLAB/, /FLOOR/] },
  { label: 'Windows', patterns: [/WINDOW/] },
  { label: 'Doors', patterns: [/DOOR/] },
  { label: 'Roofs', patterns: [/ROOF/] },
  { label: 'Generic Models', patterns: [/BUILDINGELEMENTPROXY/, /PROXY/, /GENERIC/] },
  { label: 'Spaces', patterns: [/SPACE/] },
  { label: 'Columns', patterns: [/COLUMN/] },
  { label: 'Structural Framing (Beams)', patterns: [/BEAM/, /MEMBER/, /BRACE/] },
  { label: 'Structural Foundations', patterns: [/FOOTING/, /FOUNDATION/, /PILE/] },
  { label: 'Stairs', patterns: [/STAIR/, /RAMP/] },
  { label: 'Railing', patterns: [/RAILING/] },
  { label: 'Furniture', patterns: [/FURNISHING/, /FURNITURE/] },
  { label: 'Casework', patterns: [/CASEWORK/] },
  { label: 'Pipes', patterns: [/PIPE/] },
  { label: 'Conduits', patterns: [/CONDUIT/, /CABLECARRIER/, /CABLESEGMENT/] },
  { label: 'Mechanical Equipment', patterns: [/MECHANICAL/, /EQUIPMENT/, /FLOW/, /TERMINAL/, /BOILER/, /CHILLER/, /PUMP/, /FAN/] }
];

function setLoading(message, isError = false) {
  loadingEl.textContent = message;
  loadingEl.style.color = isError ? '#b00020' : '#18181b';
  loadingEl.style.borderColor = isError ? '#b00020' : '#000000';
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function resolveModelUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedUrl = params.get('modelUrl');
  if (requestedUrl) {
    return requestedUrl;
  }

  return new URL('/models/model_berlin_v3.ifc', window.location.origin).href;
}

function cleanCategoryName(rawName) {
  if (!rawName) return 'Unnamed';
  const noIfc = rawName.replace(/^IFC/i, '');
  return noIfc.replace(/([A-Z])/g, ' $1').trim();
}

function mergeModelIdMaps(selected) {
  const merged = {};

  for (const map of selected) {
    for (const [modelId, ids] of Object.entries(map)) {
      if (!merged[modelId]) merged[modelId] = new Set();
      for (const id of ids) merged[modelId].add(id);
    }
  }

  return merged;
}

function mergeTwoModelMaps(target, source) {
  for (const [modelId, ids] of Object.entries(source)) {
    if (!target[modelId]) target[modelId] = new Set();
    for (const id of ids) target[modelId].add(id);
  }
}

function buildPreferredCategoryMaps() {
  categoryMaps.clear();
  const usedRaw = new Set();

  for (const group of preferredCategoryGroups) {
    const groupMap = {};
    let hasItems = false;

    for (const [rawName, map] of rawCategoryMaps) {
      const name = String(rawName || '').toUpperCase();
      if (!group.patterns.some((regex) => regex.test(name))) continue;

      usedRaw.add(rawName);
      mergeTwoModelMaps(groupMap, map);
      hasItems = true;
    }

    if (hasItems) {
      categoryMaps.set(group.label, groupMap);
    }
  }

  const otherMap = {};
  let hasOther = false;
  for (const [rawName, map] of rawCategoryMaps) {
    if (usedRaw.has(rawName)) continue;
    mergeTwoModelMaps(otherMap, map);
    hasOther = true;
  }

  if (hasOther) {
    categoryMaps.set('Other', otherMap);
  }
}

function setAxisButtonState(axis) {
  const buttons = {
    X: btnXSection,
    Y: btnYSection,
    Z: btnZSection
  };

  for (const [key, button] of Object.entries(buttons)) {
    button.style.background = axis === key ? '#ececec' : '#fff';
  }
}

function updateClipperState(_clipper, currentAxis, flipped) {
  sectionStateEl.textContent = `Axis: ${currentAxis || '-'} | Flip: ${flipped ? 'Reversed' : 'Normal'}`;
  setAxisButtonState(currentAxis);
}

function setDropdown(panel, arrow, open) {
  panel.classList.toggle('collapsed', !open);
  arrow.textContent = open ? '▲' : '▼';
}

function setSidebarWidth(px) {
  document.documentElement.style.setProperty('--sidebar-width', `${px}px`);
  panelSizeValue.textContent = `${px}px`;
}

function wireDropdowns() {
  let categoriesOpen = false;
  let levelsOpen = false;

  btnToggleCategories.addEventListener('click', () => {
    categoriesOpen = !categoriesOpen;
    setDropdown(categoriesPanel, categoriesArrow, categoriesOpen);
    if (categoriesOpen) {
      const current = Number(panelSizeSlider.value);
      if (current < 380) {
        panelSizeSlider.value = '380';
        setSidebarWidth(380);
      }
    }
  });

  btnToggleLevels.addEventListener('click', () => {
    levelsOpen = !levelsOpen;
    setDropdown(levelsPanel, levelsArrow, levelsOpen);
  });

  panelSizeSlider.addEventListener('input', () => {
    const value = Number(panelSizeSlider.value);
    setSidebarWidth(value);
  });

  setSidebarWidth(Number(panelSizeSlider.value));
}

function wireSectionControls(clipper, world, getSectionState) {
  updateClipperState(clipper, getSectionState().axis, getSectionState().flipped);

  btnXSection.addEventListener('click', async () => {
    await getSectionState().toggleAxis('X');
    updateClipperState(clipper, getSectionState().axis, getSectionState().flipped);
  });

  btnYSection.addEventListener('click', async () => {
    await getSectionState().toggleAxis('Y');
    updateClipperState(clipper, getSectionState().axis, getSectionState().flipped);
  });

  btnZSection.addEventListener('click', async () => {
    await getSectionState().toggleAxis('Z');
    updateClipperState(clipper, getSectionState().axis, getSectionState().flipped);
  });

  btnFlipSection.addEventListener('click', async () => {
    await getSectionState().toggleFlip();
    updateClipperState(clipper, getSectionState().axis, getSectionState().flipped);
  });
}

function buildCategoryUI(hider) {
  const names = [...categoryMaps.keys()];
  categoryListEl.innerHTML = '';

  if (names.length === 0) {
    categoryListEl.innerHTML = '<div class="empty">No categories detected.</div>';
    return;
  }

  for (const category of names) {
    const label = document.createElement('label');
    label.className = 'category-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category;

    input.addEventListener('change', async () => {
      const checked = [...categoryListEl.querySelectorAll("input[type='checkbox']:checked")]
        .map((el) => el.value);

      if (checked.length === 0) {
        await hider.set(true);
        return;
      }

      const selectedMaps = checked
        .map((name) => categoryMaps.get(name))
        .filter(Boolean);

      const mergedMap = mergeModelIdMaps(selectedMaps);
      await hider.isolate(mergedMap);
    });

    const text = document.createElement('span');
    text.textContent = cleanCategoryName(category);

    label.appendChild(input);
    label.appendChild(text);
    categoryListEl.appendChild(label);
  }
}

async function main() {
  try {
    const start = performance.now();
    setLoading('Starting That Open viewer...');

    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create();

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(components);

    components.init();
    world.scene.setup();
    components.get(OBC.Grids).create(world);

    await world.camera.controls.setLookAt(60, 35, 40, 0, 0, 0);

    setLoading('Initializing Fragments worker...');
    const workerUrl = await OBC.FragmentsManager.getWorker();
    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(workerUrl);

    world.camera.controls.addEventListener('update', () => {
      fragments.core.update();
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      fragments.core.update(true);
    });

    const ifcLoader = components.get(OBC.IfcLoader);
    const classifier = components.get(OBC.Classifier);
    const hider = components.get(OBC.Hider);
    const clipper = components.get(OBC.Clipper);
    const sectionState = {
      id: null,
      axis: null,
      normal: null,
      flipped: false,
      clearState() {
        this.id = null;
        this.axis = null;
        this.normal = null;
      },
      getPoint() {
        const target = new Vector3();
        world.camera.controls.getTarget(target);
        return target;
      },
      async deleteCurrent() {
        if (!this.id) return;
        await clipper.delete(world, this.id);
        this.clearState();
      },
      async applyAxis(axis) {
        const point = this.getPoint();
        const baseNormal = axisNormals[axis];
        if (!baseNormal) return;

        await this.deleteCurrent();
        clipper.enabled = true;

        const normal = this.flipped ? baseNormal.clone().negate() : baseNormal.clone();
        const id = clipper.createFromNormalAndCoplanarPoint(world, normal, point);
        this.id = id;
        this.axis = axis;
        this.normal = normal;
      },
      async toggleAxis(axis) {
        if (this.axis === axis) {
          await this.deleteCurrent();
          return;
        }

        await this.applyAxis(axis);
      },
      async toggleFlip() {
        this.flipped = !this.flipped;
        if (!this.axis) return;
        await this.applyAxis(this.axis);
      },
      async resetAll() {
        await this.deleteCurrent();
        this.flipped = false;
      },

      point: null
    };

    clipper.setup();
    clipper.enabled = true;
    wireDropdowns();
    wireSectionControls(clipper, world, () => sectionState);

    btnShowAll.addEventListener('click', async () => {
      for (const input of categoryListEl.querySelectorAll("input[type='checkbox']")) {
        input.checked = false;
      }
      await hider.set(true);
      await sectionState.resetAll();
      updateClipperState(clipper, sectionState.axis, sectionState.flipped);
      applyStyle(world.scene.three, 'solid');
      sidebarEl.scrollTop = 0;
    });

    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: {
        path: './vendor/',
        absolute: false
      }
    });

    const modelUrl = resolveModelUrl();

    setLoading('Checking IFC file...');
    const fileResponse = await withTimeout(
      fetch(modelUrl, { cache: 'no-store' }),
      10000,
      'Could not access IFC file (10s timeout).'
    );
    if (!fileResponse.ok) {
      throw new Error(`IFC file not found (${fileResponse.status} ${fileResponse.statusText}).`);
    }

    setLoading('Converting IFC to Fragments (That Open)...');
    const data = new Uint8Array(await fileResponse.arrayBuffer());

    await withTimeout(
      ifcLoader.load(data, false, 'berlin-model', {
        processData: {
          progressCallback: (progress) => {
            const pct = Math.round((progress * 100 + Number.EPSILON) * 10) / 10;
            setLoading(`Converting IFC... ${pct}%`);
          }
        }
      }),
      180000,
      'IFC conversion timed out after 180 seconds.'
    );

    setLoading('Classifying categories...');
    await classifier.byCategory({ classificationName: 'Categories' });

    const categoryGroups = classifier.list.get('Categories');
    if (categoryGroups) {
      for (const [categoryName, groupData] of categoryGroups) {
        rawCategoryMaps.set(categoryName, await groupData.get());
      }
    }

    buildPreferredCategoryMaps();
    buildCategoryUI(hider);
    wireStyleControls(world);

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    setLoading(`That Open model loaded in ${elapsed}s`);
    setTimeout(() => {
      loadingEl.style.display = 'none';
    }, 1000);
  } catch (error) {
    console.error('That Open load failed:', error);
    setLoading(`Load failed: ${error.message}`, true);
  }
}

main();
