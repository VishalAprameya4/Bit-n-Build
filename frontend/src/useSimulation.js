/**
 * AGRI-FLOW Simulation Engine
 * Manages the timeline slider and derives all animated world state via lerp/easing.
 * t = 0 → Sep 12 (Now)   t = 1 → Sep 17 (+5 Days)
 *
 * All interpolation happens here. Scene components read from simState only.
 * NO agricultural calculations — backend is the source of truth for decisions.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Math helpers ──────────────────────────────────────────────────────────────
export function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
export function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
export function easeOut(t) { return 1 - Math.pow(1 - t, 2); }
export function clamp01(t) { return Math.max(0, Math.min(1, t)); }
export function invLerp(a, b, v) { return b === a ? 0 : clamp01((v - a) / (b - a)); }

// Remap t from [inMin,inMax] to [0,1] clamped
export function remap(t, inMin, inMax) { return clamp01((t - inMin) / (inMax - inMin)); }

// ── Timeline labels ────────────────────────────────────────────────────────────
export const TIMELINE_STEPS = [
  { t: 0.00, label: 'Sep 12', sub: 'Now' },
  { t: 0.20, label: 'Sep 13', sub: '+1 Day' },
  { t: 0.40, label: 'Sep 14', sub: '+2 Days' },
  { t: 0.60, label: 'Sep 15', sub: '+3 Days' },
  { t: 0.80, label: 'Sep 16', sub: '+4 Days' },
  { t: 1.00, label: 'Sep 17', sub: '+5 Days' },
];

export const SPEED_OPTIONS = [1, 2, 4];

// ── Derive simulation world state from t + backend data ──────────────────────
export function deriveSimState(t, backendScenario) {
  const scenario = backendScenario || {};

  // ── Weather ──────────────────────────────────────────────────────────────
  // Rain starts around day 1.5 (t=0.3), peaks at day 3 (t=0.6)
  const rainIntensity = clamp01(easeOut(remap(t, 0.30, 0.70)));
  const cloudCover    = lerp(0.05, 0.88, easeInOut(t));
  const sunIntensity  = lerp(1.0, 0.25, t);
  const fogDensity    = lerp(0.0, 0.015, remap(t, 0.5, 1.0));

  // Ambient light: warm golden at t=0, cool grey-blue at t=1
  const ambientR = lerp(0.92, 0.55, t);
  const ambientG = lerp(0.88, 0.60, t);
  const ambientB = lerp(0.72, 0.75, t);

  // ── Farm / Harvest ────────────────────────────────────────────────────────
  // Harvest begins aggressively before rain (day 0 to 2, t 0→0.4)
  const cropHarvestProgress = clamp01(easeInOut(remap(t, 0.0, 0.45)));
  const harvestActivity     = clamp01(
    remap(t, 0.0, 0.15) - remap(t, 0.40, 0.55)  // ramps up, then stops
  );

  // ── Storage ───────────────────────────────────────────────────────────────
  // Produce arrives at storage from day 0.5 to 2.5 (t 0.1→0.5)
  // Storage fill from backend: use available_storage to seed initial fill
  const baseStorageFill = scenario.available_storage?.length > 0
    ? 1 - (scenario.available_storage[0]?.available_t || 0) / 1200
    : 0.35;
  const storageFill = lerp(
    Math.max(0.25, baseStorageFill),
    0.85,
    easeInOut(remap(t, 0.10, 0.60))
  );

  // ── Trucks ────────────────────────────────────────────────────────────────
  // Truck waves: Farm→Storage early, Storage→Market later
  const farmStorageTruckT  = clamp01(remap(t, 0.0, 0.5)); // Farm→Storage wave
  const storageMarketTruckT = clamp01(remap(t, 0.4, 1.0)); // Storage→Market wave
  const truckActivity = clamp01(
    remap(t, 0.0, 0.15) * 0.6 + remap(t, 0.4, 0.6) * 0.4
  );

  // ── Market ────────────────────────────────────────────────────────────────
  // Market pressure comes from backend saturation_pct; decreases over time
  const baseMarketPressure = clamp01((scenario.saturation_pct || 107) / 130);
  const marketPressure     = lerp(baseMarketPressure, 0.38, easeInOut(t));
  const marketCongestion   = marketPressure; // drives visual activity

  // ── Insight / narrative ───────────────────────────────────────────────────
  let insight, action, impact;
  if (t < 0.15) {
    insight = 'Tomato glut detected at Kolar APMC — supply 45% above baseline.';
    action  = 'HARVEST + STORE — Begin immediate harvest before rainfall.';
    impact  = 'Reduce weather-related loss by ~7.8T. Ease market pressure.';
  } else if (t < 0.35) {
    insight = 'Harvest underway. First truck convoys moving toward cold storage.';
    action  = 'PRIORITIZE COLD STORAGE — Route surplus to S1_KOLAR_COLD first.';
    impact  = 'Storage fill will peak at ~82% — within safe capacity.';
  } else if (t < 0.55) {
    insight = 'Rain arrived. Unharvested fields protected — harvest 78% complete.';
    action  = 'MONITOR STORAGE — Prepare onward dispatch to Bangalore.';
    impact  = 'Market glut risk reducing. Surplus down to ~160T.';
  } else if (t < 0.80) {
    insight = 'Storage at capacity. Secondary dispatch to Bangalore/Tumkur initiated.';
    action  = 'DISPATCH VIA ALTERNATE ROUTES — Storage → Market trucks active.';
    impact  = 'Price stabilization in 2–3 days. Market load dropping.';
  } else {
    insight = 'Supply redistribution complete. Market pressure normalized.';
    action  = 'MAINTAIN — Monitor for secondary glut. Price trend recovering.';
    impact  = 'Market surplus reduced by ~42%. Prices stabilizing in 3–5 days.';
  }

  return {
    t,
    // weather
    rainIntensity, cloudCover, sunIntensity, fogDensity,
    ambientLight: [ambientR, ambientG, ambientB],
    // farm
    cropHarvestProgress, harvestActivity,
    // storage
    storageFill,
    // trucks
    farmStorageTruckT, storageMarketTruckT, truckActivity,
    // market
    marketPressure, marketCongestion,
    // narrative
    insight, action, impact,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSimulation(backendScenario) {
  const [t, setT]             = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed]     = useState(1);
  const rafRef                = useRef(null);
  const lastRef               = useRef(null);

  // Auto-advance t when playing
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const DURATION_SECS = 30; // 30 real seconds to traverse full 5-day scenario at 1x
    const step = () => {
      const now = performance.now();
      if (lastRef.current !== null) {
        const dt = (now - lastRef.current) / 1000; // seconds
        const advance = (dt / DURATION_SECS) * speed;
        setT(prev => {
          const next = prev + advance;
          if (next >= 1) { setPlaying(false); return 1; }
          return next;
        });
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(step);
    };
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const play       = useCallback(() => { if (t >= 1) setT(0); setPlaying(true);  }, [t]);
  const pause      = useCallback(() => setPlaying(false), []);
  const seekTo     = useCallback((val) => { setT(val); }, []);
  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  const simState = deriveSimState(t, backendScenario);

  return { t, playing, speed, simState, play, pause, seekTo, cycleSpeed };
}
