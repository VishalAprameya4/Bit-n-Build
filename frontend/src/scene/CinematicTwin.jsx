/**
 * 2.5D visual renderer. `simState` remains the single source of animation
 * values; this component only maps those values onto the aerial reference map.
 */
import './CinematicTwin.css';

const W = 1536;
const H = 1024;
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;

function cubic(points, t) {
  const [a, b, c, d] = points;
  const u = 1 - t;
  const x = u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0];
  const y = u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1];
  const dx = 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0]);
  const dy = 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1]);
  return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}

const FARM_TO_STORAGE = [[480, 404], [545, 436], [666, 540], [778, 634]];
const STORAGE_TO_MARKET = [[778, 634], [898, 681], [1050, 633], [1242, 560]];
const RAIN = Array.from({ length: 180 }, (_, i) => ({ x: (i * 113) % W, y: (i * 71) % H, length: 8 + (i % 6) * 3, delay: -(i % 17) * .13 }));
const MARKET_ACTIVITY = Array.from({ length: 36 }, (_, i) => ({ x: 1130 + (i * 29) % 250, y: 485 + (i * 47) % 150, delay: -(i % 8) * .25 }));

function Truck({ route, progress, color, label }) {
  const point = cubic(route, clamp(progress));
  return <g className="map-truck" transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
    <rect x="-18" y="-8" width="27" height="16" rx="2" fill="#f2f3ed" stroke="#17242d" strokeWidth="2" />
    <rect x="9" y="-7" width="13" height="14" rx="2" fill={color} stroke="#17242d" strokeWidth="2" />
    <rect x="12" y="-4" width="7" height="4" rx="1" fill="#9fd0df" />
    <circle cx="-10" cy="9" r="4" fill="#152127" /><circle cx="15" cy="9" r="4" fill="#152127" />
    <text x="-6" y="-13" textAnchor="middle">{label}</text>
  </g>;
}

function Clouds({ cover }) {
  const count = Math.ceil(cover * 7);
  return <g className="cloud-bank" opacity={mix(.08, .82, cover)}>{Array.from({ length: count }, (_, i) => <g key={i} transform={`translate(${785 + i * 105} ${80 + (i % 3) * 38})`}><ellipse cx="0" cy="0" rx="88" ry="33" fill="#243549" /><ellipse cx="58" cy="14" rx="78" ry="36" fill="#1d2c3d" /><ellipse cx="-58" cy="14" rx="65" ry="30" fill="#34455a" /></g>)}</g>;
}

export default function CinematicTwin({ simState }) {
  const { cropHarvestProgress: harvest, rainIntensity: rain, cloudCover: cloud, storageFill, marketPressure, farmStorageTruckT: farmTruck, storageMarketTruckT: storageTruck, t } = simState;
  const filter = `brightness(${mix(1, .58, cloud)}) saturate(${mix(1.08, .68, cloud)}) contrast(${mix(1, 1.08, rain)})`;
  const marketCount = Math.round(marketPressure * MARKET_ACTIVITY.length);
  const routeDash = 220 - t * 560;
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

      <path d="M480 404 C545 436 666 540 778 634" className="route route-farm" strokeDashoffset={routeDash} opacity={mix(.18, .95, clamp(t * 2))} />
      <path d="M778 634 C898 681 1050 633 1242 560" className="route route-storage" strokeDashoffset={routeDash} opacity={mix(.08, .92, clamp((t - .4) * 2))} />
      {farmTruck < 1 && <Truck route={FARM_TO_STORAGE} progress={farmTruck} color="#4faa66" label="HARVEST" />}
      {storageTruck > 0 && <Truck route={STORAGE_TO_MARKET} progress={storageTruck} color="#4a9bd1" label="DISPATCH" />}

      <g className="storage-signal" transform="translate(780 592)"><rect width="120" height="35" rx="7" fill="#07151dcc" stroke="#79d7f3" /><text x="10" y="14">COLD STORAGE</text><rect x="10" y="22" width="98" height="6" rx="3" fill="#29424b" /><rect x="10" y="22" width={98 * storageFill} height="6" rx="3" fill={storageFill > .8 ? '#e4a33a' : '#55bee3'} /><text x="111" y="14" textAnchor="end">{Math.round(storageFill * 100)}%</text></g>
      <g className="market-signal" transform="translate(1178 447)"><rect width="154" height="33" rx="7" fill="#07151dcc" stroke={marketPressure > .7 ? '#ed705f' : '#77c46b'} /><text x="10" y="14">KOLAR APMC</text><text x="144" y="14" textAnchor="end">{Math.round(marketPressure * 130)}% LOAD</text><rect x="10" y="22" width={130 * marketPressure} height="5" rx="3" fill={marketPressure > .7 ? '#e36554' : '#68bb61'} /></g>
      <g opacity={marketPressure}>{MARKET_ACTIVITY.slice(0, marketCount).map((p, i) => <circle key={i} className="market-dot" cx={p.x} cy={p.y} r={2 + i % 3} style={{ animationDelay: `${p.delay}s` }} />)}</g>
      {RAIN.map((drop, i) => <line key={i} className="rain-drop" x1={drop.x} y1={drop.y} x2={drop.x - 4} y2={drop.y + drop.length} style={{ opacity: rain, animationDelay: `${drop.delay}s` }} />)}
    </svg>
    <div className="map-caption map-caption--farm"><span>FARM REGION</span><b>{Math.round(harvest * 100)}% harvested</b></div>
    <div className="map-weather" style={{ opacity: Math.max(.32, cloud) }}><span>{rain > .08 ? 'RAIN FRONT MOVING IN' : 'PARTLY CLOUDY'}</span><i style={{ width: `${cloud * 100}%` }} /></div>
  </div>;
}
