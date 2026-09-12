/**
 * Trucks — Animated truck models following road paths.
 * farmStorageTruckT 0→1: Farm→Storage wave (early timeline)
 * storageMarketTruckT 0→1: Storage→Market wave (late timeline)
 * Number of trucks derived from backend plan allocations.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_NODES } from './Roads';

// Build a CatmullRom path for each route
function makePath(waypoints) {
  return new THREE.CatmullRomCurve3(
    waypoints.map(p => new THREE.Vector3(...p)),
    false, 'catmullrom', 0.5
  );
}

const PATHS = {
  FARM_STORAGE: makePath([
    ROAD_NODES.FARM,
    [-38, 0.1, 0],
    [-22, 0.1, 8],
    ROAD_NODES.STORAGE,
  ]),
  FARM_MARKET: makePath([
    ROAD_NODES.FARM,
    [-28, 0.1, 0],
    [5,   0.1, 8],
    [24,  0.1, 14],
    ROAD_NODES.MARKET,
  ]),
  STORAGE_MARKET: makePath([
    ROAD_NODES.STORAGE,
    [8,   0.1, 14],
    [24,  0.1, 16],
    ROAD_NODES.MARKET,
  ]),
  MARKET_BANGALORE: makePath([
    ROAD_NODES.MARKET,
    [58,  0.1, 12],
    ROAD_NODES.EXIT_BLR,
  ]),
  MARKET_TUMKUR: makePath([
    ROAD_NODES.MARKET,
    [42,  0.1, 36],
    ROAD_NODES.EXIT_TKR,
  ]),
};

// Truck color by route type
const ROUTE_COLORS = {
  FARM_STORAGE:     new THREE.Color(0.2, 0.6, 0.3),  // green
  FARM_MARKET:      new THREE.Color(0.9, 0.7, 0.1),  // yellow
  STORAGE_MARKET:   new THREE.Color(0.2, 0.5, 0.9),  // blue
  MARKET_BANGALORE: new THREE.Color(0.7, 0.3, 0.8),  // purple
  MARKET_TUMKUR:    new THREE.Color(0.9, 0.45, 0.1), // orange
};

// How many trucks per route based on allocated_t (rough: 1 truck per 40T)
function trucksFromAllocation(allocations, routeKey, defaultCount = 2) {
  if (!allocations?.length) return defaultCount;
  const destMap = {
    FARM_STORAGE:     ['storage'],
    STORAGE_MARKET:   ['market'],
    FARM_MARKET:      ['market'],
    MARKET_BANGALORE: ['market'],
  };
  const types = destMap[routeKey] || [];
  const total = allocations
    .filter(a => types.includes(a.destination_type))
    .reduce((s, a) => s + (a.allocated_t || 0), 0);
  return Math.max(1, Math.min(6, Math.round(total / 50)));
}

function Truck({ path, progress, color, scale = 1 }) {
  const groupRef = useRef();
  const pt = path.getPoint(clamp01(progress));
  const tangent = path.getTangent(clamp01(progress + 0.01));
  const angle = Math.atan2(tangent.x, tangent.z);

  return (
    <group
      ref={groupRef}
      position={[pt.x, 0.6 * scale, pt.z]}
      rotation={[0, angle, 0]}
      scale={scale}
    >
      {/* Cab */}
      <mesh position={[0, 0.8, -1.2]} castShadow>
        <boxGeometry args={[2.2, 1.8, 2]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 1.2, -2.15]}>
        <boxGeometry args={[1.8, 0.9, 0.1]} />
        <meshLambertMaterial color={new THREE.Color(0.6, 0.75, 0.9)} transparent opacity={0.7} />
      </mesh>
      {/* Cargo box */}
      <mesh position={[0, 0.7, 1.5]} castShadow>
        <boxGeometry args={[2.2, 2.0, 4.5]} />
        <meshLambertMaterial color={color.clone().multiplyScalar(0.75)} />
      </mesh>
      {/* Wheels */}
      {[[-1.1, -0.55, -1.8], [1.1, -0.55, -1.8], [-1.1, -0.55, 0.8], [1.1, -0.55, 0.8], [-1.1, -0.55, 2.8], [1.1, -0.55, 2.8]].map((wp, i) => (
        <mesh key={i} position={wp} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.5, 0.5, 0.35, 10]} />
          <meshLambertMaterial color={new THREE.Color(0.15, 0.15, 0.15)} />
        </mesh>
      ))}
    </group>
  );
}

function clamp01(t) { return Math.max(0, Math.min(1, t)); }

export default function Trucks({ simState, plan }) {
  const { farmStorageTruckT, storageMarketTruckT, t } = simState;
  const allocations = plan?.allocations || [];

  // Farm→Storage trucks: active in first half
  const fsCount = trucksFromAllocation(allocations, 'FARM_STORAGE', 3);
  const smCount = trucksFromAllocation(allocations, 'STORAGE_MARKET', 2);

  // Generate truck instances with staggered progress offsets
  const farmStorageTrucks = useMemo(() => {
    return Array.from({ length: fsCount }, (_, i) => ({
      id: `fs_${i}`,
      offset: i / fsCount,
      path: PATHS.FARM_STORAGE,
      color: ROUTE_COLORS.FARM_STORAGE.clone(),
    }));
  }, [fsCount]);

  const storageMarketTrucks = useMemo(() => {
    return Array.from({ length: smCount }, (_, i) => ({
      id: `sm_${i}`,
      offset: i / smCount,
      path: PATHS.STORAGE_MARKET,
      color: ROUTE_COLORS.STORAGE_MARKET.clone(),
    }));
  }, [smCount]);

  // Direct farm→market (minor stream)
  const directMarketTruck = t > 0.05 && t < 0.45;

  return (
    <group>
      {/* Farm → Storage trucks (early timeline) */}
      {farmStorageTrucks.map(truck => {
        const progress = clamp01(farmStorageTruckT + truck.offset * 0.5 - 0.25);
        const visible  = farmStorageTruckT > 0.0 && farmStorageTruckT < 1.0;
        if (!visible && progress <= 0.02) return null;
        return (
          <Truck
            key={truck.id}
            path={truck.path}
            progress={progress}
            color={truck.color}
          />
        );
      })}

      {/* Storage → Market trucks (late timeline) */}
      {storageMarketTrucks.map(truck => {
        const progress = clamp01(storageMarketTruckT + truck.offset * 0.4 - 0.2);
        const visible  = storageMarketTruckT > 0.05;
        if (!visible) return null;
        return (
          <Truck
            key={truck.id}
            path={truck.path}
            progress={progress}
            color={truck.color}
          />
        );
      })}

      {/* Direct Farm → Market truck */}
      {directMarketTruck && (
        <Truck
          path={PATHS.FARM_MARKET}
          progress={clamp01((t - 0.05) / 0.4)}
          color={ROUTE_COLORS.FARM_MARKET.clone()}
        />
      )}

      {/* Market → Bangalore truck (when market pressure falls) */}
      {t > 0.5 && (
        <Truck
          path={PATHS.MARKET_BANGALORE}
          progress={clamp01((t - 0.5) / 0.5)}
          color={ROUTE_COLORS.MARKET_BANGALORE.clone()}
        />
      )}
    </group>
  );
}
