import { useEffect, useRef } from 'react';

// ── Particle system config ──────────────────────────────────────────────────
// ── Ring definitions — multiple bands like an accretion disk ──────────────
// Radii are at scale=1 (design baseline: ~1000px min viewport dimension).
const BASE_RINGS = [
  { radius: 145, sigmaIn: 10,  sigmaOut: 10,  count:  500, brightRatio: 0.14 }, // inner arc
  { radius: 230, sigmaIn: 28,  sigmaOut: 20,  count: 6600, brightRatio: 0.08 }, // main ring
  { radius: 340, sigmaIn: 20,  sigmaOut: 100, count: 5800, brightRatio: 0.15 }, // outer halo
  { radius: 440, sigmaIn: 22,  sigmaOut: 900, count: 5000, brightRatio: 0.03 }, // far scatter
];

// REMOVED: Global NUM_PARTICLES constant to allow dynamic scaling inside the effect.

const NODE_RADIUS    = 50;   
const NODE_STRENGTH  = 2.5;   
const VEL_DAMPING    = 0.98;  
const SPRING_K       = 0.0008;

// ── Shaders ────────────────────────────────────────────────────────────────
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute float a_alpha;
  attribute float a_size;
  attribute float a_ringType;
  uniform vec2 u_resolution;
  uniform float u_dragProgress;
  varying float v_alpha;
  varying float v_glow;
  void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = a_size;
    v_alpha = a_alpha;
    v_glow = a_ringType * u_dragProgress;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying float v_alpha;
  varying float v_glow;
  uniform float u_glowHue;

  vec3 hueToRgb(float h) {
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
  }

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d)) * v_alpha * (1.0 + v_glow * 3.5);
    vec3 baseColor = vec3(0.9, 0.95, 1.0);
    vec3 glowColor = hueToRgb(u_glowHue / 360.0);
    vec3 color = mix(baseColor, glowColor, v_glow);
    gl_FragColor = vec4(color, a);
  }
