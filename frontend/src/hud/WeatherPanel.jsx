/**
 * WeatherPanel — Floating top-left weather info panel
 */
export default function WeatherPanel({ simState, scenario }) {
  const { rainIntensity, cloudCover, t } = simState;
  const obs = scenario?.observed?.weather || {};

  const temp     = obs.temp_celsius     ?? 29;
  const humidity = obs.humidity_pct     ?? 74;
  const precip   = obs.precipitation_mm ?? 0;
  const desc     = obs.weather_description ?? 'Partly Cloudy';

  // Interpolate to "Rain" as t increases
  const displayDesc = rainIntensity > 0.5 ? 'Heavy Rain' : rainIntensity > 0.2 ? 'Showers' : cloudCover > 0.5 ? 'Overcast' : desc;
  const displayIcon = rainIntensity > 0.5 ? '🌧️' : rainIntensity > 0.15 ? '🌦️' : cloudCover > 0.55 ? '☁️' : '⛅';
  const forecast24hRain = scenario?.observed?.weather?.forecast_24h?.precipitation_sum_mm;

  return (
    <div className="hud-panel weather-panel">
      <div className="hud-panel-header">
        <span className="hud-panel-icon">🌤</span>
        <span className="hud-panel-title">Weather · Kolar</span>
        <span className="hud-live-badge">LIVE</span>
      </div>
      <div className="hud-panel-body">
        <div className="weather-main">
          <span className="weather-icon-big">{displayIcon}</span>
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
              {Math.round(Math.min(95, 10 + t * 85))}%
            </span>
          </div>
        </div>
        {rainIntensity > 0.1 && (
          <div className="weather-alert">
            ⚠ Rain active — field operations impacted
          </div>
        )}
      </div>
    </div>
  );
}
