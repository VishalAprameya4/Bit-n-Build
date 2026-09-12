/**
 * WeatherPanel — Floating top-left weather info panel
 */
export default function WeatherPanel({ simState, scenario }) {
  const { rainIntensity, cloudCover, t } = simState;
  const obs = scenario?.observed?.weather || {};

  const temp     = obs.temp_celsius     ?? 29;
  const humidity = obs.humidity_pct     ?? 74;
  const desc     = obs.weather_description ?? 'Partly Cloudy';

  // Interpolate to "Rain" as t increases
  const displayDesc = rainIntensity > 0.5 ? 'Heavy Rain' : rainIntensity > 0.2 ? 'Showers' : cloudCover > 0.5 ? 'Overcast' : desc;
  const rainRisk = t < 0.12 ? 78 : t < 0.40 ? 88 : rainIntensity > 0.1 ? 95 : t < 0.68 ? 22 : 12;

  return (
    <div className="hud-panel weather-panel">
      <div className="hud-panel-header">
        <span className="hud-panel-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        </span>
        <span className="hud-panel-title">Weather · Kolar</span>
        <span className="hud-live-badge">LIVE</span>
      </div>
      <div className="hud-panel-body">
        <div className="weather-main">
          <span className="weather-icon-big">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
          </span>
          <div>
            <div className="weather-temp">{Math.round(temp - t * 3)}°C</div>
            <div className="weather-desc">{displayDesc}</div>
          </div>
        </div>
        <div className="weather-grid">
          <div className="wg-item">
            <span className="wg-label">Humidity</span>
            <span className="wg-value">{Math.round(humidity + t * 12)}%</span>
          </div>
          <div className="wg-item">
            <span className="wg-label">Precipitation</span>
            <span className="wg-value">{rainIntensity > 0.1 ? `${(rainIntensity * 18).toFixed(1)} mm` : '0 mm'}</span>
          </div>
          <div className="wg-item">
            <span className="wg-label">Rain Risk</span>
            <span className="wg-value" style={{ color: rainIntensity > 0.4 ? '#ff6b6b' : '#ffc107' }}>
              {rainRisk}%
            </span>
          </div>
        </div>
        {t < 0.12 && (
          <div className="weather-alert">Rain expected in 2 days — harvest window is open</div>
        )}
        {rainIntensity > 0.1 && (
          <div className="weather-alert">
            Rain active — field operations impacted
          </div>
        )}
      </div>
    </div>
  );
}
