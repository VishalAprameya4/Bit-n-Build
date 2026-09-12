/**
 * AgriWorld — Root Three.js Canvas
 * Composes all 3D scene elements. Camera, lighting, and scene graph.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';
import Environment from './Environment';
import FarmField   from './FarmField';
import Roads       from './Roads';
import Trucks      from './Trucks';
import ColdStorage from './ColdStorage';
import KolarMarket from './KolarMarket';
import WeatherFX   from './WeatherFX';

// Scene coordinate system (all in Three.js units, roughly 1 unit ≈ 10m)
// Farm: (-60, 0, -30) area
// Cold Storage: (-10, 0, 10) area  
// APMC Market: (40, 0, 20) area

export default function AgriWorld({ simState, plan, scenario }) {
  const { ambientLight, sunIntensity, fogDensity } = simState;

  return (
    <Canvas
      camera={{ position: [-20, 80, 100], fov: 45, near: 0.1, far: 2000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      shadows
      style={{ background: '#0a1628' }}
    >
      {/* Fog */}
      <fog attach="fog" args={['#1a2535', 120, 300]} />

      {/* Ambient + directional light */}
      <ambientLight
        intensity={lerp(0.6, 0.25, simState.t)}
        color={new THREE.Color(...ambientLight)}
      />
      <directionalLight
        position={[60, 80, -20]}
        intensity={sunIntensity * 1.5}
        color={new THREE.Color(
          lerp(1.0, 0.7, simState.t),
          lerp(0.95, 0.75, simState.t),
          lerp(0.7, 0.9, simState.t)
        )}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Hemisphere sky light */}
      <hemisphereLight
        skyColor={new THREE.Color(
          lerp(0.4, 0.25, simState.t),
          lerp(0.6, 0.38, simState.t),
          lerp(0.9, 0.6, simState.t)
        )}
        groundColor={new THREE.Color(0.15, 0.22, 0.1)}
        intensity={lerp(0.8, 0.4, simState.t)}
      />

      <Suspense fallback={null}>
        <Environment simState={simState} />
        <FarmField simState={simState} />
        <Roads />
        <ColdStorage simState={simState} />
        <KolarMarket simState={simState} plan={plan} />
        <Trucks simState={simState} plan={plan} />
        <WeatherFX simState={simState} />
      </Suspense>

      <OrbitControls
        target={[10, 0, 10]}
        minDistance={30}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.2}
        enablePan={true}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  );
}

// Inline lerp for color calcs (avoids circular import)
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
