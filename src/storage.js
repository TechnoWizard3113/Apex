const P = 'apex-v2-';
const d = {
  settings: { graphics: 'high', cameraDistance: 10, cameraHeight: 5, showSpeed: true, speedUnit: 'kph' },
  vehicle: {
    bodyStyle: 'apex',
    profiles: {
      apex: { bodyColor: '#2f8cff', accentColor: '#ffffff', wheelStyle: 'sport' },
      wide: { bodyColor: '#ff8d2f', accentColor: '#ffffff', wheelStyle: 'classic' },
      arrow: { bodyColor: '#ad63ff', accentColor: '#ffffff', wheelStyle: 'dark' }
    }
  }
};

const r = (k, f) => {
  try {
    const x = localStorage.getItem(P + k);
    return x == null ? f : JSON.parse(x);
  } catch {
    return f;
  }
};

const w = (k, v) => localStorage.setItem(P + k, JSON.stringify(v));

export const settings = () => {
  const value = { ...d.settings, ...r('settings', {}) };
  delete value.showCheckpoints;
  value.speedUnit = value.speedUnit === 'mph' ? 'mph' : 'kph';
  return value;
};
export const saveSettings = x => w('settings', x);
export const vehicle = () => {
  const stored = r('vehicle', {});
  const profiles = Object.fromEntries(Object.entries(d.vehicle.profiles).map(([style, defaults]) => [
    style,
    { ...defaults, ...(stored.profiles?.[style] || {}) }
  ]));
  const legacyStyle = Object.hasOwn(profiles, stored.bodyStyle) ? stored.bodyStyle : 'apex';
  if (stored.bodyColor || stored.accentColor || stored.wheelStyle) {
    profiles[legacyStyle] = {
      ...profiles[legacyStyle],
      bodyColor: stored.bodyColor || profiles[legacyStyle].bodyColor,
      accentColor: stored.accentColor || profiles[legacyStyle].accentColor,
      wheelStyle: stored.wheelStyle || profiles[legacyStyle].wheelStyle
    };
  }
  const bodyStyle = Object.hasOwn(profiles, stored.bodyStyle) ? stored.bodyStyle : d.vehicle.bodyStyle;
  return { bodyStyle, profiles };
};
export const saveVehicle = x => w('vehicle', x);
export const scores = id => r('scores-' + id, []);

export const score = (id, t) => {
  let a = [...scores(id), { time: t }].sort((a, b) => a.time - b.time).slice(0, 100);
  w('scores-' + id, a);
  return a;
};

export const custom = () => r('custom', []);
export const saveCustom = x => w('custom', x);
export const customMountain = () => {
  const mountain = r('custom-mountain', 'everfrost');
  return ['everfrost', 'glacier', 'whitefang', 'stormpeak'].includes(mountain) ? mountain : 'everfrost';
};
export const saveCustomMountain = mountain => w('custom-mountain', mountain);
export const savedTracks = () => {
  const tracks = r('tracks', null);
  if (tracks !== null) return tracks;
  const legacyTrack = custom();
  return legacyTrack.length ? [{ id: 'custom', name: 'Custom Track', pieces: legacyTrack }] : [];
};
export const saveTrack = track => {
  const tracks = savedTracks();
  const index = tracks.findIndex(item => item.id === track.id);
  if (index < 0) tracks.push(track);
  else tracks[index] = track;
  w('tracks', tracks);
};

export const reset = () => {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    let k = localStorage.key(i);
    if (k?.startsWith(P)) localStorage.removeItem(k);
  }
};