import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import './UniverseTitle.css';

// ── Particle config ───────────────────────────────────────────────────────────
// SAMPLE_STEP: pixel stride when reading the offscreen canvas.
//   Lower  → more particles, denser burst, heavier CPU.
//   Higher → fewer particles, sparser burst, lighter CPU.
const SAMPLE_STEP  = 4;
const DAMPING      = 0.97;   // velocity friction per frame (matches MagneticField VEL_DAMPING)
const FADE         = 0.974;  // alpha multiplier per frame
const MIN_ALPHA    = 0.004;  // particle considered dead below this
const SPEED_BASE   = 0.5;    // minimum outward speed (px/frame)
const SPEED_RAND   = 2.8;    // random speed added on top
const UPWARD_BIAS  = 0.45;   // slight upward drift to mimic rising particles

// Colour palette matching MagneticField fragment shader:
//   base  → vec3(0.88, 0.93, 1.0)  ≈ #e0edff
//   glow  → vec3(0.0,  0.9,  1.0)  ≈ #00E5FF  (cyan)
const COLOR_BASE = '#e0edff';
const COLOR_CYAN = '#00E5FF';
const CYAN_RATIO = 0.32; // fraction of particles that use cyan

/**
 * UniverseTitle
 *
 * Renders the site name + tagline inside the universe scene.
 * Exposes an `explode()` method via useImperativeHandle so MainScene can
 * trigger the particle burst imperatively without coupling to React state.
 *
 * When explode() is called:
 *  1. The text elements are rendered into an offscreen canvas.
 *  2. Lit pixels are sampled and converted into canvas 2D particles.
 *  3. Particles expand outward with additive ('lighter') blending,
 *     visually matching the MagneticField WebGL layer.
 *  4. The HTML text fades immediately; particles animate until fully gone.
 */
const UniverseTitle = forwardRef(function UniverseTitle({ site }, ref) {
  const rootRef    = useRef(null);
  const canvasRef  = useRef(null);
  const nameRef    = useRef(null);
  const dividerRef = useRef(null);
  const taglineRef = useRef(null);
  const rafRef     = useRef(null);
  const doneRef    = useRef(false); // guard against double-trigger

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useImperativeHandle(ref, () => ({
    explode() {
      if (doneRef.current || !rootRef.current) return;
      doneRef.current = true;

      const rootEl    = rootRef.current;
      const globalRect = rootEl.getBoundingClientRect();
      const W = Math.ceil(globalRect.width)  || 1;
      const H = Math.ceil(globalRect.height) || 1;

      // ── 1. Sample text pixels from an offscreen canvas ──────────────────
      const offscreen = document.createElement('canvas');
      offscreen.width  = W;
      offscreen.height = H;
      const octx = offscreen.getContext('2d');

      const particles = [];

      // Sample each text element separately so we can tune per-element colour
      const targets = [
        { el: nameRef.current,    isCyanSource: false },
        { el: taglineRef.current, isCyanSource: true  },
      ];

      targets.forEach(({ el, isCyanSource }) => {
        if (!el) return;
        const elRect  = el.getBoundingClientRect();
        const relX    = elRect.left - globalRect.left;
        const relY    = elRect.top  - globalRect.top;
        const style   = getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);

        octx.clearRect(0, 0, W, H);
        octx.fillStyle = 'white';
        octx.font      = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        // letterSpacing is supported in modern Chrome/Firefox/Safari
        if ('letterSpacing' in octx) octx.letterSpacing = style.letterSpacing;
        // baseline shift: ~85% of fontSize puts the baseline at a natural reading position
        octx.fillText(el.textContent, relX, relY + fontSize * 0.85);

        const { data } = octx.getImageData(0, 0, W, H);

        for (let py = 0; py < H; py += SAMPLE_STEP) {
          for (let px = 0; px < W; px += SAMPLE_STEP) {
            const alpha = data[(py * W + px) * 4 + 3];
            if (alpha < 60) continue;

            const angle = Math.random() * Math.PI * 2;
            const speed = SPEED_BASE + Math.random() * SPEED_RAND;

            particles.push({
              x:     globalRect.left + px,
              y:     globalRect.top  + py,
              vx:    Math.cos(angle) * speed,
              vy:    Math.sin(angle) * speed - UPWARD_BIAS,
              alpha: 0.65 + Math.random() * 0.35,
              size:  0.7  + Math.random() * 1.9,
              cyan:  isCyanSource || Math.random() < CYAN_RATIO,
            });
          }
        }
      });

      // ── 2. Immediately hide the HTML text ───────────────────────────────
      [nameRef.current, dividerRef.current, taglineRef.current].forEach(el => {
        if (!el) return;
        el.style.transition = 'opacity 60ms linear';
        el.style.opacity    = '0';
      });

      // ── 3. Animate particles on a full-screen canvas ────────────────────
      const canvas  = canvasRef.current;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d');
      // Additive blending → overlapping particles bloom like WebGL ONE blending
      ctx.globalCompositeOperation = 'lighter';

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let anyAlive = false;
        for (const p of particles) {
          if (p.alpha < MIN_ALPHA) continue;
          anyAlive = true;

          p.x     += p.vx;
          p.y     += p.vy;
          p.vx    *= DAMPING;
          p.vy    *= DAMPING;
          p.alpha *= FADE;

          ctx.globalAlpha = Math.min(p.alpha, 1);
          ctx.fillStyle   = p.cyan ? COLOR_CYAN : COLOR_BASE;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        if (anyAlive) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          ctx.globalAlpha      = 1;
          canvas.style.display = 'none';
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    },
  }));

  if (!site) return null;

  return (
    <>
      {/* Full-screen canvas — hidden until explode() fires */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', display: 'none', zIndex: 10 }}
      />

      <div ref={rootRef} className="universe-title">
        <h1 ref={nameRef}    className="universe-title-name">{site.name}</h1>
        <div ref={dividerRef} className="universe-title-divider" />
        <p  ref={taglineRef} className="universe-title-tagline">{site.tagline}</p>
      </div>
    </>
  );
});

export default UniverseTitle;