`;

function gaussian() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export default function MagneticField({ nodesRef, isPaused, dragStateRef, draggingNodeRef, scale = 1 }) {
  const canvasRef   = useRef(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // 1. Determine particle count reduction based on window width or viewport scale
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    // Drop down to 35% on mobile, 65% on tablet, 100% on desktop
    const countMultiplier = isMobile ? 0.35 : (isTablet ? 0.65 : 1.0);

    // 2. Scale ring radii and map dynamic particle counts
    const rings = BASE_RINGS.map((ring) => ({
      ...ring,
      radius:   Math.round(ring.radius   * scale),
      sigmaIn:  Math.round(ring.sigmaIn  * scale),
      sigmaOut: Math.round(ring.sigmaOut * scale),
      count:    Math.round(ring.count    * countMultiplier), // dynamic ring count
    }));

    // 3. Compute the dynamic total particle count for this specific render configuration
    const currentNumParticles = rings.reduce((sum, ring) => sum + ring.count, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexShaderSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentShaderSource));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const locRes      = gl.getUniformLocation(prog, 'u_resolution');
    const locDrag     = gl.getUniformLocation(prog, 'u_dragProgress');
    const locHue      = gl.getUniformLocation(prog, 'u_glowHue');
    const locPos      = gl.getAttribLocation(prog,  'a_position');
    const locAlpha    = gl.getAttribLocation(prog,  'a_alpha');
    const locSize     = gl.getAttribLocation(prog,  'a_size');
    const locRingType = gl.getAttribLocation(prog,  'a_ringType');

    // ── Initialise particles ───────────────────────────────────────────────
    const dpr    = window.devicePixelRatio || 1;
    const initCx  = window.innerWidth  / 2;  
    const initCy  = window.innerHeight / 2;
    const RING_TYPES = [0.0, 0.0, 1.0, 0.55];

    const particles = rings.flatMap((ring, ringIndex) =>
      Array.from({ length: ring.count }, () => {
        const g = gaussian();
        const r = Math.max(30, g >= 0
          ? ring.radius + g * ring.sigmaOut
          : ring.radius + g * ring.sigmaIn);

        const speed = (0.28 + Math.random() * 0.14) / r;
        const isBright = Math.random() < ring.brightRatio;
        const angle = Math.random() * Math.PI * 2;
        return {
          angle,
          r,
          speed,
          size    : isBright ? (Math.random() * 2.2 + 1.8) * dpr : (Math.random() * 1.4 + 0.3) * dpr,
          alpha   : isBright ? Math.random() * 0.5 + 0.5  : Math.random() * 0.35 + 0.15,
          ringType: RING_TYPES[ringIndex],
          x: initCx + Math.cos(angle) * r,  
          y: initCy + Math.sin(angle) * r,
          vx: 0, vy: 0,
        };
      })
    );

    // 4. Provision Float32Arrays based on currentNumParticles
    const posData      = new Float32Array(currentNumParticles * 2);
    const alphaData    = new Float32Array(particles.map(p => p.alpha));
    const sizeData     = new Float32Array(particles.map(p => p.size));
    const ringTypeData = new Float32Array(particles.map(p => p.ringType));

    const posBuf      = gl.createBuffer();
    const alphaBuf    = gl.createBuffer();
    const sizeBuf     = gl.createBuffer();
    const ringTypeBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, alphaData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ringTypeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ringTypeData, gl.STATIC_DRAW);

    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;

    const resize = () => {
      canvas.width  = window.innerWidth  * dpr;  
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(locRes, canvas.width, canvas.height);
      cx = window.innerWidth  / 2;  
      cy = window.innerHeight / 2;
    };
    window.addEventListener('resize', resize);
    resize();

    gl.clearColor(0, 0, 0, 0);

    let raf;
    const render = () => {
      raf = requestAnimationFrame(render);
      if (isPausedRef.current) return;

      const nodes = nodesRef.current || [];

      // 5. Run CPU simulation loop up to currentNumParticles
      for (let i = 0; i < currentNumParticles; i++) {
        const p = particles[i];
        if (!p) continue; // safety check
        
        p.angle += p.speed;

        const baseX = cx + Math.cos(p.angle) * p.r;
        const baseY = cy + Math.sin(p.angle) * p.r;

        p.vx += (baseX - p.x) * SPRING_K;
        p.vy += (baseY - p.y) * SPRING_K;

        const draggedNode   = draggingNodeRef?.current;
        const dragProgress  = (dragStateRef?.current?.isDragging && draggedNode?.type === 'Project')
          ? (dragStateRef.current.progress || 0)
          : 0;

        for (const node of nodes) {
          const nx    = cx + node.x;
          const ny    = cy + node.y; 
          const dx    = p.x - nx;    
          const dy    = p.y - ny;

          const isBeingDragged = dragProgress > 0 && node === draggedNode;
          const radius  = isBeingDragged ? NODE_RADIUS + dragProgress * 160 : NODE_RADIUS;
          const force   = isBeingDragged ? NODE_STRENGTH + dragProgress * 18 : NODE_STRENGTH;

          const dist2 = dx * dx + dy * dy;
          if (dist2 < radius * radius && dist2 > 1) {
            const dist = Math.sqrt(dist2);
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= VEL_DAMPING;
        p.vy *= VEL_DAMPING;

        p.x += p.vx;
        p.y += p.vy;

        posData[i * 2]     = p.x * dpr; 
        posData[i * 2 + 1] = p.y * dpr;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      const dragProgress = dragStateRef?.current?.progress ?? 0;
      gl.uniform1f(locDrag, dragProgress);

      const draggedNode = draggingNodeRef?.current;
      const glowHue = draggedNode?.hue ?? 192;
      gl.uniform1f(locHue, glowHue);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
      gl.enableVertexAttribArray(locAlpha);
      gl.vertexAttribPointer(locAlpha, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.enableVertexAttribArray(locSize);
      gl.vertexAttribPointer(locSize, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, ringTypeBuf);
      gl.enableVertexAttribArray(locRingType);
      gl.vertexAttribPointer(locRingType, 1, gl.FLOAT, false, 0, 0);

      // 6. Draw only the dynamically generated number of points
      gl.drawArrays(gl.POINTS, 0, currentNumParticles);
    };

    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(alphaBuf);
      gl.deleteBuffer(sizeBuf);
      gl.deleteBuffer(ringTypeBuf);
      gl.deleteProgram(prog);
    };
  }, [nodesRef, scale]); // Clean teardown and rebuild triggered on scale update

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}