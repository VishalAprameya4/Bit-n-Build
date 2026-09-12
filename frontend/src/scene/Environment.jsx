/**
 * Environment — Sky dome, custom clouds, background terrain, trees
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

export default function Environment({ simState }) {
  const { cloudCover, t } = simState;

  const sunPosition = [
    Math.cos((t * 0.3 + 0.1) * Math.PI) * 100,
    Math.max(3, lerp(30, 8, t)),
    -80,
  ];

  return (
    <group>
      <Sky
        distance={450}
        sunPosition={sunPosition}
        turbidity={lerp(1.5, 14, cloudCover)}
        rayleigh={lerp(0.4, 4.5, cloudCover)}
        mieCoefficient={lerp(0.003, 0.01, cloudCover)}
        mieDirectionalG={lerp(0.82, 0.55, cloudCover)}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color={new THREE.Color(0.15, 0.22, 0.10)} />
      </mesh>

      {/* Distant hills */}
      <HillRange position={[-130, 0, -90]} />
      <HillRange position={[70, 0, -110]} scale={[1.5, 1.2, 1]} />
      <HillRange position={[-20, 0, -130]} scale={[1.8, 0.9, 1]} />

      {/* Procedural clouds */}
      {cloudCover > 0.1 && (
        <CloudLayer cloudCover={cloudCover} />
      )}

      {/* Tree borders */}
      <TreeRow z={-30} count={20} xStart={-95} xEnd={90} />
      <TreeRow z={60}  count={16} xStart={-70} xEnd={90} />
      <TreeRow x={-98} count={12} zStart={-30} zEnd={60} />
      <TreeRow x={92}  count={12} zStart={-30} zEnd={60} />
    </group>
  );
}

// ── Procedural clouds (no Drei Cloud dependency) ──────────────────
function CloudPuff({ position, scale = 1 }) {
  return (
    <group position={position}>
      {[
        [0, 0, 0, 5, 3, 6],
        [-4, -1.5, 0, 4, 2.5, 5],
        [4, -1.5, 0, 4.5, 2.5, 5],
        [0, -1.5, -3.5, 3.5, 2, 4],
        [0, -1.5, 3.5, 3.5, 2, 4],
      ].map(([x, y, z, rx, ry, rz], i) => (
        <mesh key={i} position={[x * scale, y * scale, z * scale]}>
          <sphereGeometry args={[Math.min(rx, ry, rz) * scale * 0.55, 7, 5]} />
          <meshLambertMaterial
            color={new THREE.Color(0.88, 0.90, 0.92)}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

const CLOUD_POSITIONS = [
  { pos: [-40, 48, -65], scale: 2.8 },
  { pos: [15,  52, -78], scale: 2.4 },
  { pos: [55,  44, -55], scale: 3.0 },
  { pos: [-5,  40, -44], scale: 2.6 },
  { pos: [35,  46, -50], scale: 2.2 },
  { pos: [-60, 50, -58], scale: 2.5 },
  { pos: [75,  42, -62], scale: 2.1 },
  { pos: [0,   45, -90], scale: 3.2 },
];

function CloudLayer({ cloudCover }) {
  const visibleCount = Math.ceil(cloudCover * CLOUD_POSITIONS.length);
  return (
    <group>
      {CLOUD_POSITIONS.slice(0, visibleCount).map((c, i) => (
        <CloudPuff key={i} position={c.pos} scale={c.scale * lerp(0.5, 1, cloudCover)} />
      ))}
    </group>
  );
}

// ── Hill range ────────────────────────────────────────────────────
function HillRange({ position = [0, 0, 0], scale = [1, 1, 1] }) {
  return (
    <group position={position} scale={scale}>
      {[0, 28, -25, 48, -50, 70].map((x, i) => (
        <mesh key={i} position={[x, 7 + i * 2, 0]}>
          <coneGeometry args={[20 + i * 3, 24 + i * 4, 8]} />
          <meshLambertMaterial color={new THREE.Color(0.10, 0.18, 0.08)} />
        </mesh>
      ))}
    </group>
  );
}

// ── Trees ─────────────────────────────────────────────────────────
function TreeRow({ z, x, count = 14, xStart, xEnd, zStart, zEnd }) {
  const trees = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const tx = x !== undefined ? x + (Math.sin(i * 1.8) * 2) : lerp(xStart, xEnd, ratio) + Math.sin(i * 2.1) * 1.5;
    const tz = z !== undefined ? z + (Math.cos(i * 1.9) * 2) : lerp(zStart, zEnd, ratio) + Math.cos(i * 1.7) * 1.5;
    const h  = 3.5 + Math.sin(i * 5.3) * 1.8;
    const s  = Math.sin(i * 7.3) * 0.5 + 0.5;
    trees.push(
      <group key={i} position={[tx, 0, tz]}>
        <mesh position={[0, h * 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.32, h * 0.7, 6]} />
          <meshLambertMaterial color={new THREE.Color(0.30, 0.18, 0.10)} />
        </mesh>
        <mesh position={[0, h * 0.85, 0]} castShadow>
          <sphereGeometry args={[1.6 + s * 0.8, 7, 6]} />
          <meshLambertMaterial color={new THREE.Color(0.10, 0.30 + s * 0.15, 0.07)} />
        </mesh>
      </group>
    );
  }
  return <group>{trees}</group>;
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
