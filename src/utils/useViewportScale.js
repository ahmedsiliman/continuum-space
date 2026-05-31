import { useState, useEffect } from 'react';

// Design baseline: the layout was authored at ~1000px min(vw, vh).
// Scale is clamped so the UI stays usable on very small screens (≥ 0.4×)
// and doesn't blow up on huge monitors (≤ 2×).
const BASE_SIZE = 1000;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.0;

export function useViewportScale() {
  const [dims, setDims] = useState({
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

  useEffect(() => {
    let timeoutId;
    const onResize = () => {
      clearTimeout(timeoutId);
      // 150 ms debounce — prevents the WebGL particle system from being torn
      // down and rebuilt on every pixel while the user drags a window edge.
      timeoutId = setTimeout(() => {
        setDims({ vw: window.innerWidth, vh: window.innerHeight });
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const scale = Math.min(
    Math.max(Math.min(dims.vw, dims.vh) / BASE_SIZE, MIN_SCALE),
    MAX_SCALE
  );

  return { scale, vw: dims.vw, vh: dims.vh };
}
