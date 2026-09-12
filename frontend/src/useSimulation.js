/**
 * AGRI-FLOW Simulation Engine
 * Manages the timeline slider and derives all animated world state via lerp/easing.
 * t = 0 → Sep 12 (Now)   t = 1 → Sep 17 (+5 Days)
 *
 * All interpolation happens here. Scene components read from simState only.
 * NO agricultural calculations — backend is the source of truth for decisions.
 */
import { useState, useEffect, useCallback } from 'react';

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
  { t: 0.20, label: 'Sep 13', sub: 'Harvest + Split' },
  { t: 0.40, label: 'Sep 14', sub: 'Heavy Rain' },
  { t: 0.60, label: 'Sep 15', sub: 'Recovery' },
  { t: 0.80, label: 'Sep 16', sub: 'Release' },
  { t: 1.00, label: 'Sep 17', sub: 'Stabilized' },
];

export const SPEED_OPTIONS = [1, 2, 4];

// ── Derive simulation world state from t + backend data ──────────────────────
export function deriveSimState(t, backendScenario) {
  const scenario = backendScenario || {};

  // ── Weather ──────────────────────────────────────────────────────────────
  // The rain is a consequence, not the final state: storm builds into Sep 14
  // and clears by recovery on Sep 15.
  const rainIntensity = clamp01(
    easeOut(remap(t, 0.34, 0.40)) * (1 - easeInOut(remap(t, 0.46, 0.60)))
  );
  const stormClouds = lerp(0.10, 0.90, easeInOut(remap(t, 0.05, 0.40)));
  const cloudCover  = lerp(stormClouds, 0.24, easeInOut(remap(t, 0.52, 0.68)));
  const sunIntensity = lerp(1.0, 0.46, remap(t, 0.05, 0.40)) + 0.30 * easeInOut(remap(t, 0.55, 0.72));
  const fogDensity   = 0.012 * rainIntensity;

  // Ambient light: warm golden at t=0, cool grey-blue at t=1
  const ambientR = lerp(0.92, 0.55, t);
  const ambientG = lerp(0.88, 0.60, t);
  const ambientB = lerp(0.72, 0.75, t);

  // ── Farm / Harvest ────────────────────────────────────────────────────────
  // Harvest begins after the NOW decision and is complete before the Sep 14 rain.
  const cropHarvestProgress = clamp01(easeInOut(remap(t, 0.03, 0.40)));
  const harvestActivity     = clamp01(
    remap(t, 0.03, 0.14) - remap(t, 0.36, 0.42)
  );

  // ── Storage ───────────────────────────────────────────────────────────────
  // Storage is intentionally already half occupied when the decision is made.
  // It fills from truck 1, then holds through recovery before truck 3 releases it.
  const baseStorageFill = scenario.available_storage?.length > 0
    ? 1 - (scenario.available_storage[0]?.available_t || 0) / 1200
    : 0.50;
  const initialStorageFill = Math.max(0.50, baseStorageFill);
  const storedPeak = lerp(initialStorageFill, 0.82, easeInOut(remap(t, 0.14, 0.44)));
  const storageFill = lerp(storedPeak, 0.56, easeInOut(remap(t, 0.80, 1.0)));

  // ── Trucks ────────────────────────────────────────────────────────────────
  // Staggered dispatches make the split decision legible: storage first,
  // market second, then the stored release only after recovery.
  const farmStorageTruckT   = clamp01(remap(t, 0.10, 0.26));
  const farmMarketTruckT    = clamp01(remap(t, 0.32, 0.58));
  const storageMarketTruckT = clamp01(remap(t, 0.80, 0.98));
  const truckActivity = clamp01(
    remap(t, 0.12, 0.30) * 0.6 + remap(t, 0.80, 0.98) * 0.4
  );

  // ── Market ────────────────────────────────────────────────────────────────
  // Market pressure comes from backend saturation_pct; decreases over time
  const baseMarketPressure = clamp01((scenario.saturation_pct || 107) / 130);
  const marketPressure     = lerp(baseMarketPressure, 0.38, easeInOut(t));
  const marketCongestion   = marketPressure; // drives visual activity

  // ── Insight / narrative ───────────────────────────────────────────────────
  let insight, action, impact;
  if (t < 0.12) {
    insight = 'RAIN EXPECTED IN 2 DAYS — mature tomatoes are inside the harvest window.';
    action  = 'DECISION: BEGIN HARVEST TODAY';
    impact  = 'Protect ready crop before rainfall while market pressure is high.';
  } else if (t < 0.30) {
    insight = 'Truck 1 is routing harvest to cold storage. Storage is already partially occupied.';
    action  = 'HARVEST + SPLIT DISPATCH — STORAGE FIRST';
    impact  = 'The remaining harvest will be routed directly to Kolar APMC after a visible dispatch gap.';
  } else if (t < 0.46) {
    insight = 'Truck 2 is routing the remaining harvest directly to Kolar APMC.';
    action  = 'SPLIT DISPATCH — FARM → MARKET';
    impact  = 'HARVEST COMPLETED BEFORE RAIN — protected produce avoids weather loss.';
  } else if (t < 0.68) {
    insight = 'Heavy rain has passed. Harvested produce remains protected in cold storage.';
    action  = 'PRODUCE HELD IN STORAGE';
    impact  = 'Waiting for improved market conditions before releasing stored inventory.';
  } else if (t < 0.84) {
    insight = 'Weather has cleared and market pressure is improving.';
    action  = 'DECISION: RELEASE STORED PRODUCE';
    impact  = 'Prepare the storage → Kolar APMC dispatch while inventory remains protected.';
  } else {
    insight = 'Truck 3 is releasing stored produce into a recovering Kolar market.';
    action  = 'RELEASE FROM STORAGE — STORAGE → MARKET';
    impact  = 'GLUT PRESSURE: HIGH → REDUCED. Market activity and storage inventory are stabilizing.';
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
    farmStorageTruckT, farmMarketTruckT, storageMarketTruckT, truckActivity,
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
  // Interval clock keeps the visible timeline advancing even when the canvas is busy.
  useEffect(() => {
    if (!playing) return undefined;
    const DURATION_SECS = 60; // 1x intentionally plays at half the prior speed for inspection
    const clock = window.setInterval(() => {
      setT(previous => {
        const next = previous + (0.1 / DURATION_SECS) * speed;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
    }, 100);
    return () => window.clearInterval(clock);
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
