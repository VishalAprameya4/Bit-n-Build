/**
 * 2.5D visual renderer. `simState` remains the single source of animation
 * values; this component only maps those values onto the aerial reference map.
 */
import './CinematicTwin.css';

const W = 1536;
const H = 1024;
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;

function roadPoint(points, t) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const distance = lengths.reduce((sum, value) => sum + value, 0) * clamp(t);
  let travelled = 0;
  for (let index = 0; index < lengths.length; index++) {
    if (distance <= travelled + lengths[index] || index === lengths.length - 1) {
      const local = (distance - travelled) / lengths[index];
      const a = points[index], b = points[index + 1];
      return { x: mix(a[0], b[0], local), y: mix(a[1], b[1], local), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
    }
    travelled += lengths[index];
  }
  return { x: points.at(-1)[0], y: points.at(-1)[1], angle: 0 };
}

// Waypoints follow the visible paved lower-road network traced in the review.
const FARM_TO_STORAGE = [[385, 415], [310, 474], [430, 548], [555, 618], [690, 696], [805, 728], [885, 702], [892, 644], [850, 605]];
const STORAGE_TO_MARKET = [[850, 605], [900, 690], [978, 728], [1168, 728], [1348, 710], [1400, 664], [1380, 600], [1288, 548]];
const FARM_TO_MARKET = [...FARM_TO_STORAGE.slice(0, -1), ...STORAGE_TO_MARKET];
const routeD = points => `M ${points.map(point => point.join(' ')).join(' L ')}`;
const RAIN = Array.from({ length: 180 }, (_, i) => ({ x: (i * 113) % W, y: (i * 71) % H, length: 8 + (i % 6) * 3, delay: -(i % 17) * .13 }));

function Truck({ route, progress, tone = 'red' }) {
  const point = roadPoint(route, clamp(progress));
  return <g className={`map-truck map-truck--${tone}`} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
    <image href="/logistics-truck.png" x="-30" y="-20" width="60" height="40" preserveAspectRatio="xMidYMid meet" />
  </g>;
}

function Clouds({ cover }) {
  const count = Math.ceil(cover * 7);
  return <g className="cloud-bank" opacity={mix(.08, .82, cover)}>{Array.from({ length: count }, (_, i) => <g key={i} transform={`translate(${785 + i * 105} ${80 + (i % 3) * 38})`}><ellipse cx="0" cy="0" rx="88" ry="33" fill="#243549" /><ellipse cx="58" cy="14" rx="78" ry="36" fill="#1d2c3d" /><ellipse cx="-58" cy="14" rx="65" ry="30" fill="#34455a" /></g>)}</g>;
}

function decisionFor(t, rain) {
  if (t < .12) return ['RAIN EXPECTED IN 2 DAYS', 'BEGIN HARVEST TODAY'];
  if (t < .30) return ['TRUCK 1 · FARM → COLD STORAGE', 'HARVEST + STORAGE'];
  if (t < .46) return ['TRUCK 2 · FARM → KOLAR APMC', 'SPLIT DISPATCH'];
  if (rain > .08) return ['HARVEST COMPLETED BEFORE RAIN', 'PRODUCE PROTECTED'];
  if (t < .80) return ['PRODUCE HELD IN STORAGE', 'WAITING FOR MARKET RECOVERY'];
  if (t < .98) return ['TRUCK 3 · STORAGE → KOLAR APMC', 'RELEASE STORED PRODUCE'];
  return ['GLUT PRESSURE · HIGH → REDUCED', 'MARKET STABILIZED'];
}

