import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Easing function: ease-out cubic
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Preload the globe texture to improve perceived performance
useLoader.preload(
  THREE.TextureLoader,
  'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthmap1k.jpg'
);

const GlobeMesh = ({ location }) => {
  const meshRef = useRef();
  const groupRef = useRef();

  // Intro animation state
  const animationRef = useRef({
    active: true,
    progress: 0,
    startY: 0.5,   // Starting Y rotation (globe to the right)
    endY: 0,       // End Y rotation (default facing camera)
    duration: 1.4, // seconds
  });

  const texture = useLoader(
    THREE.TextureLoader,
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthmap1k.jpg'
  );

  // Pin position calculation — unchanged from original
  const pinPosition = useMemo(() => {
    if (!location) return null;
    const targetPhi = (90 - location.lat) * (Math.PI / 180);
    const targetTheta = (location.lng + 90) * (Math.PI / 180);
    const radius = 1.6;
    return new THREE.Vector3(
      radius * Math.sin(targetPhi) * Math.sin(targetTheta),
      radius * Math.cos(targetPhi),
      radius * Math.sin(targetPhi) * Math.cos(targetTheta)
    );
  }, [location]);

  // Align sphere to pin on location change — unchanged from original
  useEffect(() => {
    if (!meshRef.current || !location) return;
    meshRef.current.quaternion.set(0, 0, 0, 1);
    const targetVec = pinPosition.clone().normalize();
    const cameraForward = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(targetVec, cameraForward);
    meshRef.current.quaternion.copy(quaternion);
  }, [location, pinPosition]);

  // Reset intro animation whenever location changes
  useEffect(() => {
    animationRef.current.active = true;
    animationRef.current.progress = 0;
  }, [location]);

  // Drive the intro animation each frame
  useFrame((_state, delta) => {
    const anim = animationRef.current;
    if (!anim.active || !groupRef.current) return;

    anim.progress = Math.min(anim.progress + delta / anim.duration, 1);
    const easedProgress = easeOutCubic(anim.progress);
    const currentY = anim.startY + (anim.endY - anim.startY) * easedProgress;

    groupRef.current.rotation.y = currentY;

    if (anim.progress >= 1) {
      anim.active = false;
      groupRef.current.rotation.y = anim.endY; // snap to exact end
    }
  });

  return (
    // group rotation: x=0, y animated (0.5→0), z=-Math.PI/2  — same as original except y is live
    <group ref={groupRef} rotation={[0, 0.5, -Math.PI / 3]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <shaderMaterial
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uMap: { value: texture },
            uColor: { value: new THREE.Color(0xffffff) },
            uGlowColor: { value: new THREE.Color(0x888888) },
          }}
          vertexShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              vUv = uv;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewDir = normalize(-mvPosition.xyz);
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform sampler2D uMap;
            uniform vec3 uColor;
            uniform vec3 uGlowColor;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              vec4 mapData = texture2D(uMap, vUv);
              float intensity = mapData.r;
              float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), 2.0);
              float continentGlow = intensity * 0.5;
              float oceanGlow = (1.0 - intensity) * 0.03;
              float totalAlpha = (continentGlow + oceanGlow + fresnel * 0.6);
              vec3 finalColor = mix(uColor * 0.6, uGlowColor, fresnel);
              gl_FragColor = vec4(finalColor, totalAlpha);
            }
          `}
        />

        {location && (
          <mesh position={pinPosition}>
            <cylinderGeometry args={[0.01, 0, 0.4, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            <mesh position={[0, 0.25, 0]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </mesh>
        )}
      </mesh>
    </group>
  );
};

const GlobeMap = ({ location }) => {
  return (
    <div
      className="globe-map-container"
      style={{
        width: '100%',
        height: '250px',
        position: 'relative',
        marginTop: '20px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <GlobeMesh location={location} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '9px',
          fontFamily: 'monospace',
        }}
      >
        LAT: {location?.lat?.toFixed(4) || '---'} / LNG:{' '}
        {location?.lng?.toFixed(4) || '---'}
      </div>
    </div>
  );
};

export default GlobeMap;