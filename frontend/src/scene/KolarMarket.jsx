/**
 * KolarMarket — APMC mandi building complex with dynamic activity
 * marketPressure 1→0 drives crate activity, congestion, crowd density
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const POS = [42, 0, 18];

export default function KolarMarket({ simState, plan }) {
  const { marketPressure, marketCongestion, t } = simState;
  const crateCount = Math.round(lerp(18, 4, 1 - marketPressure));

  return (
    <group position={POS}>
      {/* Foundation */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[42, 0.3, 32]} />
        <meshLambertMaterial color={new THREE.Color(0.30, 0.30, 0.32)} />
      </mesh>

      {/* Main hall */}
      <MainHall />

      {/* Side stalls */}
      <StallRow position={[-12, 0, 12]} count={4} />
      <StallRow position={[10, 0, 12]} count={3} />
      <StallRow position={[-12, 0, -12]} count={4} />

      {/* Entrance gate */}
      <EntranceGate position={[0, 0, 16]} />

      {/* Activity — crates and vehicles */}
      <MarketActivity crateCount={crateCount} pressure={marketPressure} t={t} />

      {/* Pressure label */}
      <Text
        position={[0, 18, 0]}
        rotation={[-Math.PI / 2.4, 0, 0]}
        fontSize={2.0}
        color={marketPressure > 0.7 ? '#ff6b6b' : marketPressure > 0.5 ? '#ffc107' : '#4caf50'}
        anchorX="center"
        outlineWidth={0.08}
        outlineColor="#000"
      >
        {`KOLAR APMC — ${Math.round(marketPressure * 130)}% LOAD`}
      </Text>

      {/* Pressure bar */}
      <PressureBar pressure={marketPressure} position={[0, 17, 0]} />
    </group>
  );
}

function MainHall() {
  return (
    <group>
      {/* Hall body */}
      <mesh position={[0, 5, -4]} castShadow>
        <boxGeometry args={[30, 10, 22]} />
        <meshLambertMaterial color={new THREE.Color(0.68, 0.62, 0.52)} />
      </mesh>
      {/* Hall roof */}
      <mesh position={[0, 11, -4]} castShadow>
        <boxGeometry args={[32, 1.5, 24]} />
        <meshLambertMaterial color={new THREE.Color(0.45, 0.40, 0.35)} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, 12.5, -4]}>
        <cylinderGeometry args={[1.5, 1.5, 32, 8, 1, false, 0, Math.PI]} />
        <meshLambertMaterial color={new THREE.Color(0.38, 0.33, 0.28)} side={THREE.DoubleSide} />
      </mesh>
      {/* Pillars */}
      {[-12, -4, 4, 12].map((x, i) => (
        <mesh key={i} position={[x, 4.5, 7]} castShadow>
          <cylinderGeometry args={[0.6, 0.7, 9, 8]} />
          <meshLambertMaterial color={new THREE.Color(0.62, 0.58, 0.5)} />
        </mesh>
      ))}
      {/* APMC sign */}
      <mesh position={[0, 12, 7.5]}>
        <boxGeometry args={[16, 3, 0.5]} />
        <meshLambertMaterial color={new THREE.Color(0.12, 0.42, 0.18)} />
      </mesh>
    </group>
  );
}

function StallRow({ position, count }) {
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[i * 7 - (count - 1) * 3.5, 0, 0]}>
          {/* Stall */}
          <mesh position={[0, 2, 0]} castShadow>
            <boxGeometry args={[5.5, 4, 4.5]} />
            <meshLambertMaterial color={new THREE.Color(0.75, 0.68, 0.55)} />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, 4.5, 1.5]}>
            <boxGeometry args={[6.5, 0.5, 6]} />
            <meshLambertMaterial color={[0.75, 0.25, 0.18, 0.65, 0.42][i % 5]
              ? new THREE.Color(0.75, 0.25, 0.18)
              : new THREE.Color(0.12, 0.42, 0.65)} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function EntranceGate({ position }) {
  return (
    <group position={position}>
      {[-6, 6].map((x, i) => (
        <mesh key={i} position={[x, 5, 0]} castShadow>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshLambertMaterial color={new THREE.Color(0.45, 0.45, 0.5)} />
        </mesh>
      ))}
      <mesh position={[0, 10.2, 0]}>
        <boxGeometry args={[13, 1.2, 1.2]} />
        <meshLambertMaterial color={new THREE.Color(0.45, 0.45, 0.5)} />
      </mesh>
    </group>
  );
}

function MarketActivity({ crateCount, pressure, t }) {
  const groupRef = useRef();
  useFrame((state) => {
    if (groupRef.current) {
      // Slight bobbing to suggest activity
      groupRef.current.children.forEach((child, i) => {
        const time = state.clock.elapsedTime;
        child.position.y = 0.4 + Math.sin(time * 0.8 + i * 2.1) * 0.08 * pressure;
      });
    }
  });

  const crates = useMemo(() => {
    return Array.from({ length: Math.max(0, crateCount) }, (_, i) => {
      const angle = (i / crateCount) * Math.PI * 2;
      const r = 6 + (i % 3) * 3;
      return {
        x: Math.cos(angle) * r + (Math.random() - 0.5) * 4,
        z: Math.sin(angle) * r * 0.5 + (Math.random() - 0.5) * 3,
        scale: 0.8 + (i % 4) * 0.2,
        color: i % 3 === 0
          ? new THREE.Color(0.85, 0.62, 0.18)
          : i % 3 === 1
          ? new THREE.Color(0.65, 0.82, 0.35)
          : new THREE.Color(0.78, 0.42, 0.22),
      };
    });
  }, [crateCount]);

  return (
    <group ref={groupRef}>
      {crates.map((c, i) => (
        <mesh key={i} position={[c.x, 0.4, c.z]} scale={c.scale} castShadow>
          <boxGeometry args={[1.5, 0.8, 1.0]} />
          <meshLambertMaterial color={c.color} />
        </mesh>
      ))}
    </group>
  );
}

function PressureBar({ pressure, position }) {
  const color = pressure > 0.7
    ? new THREE.Color(0.9, 0.2, 0.2)
    : pressure > 0.5
    ? new THREE.Color(0.9, 0.6, 0.1)
    : new THREE.Color(0.2, 0.75, 0.3);

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[16, 0.6, 0.3]} />
        <meshLambertMaterial color={new THREE.Color(0.15, 0.15, 0.18)} />
      </mesh>
      <mesh position={[-8 + pressure * 8, 0, 0.2]}>
        <boxGeometry args={[16 * pressure, 0.4, 0.3]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  );
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