export default function CinematicTwin({ simState, plan }) {
  const { cropHarvestProgress: harvest, rainIntensity: rain, cloudCover: cloud, storageFill, marketPressure, farmStorageTruckT: farmTruck, farmMarketTruckT: marketTruck, storageMarketTruckT: storageTruck, t } = simState;
  const filter = `brightness(${mix(1, .58, cloud)}) saturate(${mix(1.08, .68, cloud)}) contrast(${mix(1, 1.08, rain)})`;
  const routeDash = 220 - t * 560;
  const [event, decision] = decisionFor(t, rain);
  const allocations = plan?.allocations || [];
  const storageT = allocations.filter(a => a.destination_type === 'storage').reduce((total, a) => total + (a.allocated_t || 0), 0);
  const marketT = allocations.filter(a => a.destination_type === 'market').reduce((total, a) => total + (a.allocated_t || 0), 0);
  return <div className="cinematic-twin" aria-label="Animated regional agricultural digital twin">
    <img className="cinematic-base" src="/agriflow-region.png" alt="Aerial Kolar agricultural region" style={{ filter }} />
    <svg className="cinematic-overlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <clipPath id="tomato-field"><polygon points="405,372 606,348 721,446 494,501" /></clipPath>
        <linearGradient id="storm" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#162e4c" /><stop offset="1" stopColor="#17334f" stopOpacity=".1" /></linearGradient>
        <linearGradient id="harvested" x1="0" x2="1"><stop stopColor="#744d2d" stopOpacity=".8" /><stop offset="1" stopColor="#9b7042" stopOpacity=".45" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#storm)" opacity={mix(0, .44, cloud)} />
      <Clouds cover={cloud} />

      <g clipPath="url(#tomato-field)">
        <rect x="390" y="335" width={340 * harvest} height="190" fill="url(#harvested)" opacity={.88} />
        {Array.from({ length: 16 }, (_, i) => <line key={i} x1={380 + i * 25} y1="350" x2={480 + i * 25} y2="515" stroke="#c99a66" strokeWidth="2" opacity={harvest * .8} />)}
        <rect x="390" y="335" width="340" height="190" fill="none" stroke="#d5bf89" strokeWidth="2" opacity=".55" />
      </g>

      <path d={routeD(FARM_TO_STORAGE)} className="route route-farm" strokeDashoffset={routeDash} opacity={mix(.18, .95, clamp(t * 2))} />
      <path d={routeD(FARM_TO_MARKET)} className="route route-market" strokeDashoffset={routeDash} opacity={clamp((t - .28) * 4)} />
      <path d={routeD(STORAGE_TO_MARKET)} className="route route-storage" strokeDashoffset={routeDash} opacity={clamp((t - .78) * 5)} />
      {farmTruck > 0 && farmTruck < 1 && <Truck route={FARM_TO_STORAGE} progress={farmTruck} />}
      {marketTruck > 0 && marketTruck < 1 && <Truck route={FARM_TO_MARKET} progress={marketTruck} tone="amber" />}
      {storageTruck > 0 && storageTruck < 1 && <Truck route={STORAGE_TO_MARKET} progress={storageTruck} tone="blue" />}

      <g className="storage-signal" transform="translate(782 592)"><rect width="154" height="35" rx="7" fill="#07151dcc" stroke="#79d7f3" /><text x="12" y="14">COLD STORAGE</text><text x="142" y="14" textAnchor="end">{Math.round(storageFill * 100)}%</text><rect x="12" y="22" width="130" height="6" rx="3" fill="#29424b" /><rect x="12" y="22" width={130 * storageFill} height="6" rx="3" fill={storageFill > .8 ? '#e4a33a' : '#55bee3'} /></g>
      <g className="market-signal" transform="translate(1178 447)"><rect width="154" height="33" rx="7" fill="#07151dcc" stroke={marketPressure > .7 ? '#ed705f' : '#77c46b'} /><text x="10" y="14">KOLAR APMC</text><text x="144" y="14" textAnchor="end">{Math.round(marketPressure * 130)}% LOAD</text><rect x="10" y="22" width={130 * marketPressure} height="5" rx="3" fill={marketPressure > .7 ? '#e36554' : '#68bb61'} /></g>
      {RAIN.map((drop, i) => <line key={i} className="rain-drop" x1={drop.x} y1={drop.y} x2={drop.x - 4} y2={drop.y + drop.length} style={{ opacity: rain, animationDelay: `${drop.delay}s` }} />)}
    </svg>
    <div className="map-caption map-caption--farm"><span>FARM REGION</span><b>{Math.round(harvest * 100)}% harvested</b></div>
    <div className="map-decision"><span>{event}</span><b>{decision}</b>{t >= .12 && t < .46 && <small>{storageT || '—'}T → storage &nbsp;·&nbsp; {marketT || '—'}T → market</small>}</div>
    <div className="map-weather" style={{ opacity: Math.max(.32, cloud) }}><span>{rain > .08 ? 'HEAVY RAIN ACTIVE' : t < .12 ? 'RAIN FORECAST · 2 DAYS' : 'WEATHER CLEARING'}</span><i style={{ width: `${cloud * 100}%` }} /></div>
  </div>;
}
