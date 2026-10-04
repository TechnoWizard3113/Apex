const P = 'apex-v2-';
const d = {
  settings: { graphics: 'high', cameraDistance: 10, cameraHeight: 5, showSpeed: true, speedUnit: 'kph' },
  vehicle: {
    bodyColor: '#2f8cff',
    accentColor: '#ffffff',
    wheelStyle: 'sport',
    engineStyle: 'v8',
    exhaustStyle: 'dual'
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
  const legacyStyle = ['apex', 'wide', 'arrow'].includes(stored.bodyStyle) ? stored.bodyStyle : 'apex';
  const legacyProfile = stored.profiles?.[legacyStyle] || {};
  const validWheels = ['sport', 'classic', 'dark'];
  const validEngines = ['v6', 'v8', 'supercharged'];
  const validExhausts = ['single', 'dual', 'side'];
  return {
    bodyColor: stored.bodyColor || legacyProfile.bodyColor || d.vehicle.bodyColor,
    accentColor: stored.accentColor || legacyProfile.accentColor || d.vehicle.accentColor,
    wheelStyle: validWheels.includes(stored.wheelStyle)
      ? stored.wheelStyle
      : validWheels.includes(legacyProfile.wheelStyle) ? legacyProfile.wheelStyle : d.vehicle.wheelStyle,
    engineStyle: validEngines.includes(stored.engineStyle) ? stored.engineStyle : d.vehicle.engineStyle,
    exhaustStyle: validExhausts.includes(stored.exhaustStyle) ? stored.exhaustStyle : d.vehicle.exhaustStyle
  };
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