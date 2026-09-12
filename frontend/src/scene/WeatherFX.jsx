/**
 * WeatherFX — Rain particles + atmospheric effects
 * rainIntensity 0→1 controls rain density and speed
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_RAINDROPS = 3500;

export default function WeatherFX({ simState }) {
  const { rainIntensity } = simState;
  const geoRef    = useRef();
  const velRef    = useRef();
  const posRef    = useRef();

  // Init positions + velocities once
  const { positions, velocities, geometry } = useMemo(() => {
    const pos = new Float32Array(MAX_RAINDROPS * 3);
    const vel = new Float32Array(MAX_RAINDROPS);
    for (let i = 0; i < MAX_RAINDROPS; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 80;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
      vel[i] = 12 + Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { positions: pos, velocities: vel, geometry: geo };
  }, []);

  useFrame((_, delta) => {
    if (rainIntensity < 0.02) return;
    const attr = geometry.attributes.position;
    const arr  = attr.array;
    for (let i = 0; i < MAX_RAINDROPS; i++) {
      arr[i * 3 + 1] -= velocities[i] * delta * rainIntensity * 1.5;
      if (arr[i * 3 + 1] < -2) {
        arr[i * 3 + 1] = 75 + Math.random() * 20;
        arr[i * 3 + 0] = (Math.random() - 0.5) * 220;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 220;
      }
    }
    attr.needsUpdate = true;
  });

  if (rainIntensity < 0.02) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color={new THREE.Color(0.6, 0.70, 0.88)}
        size={0.2}
        transparent
        opacity={Math.min(0.75, rainIntensity * 0.8)}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
