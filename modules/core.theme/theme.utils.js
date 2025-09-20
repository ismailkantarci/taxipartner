// Lightweight sunrise/sunset calculator (NOAA approximation)
// Returns local Date objects for given date (local), latitude and longitude.
// If calculation fails (e.g., polar day/night), falls back to 06:00/18:00.

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / 86400000);
}

function calcSunTime(date, lat, lon, isSunrise) {
  const zenith = 90.833; // official sunrise/sunset
  const N = dayOfYear(date);
  const lngHour = lon / 15;
  const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const M = (0.9856 * t) - 3.289;
  let L = M + 1.916 * Math.sin(toRad(M)) + 0.020 * Math.sin(toRad(2 * M)) + 282.634;
  L = (L + 360) % 360;
  let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
  RA = (RA + 360) % 360;
  const Lquadrant  = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(toRad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(toRad(zenith)) - (sinDec * Math.sin(toRad(lat)))) / (cosDec * Math.cos(toRad(lat)));
  if (cosH < -1 || cosH > 1) {
    // Sun never rises/sets on this date at this location
    return null;
  }
  let H = isSunrise ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
  H = H / 15;
  const T = H + RA - (0.06571 * t) - 6.622;
  let UT = (T - lngHour) % 24;
  if (UT < 0) UT += 24;
  // Build local date with UT and convert to local time
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
  d.setUTCHours(Math.floor(UT), Math.floor((UT % 1) * 60), Math.floor((((UT % 1) * 60) % 1) * 60), 0);
  return new Date(d.getTime());
}

export function getSunTimes(date = new Date(), lat = 48.2082, lon = 16.3738) {
  // Default Vienna if location unknown
  const sr = calcSunTime(date, lat, lon, true);
  const ss = calcSunTime(date, lat, lon, false);
  if (!sr || !ss) {
    const fallbackSunrise = new Date(date);
    fallbackSunrise.setHours(6, 0, 0, 0);
    const fallbackSunset = new Date(date);
    fallbackSunset.setHours(18, 0, 0, 0);
    return { sunrise: fallbackSunrise, sunset: fallbackSunset, fallback: true };
  }
  return { sunrise: sr, sunset: ss, fallback: false };
}

