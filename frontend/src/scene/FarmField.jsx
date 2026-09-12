/**
 * FarmField — Tomato crop rows with harvest progression
 * cropHarvestProgress 0→1 makes rows transition from lush green to harvested brown
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const ROWS = 18;
const COLS = 12;
const ROW_SPACING = 2.8;
const COL_SPACING = 3.2;
const FIELD_ORIGIN = [-68, 0, -38]; // top-left corner of field

export default function FarmField({ simState }) {
  const { cropHarvestProgress, harvestActivity, t } = simState;

  // Farmhouse
  return (
    <group>
      {/* Main field */}
      <Field cropHarvestProgress={cropHarvestProgress} harvestActivity={harvestActivity} t={t} />

      {/* Farmhouse */}
      <Farmhouse position={[-78, 0, 10]} />

      {/* Water tank */}
      <mesh position={[-82, 3, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 5, 12]} />
        <meshLambertMaterial color={new THREE.Color(0.45, 0.48, 0.5)} />
      </mesh>

      {/* Field label */}
      <Text
        position={[-55, 6, -40]}
        rotation={[-Math.PI / 2.2, 0, 0.3]}
        fontSize={2.5}
        color="#7ec850"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#000"
      >
        FARM — KOLAR TOMATO
      </Text>

      {/* Harvest progress indicator (floating bar) */}
      <HarvestBar progress={cropHarvestProgress} position={[-55, 8, -12]} />
    </group>
  );
}

function Field({ cropHarvestProgress, harvestActivity, t }) {
  const windRef = useRef(0);

  useFrame((_, delta) => {
    windRef.current += delta * 0.8;
  });

  const rows = useMemo(() => {
    const items = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = FIELD_ORIGIN[0] + col * COL_SPACING;
        const z = FIELD_ORIGIN[2] + row * ROW_SPACING;
        // Harvest progresses left-to-right, then top-to-bottom
        const plantIdx = row * COLS + col;
        const totalPlants = ROWS * COLS;
        const harvestThreshold = cropHarvestProgress * totalPlants;
        const isHarvested = plantIdx < harvestThreshold;
        items.push({ x, z, row, col, isHarvested, plantIdx, seed: Math.sin(plantIdx * 6.7) * 0.5 + 0.5 });
      }
    }
    return items;
  }, [cropHarvestProgress]);

  return (
    <group>
      {/* Soil base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-48, 0.01, -19]} receiveShadow>
        <planeGeometry args={[COLS * COL_SPACING + 4, ROWS * ROW_SPACING + 4]} />
        <meshLambertMaterial color={new THREE.Color(0.28, 0.18, 0.10)} />
      </mesh>

      {/* Crop rows */}
      {rows.map(({ x, z, isHarvested, seed, plantIdx }) => (
        <CropPlant
          key={plantIdx}
          position={[x, 0, z]}
          isHarvested={isHarvested}
          seed={seed}
          t={t}
          windTime={windRef}
        />
      ))}
    </group>
  );
}

function CropPlant({ position, isHarvested, seed, t }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current && !isHarvested) {
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.z = Math.sin(time * 1.2 + seed * 10) * 0.04;
    }
  });

  if (isHarvested) {
    // Show bare soil mound
    return (
      <mesh position={[position[0], 0.1, position[2]]} receiveShadow>
        <sphereGeometry args={[0.55, 6, 4]} />
        <meshLambertMaterial color={new THREE.Color(0.32, 0.20, 0.12)} />
      </mesh>
    );
  }

  const height = 0.8 + seed * 0.6;
  const radius = 0.5 + seed * 0.25;
  // Tomatoes visible as small red spheres on some plants
  const hasTomato = seed > 0.5;

  return (
    <group position={position}>
      {/* Stem */}
      <mesh position={[0, height * 0.4, 0]} castShadow ref={meshRef}>
        <cylinderGeometry args={[0.08, 0.12, height * 0.8, 5]} />
        <meshLambertMaterial color={new THREE.Color(0.22, 0.42, 0.12)} />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, height * 0.85, 0]} castShadow>
        <sphereGeometry args={[radius, 7, 5]} />
        <meshLambertMaterial color={new THREE.Color(0.15, 0.48 + seed * 0.12, 0.10)} />
      </mesh>
      {/* Tomatoes */}
      {hasTomato && (
        <mesh position={[radius * 0.6, height * 0.65, 0]} castShadow>
          <sphereGeometry args={[0.18 + seed * 0.08, 6, 5]} />
          <meshLambertMaterial color={new THREE.Color(0.85, 0.18, 0.08)} />
        </mesh>
      )}
    </group>
  );
}

function HarvestBar({ progress, position }) {
  const pct = Math.round(progress * 100);
  return (
    <group position={position}>
      {/* Background bar */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[14, 0.8, 0.3]} />
        <meshLambertMaterial color={new THREE.Color(0.15, 0.15, 0.15)} transparent opacity={0.7} />
      </mesh>
      {/* Fill bar */}
      <mesh position={[-7 + progress * 7, 0, 0.2]}>
        <boxGeometry args={[14 * progress, 0.6, 0.3]} />
        <meshLambertMaterial color={new THREE.Color(0.55, 0.85, 0.25)} />
      </mesh>
    </group>
  );
}

function Farmhouse({ position }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[10, 6, 8]} />
        <meshLambertMaterial color={new THREE.Color(0.82, 0.72, 0.58)} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 7.5, 0]} castShadow>
        <coneGeometry args={[7.5, 4, 4]} />
        <meshLambertMaterial color={new THREE.Color(0.55, 0.25, 0.15)} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.5, 4.1]} castShadow>
        <boxGeometry args={[1.8, 3, 0.2]} />
        <meshLambertMaterial color={new THREE.Color(0.35, 0.22, 0.12)} />
      </mesh>
      {/* Windows */}
      {[-3, 3].map((x, i) => (
        <mesh key={i} position={[x, 3.5, 4.1]}>
          <boxGeometry args={[1.6, 1.6, 0.2]} />
          <meshLambertMaterial color={new THREE.Color(0.6, 0.75, 0.9)} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
