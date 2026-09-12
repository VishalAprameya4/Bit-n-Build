/**
 * ColdStorage — Warehouse building with animated fill level indicator
 */
import { useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const POS = [-10, 0, 12]; // scene position

export default function ColdStorage({ simState }) {
  const { storageFill } = simState;
  const fillPct = Math.round(storageFill * 100);

  return (
    <group position={POS}>
      {/* Foundation slab */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[22, 0.3, 18]} />
        <meshLambertMaterial color={new THREE.Color(0.35, 0.35, 0.38)} />
      </mesh>

      {/* Main warehouse body */}
      <mesh position={[0, 5.5, 0]} castShadow>
        <boxGeometry args={[20, 11, 16]} />
        <meshLambertMaterial color={new THREE.Color(0.72, 0.75, 0.80)} />
      </mesh>

      {/* Roof — arched / barrel */}
      <mesh position={[0, 11.5, 0]} castShadow>
        <cylinderGeometry args={[11.4, 11.4, 16.5, 20, 1, false, 0, Math.PI]} />
        <meshLambertMaterial color={new THREE.Color(0.5, 0.52, 0.58)} side={THREE.DoubleSide} />
      </mesh>

      {/* Front facade - glass panels */}
      <mesh position={[0, 6, 8.1]}>
        <boxGeometry args={[18, 10, 0.2]} />
        <meshLambertMaterial color={new THREE.Color(0.55, 0.75, 0.95)} transparent opacity={0.35} />
      </mesh>

      {/* Storage fill visualization — rising level bar inside */}
      <FillIndicator fill={storageFill} />

      {/* Loading dock */}
      <LoadingDock position={[0, 0, -9]} />

      {/* Chill pipes */}
      {[-7, -2, 3, 8].map((x, i) => (
        <mesh key={i} position={[x, 12.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 18, 6]} />
          <meshLambertMaterial color={new THREE.Color(0.55, 0.58, 0.65)} />
        </mesh>
      ))}

      {/* Label */}
      <Text
        position={[0, 15, 0]}
        rotation={[-Math.PI / 2.5, 0, 0]}
        fontSize={2.2}
        color="#4fc3f7"
        anchorX="center"
        outlineWidth={0.08}
        outlineColor="#000"
      >
        {`COLD STORAGE — ${fillPct}% FULL`}
      </Text>

      {/* Utilization bar above building */}
      <UtilBar fill={storageFill} position={[0, 14, 0]} />
    </group>
  );
}

function FillIndicator({ fill }) {
  const maxHeight = 10;
  const fillH = Math.max(0.1, fill * maxHeight);

  return (
    <group position={[7, 0.3, 0]}>
      {/* Glass container */}
      <mesh position={[0, maxHeight / 2, 0]}>
        <boxGeometry args={[3.5, maxHeight, 1]} />
        <meshLambertMaterial color={new THREE.Color(0.5, 0.7, 0.9)} transparent opacity={0.15} />
      </mesh>
      {/* Fill level */}
      <mesh position={[0, fillH / 2, 0]}>
        <boxGeometry args={[3.3, fillH, 0.8]} />
        <meshLambertMaterial
          color={fill > 0.8
            ? new THREE.Color(0.9, 0.5, 0.15)  // amber when near full
            : new THREE.Color(0.15, 0.65, 0.92)
          }
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

function UtilBar({ fill, position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[12, 0.6, 0.3]} />
        <meshLambertMaterial color={new THREE.Color(0.15, 0.15, 0.18)} />
      </mesh>
      <mesh position={[-6 + fill * 6, 0, 0.2]}>
        <boxGeometry args={[12 * fill, 0.4, 0.3]} />
        <meshLambertMaterial color={fill > 0.8 ? new THREE.Color(0.9, 0.6, 0.1) : new THREE.Color(0.15, 0.65, 0.92)} />
      </mesh>
    </group>
  );
}

function LoadingDock({ position }) {
  return (
    <group position={position}>
      {/* Platform */}
      <mesh position={[0, 1.2, 0]} receiveShadow>
        <boxGeometry args={[14, 2.4, 5]} />
        <meshLambertMaterial color={new THREE.Color(0.38, 0.38, 0.42)} />
      </mesh>
      {/* Dock doors */}
      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, 1.8, 2.2]}>
          <boxGeometry args={[3, 3, 0.2]} />
          <meshLambertMaterial color={new THREE.Color(0.28, 0.28, 0.32)} />
        </mesh>
      ))}
      {/* Bumpers */}
      {[-5, -1.5, 1.5, 5].map((x, i) => (
        <mesh key={i} position={[x, 1.0, 2.3]}>
          <boxGeometry args={[0.4, 1.6, 0.3]} />
          <meshLambertMaterial color={new THREE.Color(0.8, 0.7, 0.1)} />
        </mesh>
      ))}
    </group>
  );
}
