/**
 * Roads — Physical road network connecting Farm → Storage → Market
 * Roads are static geometry; trucks animate along them.
 */
import * as THREE from 'three';

// Road node positions (match truck path waypoints)
export const ROAD_NODES = {
  FARM:    [-55, 0.1,  -5],
  STORAGE: [-10, 0.1,  12],
  MARKET:  [ 42, 0.1,  18],
  EXIT_BLR:[ 80, 0.1,  10],  // Bangalore direction
  EXIT_TKR:[ 40, 0.1,  55],  // Tumkur direction
};

// Road segments (pairs of from→to)
const ROAD_SEGMENTS = [
  ['FARM',    'STORAGE'],
  ['STORAGE', 'MARKET'],
  ['MARKET',  'EXIT_BLR'],
  ['MARKET',  'EXIT_TKR'],
  // Farm can also go directly to market
  ['FARM',    'MARKET'],
];

function RoadSegment({ from, to, width = 3.5 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid   = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const length = a.distanceTo(b);
  const dir    = new THREE.Vector3().subVectors(b, a).normalize();
  const angle  = Math.atan2(dir.x, dir.z);

  return (
    <group position={[mid.x, 0.08, mid.z]} rotation={[0, angle, 0]}>
      {/* Road surface */}
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.12, length]} />
        <meshLambertMaterial color={new THREE.Color(0.22, 0.22, 0.22)} />
      </mesh>
      {/* Centre line dashes */}
      {Array.from({ length: Math.floor(length / 6) }).map((_, i) => {
        const offset = -length / 2 + i * 6 + 3;
        return (
          <mesh key={i} position={[0, 0.07, offset]}>
            <boxGeometry args={[0.15, 0.08, 2]} />
            <meshLambertMaterial color={new THREE.Color(0.85, 0.78, 0.2)} />
          </mesh>
        );
      })}
      {/* Road edge lines */}
      <mesh position={[ width / 2 - 0.15, 0.07, 0]}>
        <boxGeometry args={[0.15, 0.08, length]} />
        <meshLambertMaterial color={new THREE.Color(0.9, 0.88, 0.82)} />
      </mesh>
      <mesh position={[-width / 2 + 0.15, 0.07, 0]}>
        <boxGeometry args={[0.15, 0.08, length]} />
        <meshLambertMaterial color={new THREE.Color(0.9, 0.88, 0.82)} />
      </mesh>
    </group>
  );
}

function SignPost({ position, label, direction }) {
  return (
    <group position={position}>
      {/* Post */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 4, 6]} />
        <meshLambertMaterial color={new THREE.Color(0.3, 0.3, 0.3)} />
      </mesh>
      {/* Sign board */}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[5, 1.5, 0.2]} />
        <meshLambertMaterial color={new THREE.Color(0.1, 0.45, 0.2)} />
      </mesh>
    </group>
  );
}

export default function Roads() {
  return (
    <group>
      {ROAD_SEGMENTS.map(([fromKey, toKey], i) => (
        <RoadSegment
          key={i}
          from={ROAD_NODES[fromKey]}
          to={ROAD_NODES[toKey]}
        />
      ))}

      {/* Road signs */}
      <SignPost position={[65, 0, 12]} label="Bangalore 68 km" />
      <SignPost position={[38, 0, 48]} label="Tumkur 92 km" />
    </group>
  );
}
