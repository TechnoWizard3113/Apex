import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Track } from './track.js';
import { Vehicle } from './vehicle.js';
import { Cam } from './camera.js';
import {
  settings, saveSettings, vehicle, saveVehicle, scores, score,
  custom, saveCustom, customMountain, saveCustomMountain, savedTracks, saveTrack, reset
} from './storage.js';

const $ = x => document.getElementById(x);
const tracks = [
  {
    id: 'mountain',
    name: 'Mountain Run',
    desc: 'Technical starter circuit',
    mountain: 'everfrost',
    p: ['start', 'straight', 'straight', 'curveRight', 'straight', 'checkpoint', 'ramp', 'straight', 'curveLeft', 'rampDown', 'checkpoint', 'curveLeft', 'straight', 'bankRight', 'straight', 'curveRight', 'finish']
  },
  {
    id: 'speed',
    name: 'Speed Circuit',
    desc: 'High speed test track',
    mountain: 'glacier',
    p: ['start', 'straight', 'straight', 'curveLeft', 'checkpoint', 'ramp', 'ramp', 'straight', 'curveRight', 'rampDown', 'straight', 'checkpoint', 'curveRight', 'straight', 'bankLeft', 'straight', 'curveLeft', 'finish']
  }
];

let S = settings(),
  scene,
  camera,
  renderer,
  track,
  car,
  showroom,
  follow,
  active,
  running = false,
  finished = false,
  start = 0,
  ci = 0,
  last = performance.now(),
  entries = custom(),
  selectedMountain = customMountain(),
  ghostTrack = null,
  selectedIndex = null,
  selectedPiece = null,
  editingTrackId = null,
  countdownTimer = null,
  resultTime = null,
  editorMode = 'builder',
  orbit = {
    theta: 0,
    phi: 0.95,
    radius: 75,
    target: new THREE.Vector3(),
    dragging: false,
    lastX: 0,
    lastY: 0
  };

let c = { throttle: false, brake: false, left: false, right: false };
let A = vehicle();
let appearance = currentAppearance();

function currentAppearance() {
  return { ...A };
}

const fmt = t => {
  if (!isFinite(t)) return '--:--.---';
  let n = t | 0;
  return `${String((n / 60000) | 0).padStart(2, '0')}:${String(((n % 60000) / 1000) | 0).padStart(2, '0')}.${String(n % 1000).padStart(3, '0')}`;
};

function show(id) {
  ['menu', 'tracksScreen', 'leaderScreen', 'builderScreen', 'vehicleScreen', 'settingsScreen'].forEach(x => $(x).classList.add('hidden'));
  $(id).classList.remove('hidden');
  if (renderer) requestAnimationFrame(() => {
    resizeRenderer(renderer.domElement.parentElement);
    updateEditorCamera();
  });
}

function resizeRenderer(container) {
  if (!renderer || !container) return;
  const width = container.clientWidth || innerWidth;
  const height = container.clientHeight || innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateEditorCamera() {
  if (!camera || (editorMode !== 'builder' && editorMode !== 'vehicle')) return;
  const sinPhi = Math.sin(orbit.phi);
  camera.position.set(
    orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
    orbit.target.y + orbit.radius * Math.cos(orbit.phi),
    orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
  );
  camera.lookAt(orbit.target);
}

function focusBuilder() {
  const points = [track.spawn, ...track.p.map(piece => piece.end)];
  const bounds = new THREE.Box3().setFromPoints(points);
  bounds.getCenter(orbit.target);
  orbit.target.y = Math.max(0, orbit.target.y);
  orbit.radius = THREE.MathUtils.clamp(bounds.getSize(new THREE.Vector3()).length() * 0.75 + 24, 38, 180);
  orbit.theta = 0;
  orbit.phi = 0.88;
  updateEditorCamera();
}

function setEditorMode(mode) {
  editorMode = mode;
  track.group.visible = mode !== 'vehicle';
  if (ghostTrack) ghostTrack.group.visible = mode === 'builder' && selectedPiece !== null;
  car.group.visible = mode !== 'builder';
  showroom.visible = mode === 'vehicle';
  if (mode === 'builder') focusBuilder();
  else if (mode === 'vehicle') {
    orbit.target.set(0, 1.1, 0);
    orbit.radius = 11;
    orbit.theta = 0.75;
    orbit.phi = 1.15;
    updateEditorCamera();
  }
}

function bindEditorControls(canvas) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener('pointerdown', event => {
    if (editorMode !== 'builder' && editorMode !== 'vehicle') return;
    orbit.dragging = true;
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
    orbit.pointerDownX = event.clientX;
    orbit.pointerDownY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!orbit.dragging) return;
    const dx = event.clientX - orbit.lastX;
    const dy = event.clientY - orbit.lastY;
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
    if (event.shiftKey || event.buttons === 2) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      const scale = orbit.radius * 0.0015;
      orbit.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    } else {
      orbit.theta -= dx * 0.008;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi + dy * 0.008, 0.12, Math.PI / 2);
    }
    updateEditorCamera();
  });
  canvas.addEventListener('pointerup', event => {
    orbit.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (editorMode === 'builder' && Math.hypot(event.clientX - orbit.pointerDownX, event.clientY - orbit.pointerDownY) < 5) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(track.group.children, true)
        .find(item => Number.isInteger(item.object.userData.trackPieceIndex));
      if (hit) selectTrackPiece(hit.object.userData.trackPieceIndex);
      else if (selectedIndex !== null) {
        selectedIndex = null;
        renderPreview();
      }
    }
  });
  canvas.addEventListener('wheel', event => {
    if (editorMode !== 'builder' && editorMode !== 'vehicle') return;
    event.preventDefault();
    orbit.radius = THREE.MathUtils.clamp(orbit.radius * Math.exp(event.deltaY * 0.001), 5, 220);
    updateEditorCamera();
  }, { passive: false });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
}

function init(id) {
  const container = $(id);
  if (renderer) {
    if (renderer.domElement.parentElement !== container) container.appendChild(renderer.domElement);
    resizeRenderer(container);
    return;
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea0ae);
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 3000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.shadowMap.enabled = S.graphics !== 'low';
  container.appendChild(renderer.domElement);
  bindEditorControls(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x263020, 1.8));
  let l = new THREE.DirectionalLight(0xffffff, 2.2);
  l.position.set(100, 140, 80);
  l.castShadow = true;
  scene.add(l);

  track = new Track(scene);
  ghostTrack = new Track(scene);
  ghostTrack.barrierMaterial.transparent = true;
  ghostTrack.barrierMaterial.opacity = 0.4;
  ghostTrack.barrierMaterial.depthWrite = false;
  ghostTrack.barrierMaterial.needsUpdate = true;
  ghostTrack.group.visible = false;
  showroom = new THREE.Group();
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 0.35, 64),
    new THREE.MeshStandardMaterial({ color: 0x28333d, roughness: 0.75, metalness: 0.2 })
  );
  platform.position.y = -0.2;
  platform.receiveShadow = true;
  showroom.add(platform);
  scene.add(showroom);
  car = new Vehicle(scene, appearance);
  follow = new Cam(camera, S);
  camera.position.set(0, 32, 58);
  camera.lookAt(0, 0, 20);
  requestAnimationFrame(loop);
}

function race(t) {
  init('gameView');
  clearPreview();
  editorMode = 'race';
  track.group.visible = true;
  car.group.visible = true;
  showroom.visible = false;
  track.build(t.p, t.mountain || 'everfrost');
  car.setAppearance(appearance);
  c = { throttle: false, brake: false, left: false, right: false };
  let sp = track.getSpawn();
  car.reset(sp.position, sp.yaw);
  follow.reset(car, track);
  active = t;
  ci = 0;
  finished = false;
  running = false;
  resultTime = null;
  $('time').textContent = fmt(0);
  $('finish').classList.add('hidden');
  ['menu', 'tracksScreen', 'leaderScreen', 'builderScreen', 'vehicleScreen', 'settingsScreen'].forEach(x => $(x).classList.add('hidden'));
  $('game').classList.remove('hidden');
  $('gameTrack').textContent = t.name;
  $('best').textContent = scores(t.id)[0] ? fmt(scores(t.id)[0].time) : '--:--.---';
  $('checkpoint').textContent = `CHECKPOINT 0/${track.checkpoints.length}`;

  if (countdownTimer) clearInterval(countdownTimer);
  let n = 3;
  $('countdown').textContent = n;
  countdownTimer = setInterval(() => {
    n--;
    if (n) {
      $('countdown').textContent = n;
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      $('countdown').textContent = 'GO';
      running = true;
      start = performance.now();
      setTimeout(() => ($('countdown').textContent = ''), 400);
    }
  }, 650);
}

function finish() {
  if (finished) return;
  finished = true;
  running = false;
  resultTime = performance.now() - start;
  $('time').textContent = fmt(resultTime);
  $('finish').textContent = `FINISH  ${fmt(resultTime)}`;
  $('finish').classList.remove('hidden');
  recordResult();
}

function recordResult() {
  const results = score(active.id, resultTime);
  $('best').textContent = fmt(results[0].time);
}

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running && !finished) {
    car.update(dt, c, track);
    $('time').textContent = fmt(performance.now() - start);

    if (ci < track.checkpoints.length) {
      let cp = track.checkpoints[ci];
      let d2d = Math.hypot(car.pos.x - cp.x, car.pos.z - cp.z);
      if (d2d < 7 && Math.abs(car.pos.y - cp.y) < 3.5) {
        ci++;
        $('checkpoint').textContent = `CHECKPOINT ${ci}/${track.checkpoints.length}`;
      }
    }

    if (ci >= track.checkpoints.length) {
      let fin = track.finish;
      let d2d = Math.hypot(car.pos.x - fin.x, car.pos.z - fin.z);
      if (d2d < 6 && Math.abs(car.pos.y - fin.y) < 10) finish();
    }

    follow.update(car, dt, track);
  }

  $('speed').classList.toggle('hidden', !S.showSpeed);
  if (car && S.showSpeed) {
    const speed = Math.abs(car.speed) * (S.speedUnit === 'mph' ? 2.236936 : 3.6);
    $('speed').textContent = `${car.speed < -0.1 ? 'R ' : ''}${Math.round(speed)} ${S.speedUnit.toUpperCase()}`;
  }
  if (renderer) renderer.render(scene, camera);
}

function renderTracks() {
  let box = $('trackList');
  box.innerHTML = '';
  const library = [
    ...tracks.map(t => ({ ...t, pieces: t.p, saved: false })),
    ...savedTracks().map(t => ({ ...t, p: t.pieces, desc: 'Saved custom track', saved: true }))
  ];
  library.forEach(t => {
    let card = document.createElement('article');
    card.className = 'card track-card';
    let best = scores(t.id)[0];
    const details = document.createElement('div');
    const type = document.createElement('small');
    type.textContent = t.saved ? 'CUSTOM TRACK' : t.id.toUpperCase();
    const name = document.createElement('h2');
    name.textContent = t.name;
    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = t.desc;
    details.append(type, name, description);

    const footer = document.createElement('div');
    footer.className = 'track-card-footer';
    const bestTime = document.createElement('span');
    bestTime.textContent = `BEST ${best ? fmt(best.time) : '--:--.---'}`;
    const actions = document.createElement('div');
    actions.className = 'track-actions';
    const action = (label, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = handler;
      actions.appendChild(button);
    };
    action('DRIVE', () => race(t));
    action('TIMES', () => {
      active = t;
      renderLeader(t);
      show('leaderScreen');
    });
    if (t.saved) action('EDIT', () => openBuilder(t));
    footer.append(bestTime, actions);
    card.append(details, footer);
    box.appendChild(card);
  });
}

function renderLeader(t) {
  $('leaderName').textContent = t.name.toUpperCase();
  let b = $('leaderRows');
  b.innerHTML = '';
  const a = scores(t.id);
  if (!a.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'NO TIMES YET';
    b.appendChild(empty);
    return;
  }
  a.forEach((x, i) => {
    let d = document.createElement('div');
    d.className = 'leader';
    const rank = document.createElement('span');
    rank.textContent = String(i + 1);
    const time = document.createElement('span');
    time.textContent = fmt(x.time);
    d.append(rank, time);
    b.appendChild(d);
  });
}

function clearPreview() {
  if (!ghostTrack) return;
  ghostTrack.clear();
  ghostTrack.group.visible = false;
}

function rebuild() {
  track.build(entries, selectedMountain);
  clearPreview();
  if (selectedIndex !== null && selectedIndex >= entries.length) selectedIndex = null;
  saveCustom(entries);
  saveCustomMountain(selectedMountain);
  $('buildStatus').textContent = `${entries.length} pieces${selectedIndex !== null ? ` - piece ${selectedIndex + 1} selected` : ''}`;
  if (selectedPiece) renderPreview();
}

function renderPreview() {
  clearPreview();
  const basePiece = selectedIndex === null ? track.p.at(-1) : track.p[selectedIndex - 1];
  const startPoint = selectedIndex === null
    ? (basePiece ? basePiece.end.clone() : track.spawn.clone())
    : (track.p[selectedIndex]?.start.clone() || track.spawn.clone());
  const yaw = selectedIndex === null
    ? (basePiece ? basePiece.endYaw : 0)
    : (track.p[selectedIndex]?.yaw || 0);
  ghostTrack.spawn.copy(startPoint);
  ghostTrack.mountainId = track.mountainId;
  ghostTrack.add(selectedPiece, yaw);
  ghostTrack.group.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      material.transparent = true;
      material.opacity = 0.4;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  });
  ghostTrack.group.visible = true;
  const previewBounds = new THREE.Box3().setFromPoints([
    startPoint,
    ghostTrack.p.at(-1).end
  ]);
  previewBounds.getCenter(orbit.target);
  orbit.target.y = Math.max(orbit.target.y, 0);
  orbit.radius = THREE.MathUtils.clamp(
    previewBounds.getSize(new THREE.Vector3()).length() * 0.9 + 16,
    38,
    120
  );
  updateEditorCamera();
  $('buildStatus').textContent = selectedIndex === null
    ? `Ghost preview: ${selectedPiece}. Click PLACE PIECE to add it.`
    : `Editing piece ${selectedIndex + 1}: previewing ${selectedPiece}. Update or delete the selected piece.`;
}

function pv(type) {
  selectedPiece = type;
  document.querySelectorAll('[data-piece]').forEach(button => {
    button.classList.toggle('selected', button.dataset.piece === selectedPiece);
  });
  renderPreview();
}

function selectTrackPiece(index) {
  if (!entries[index]) return;
  selectedIndex = index;
  selectedPiece = entries[index].type;
  document.querySelectorAll('[data-piece]').forEach(button => {
    button.classList.toggle('selected', button.dataset.piece === selectedPiece);
  });
  renderPreview();
}

function makePieceKey() {
  return `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function exportTrackCode() {
  const payload = JSON.stringify({
    mountain: selectedMountain,
    pieces: entries.map(piece => piece.type)
  });
  $('trackCode').value = `APX2-${btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  $('buildStatus').textContent = 'Encoded track code exported with its mountain and exact piece sequence.';
}

function importTrackCode() {
  const code = $('trackCode').value.trim();
  const allowed = new Set([
    'start', 'straight', 'curveLeft', 'curveRight', 'curveLeft45', 'curveRight45',
    'ramp', 'rampDown', 'bankLeft', 'bankRight', 'checkpoint', 'finish'
  ]);
  let mountain = 'everfrost';
  let types = [];
  if (code.startsWith('APX2-')) {
    const encoded = code.slice(5);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
      $('buildStatus').textContent = 'Invalid encoded track code.';
      return;
    }
    try {
      const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)));
      mountain = payload?.mountain;
      types = payload?.pieces;
    } catch {
      $('buildStatus').textContent = 'Invalid encoded track code.';
      return;
    }
  } else {
    const match = /^APEX(1|2)\|(.+)$/.exec(code);
    if (match?.[1] === '2') {
      const divider = match[2].indexOf('|');
      mountain = divider < 0 ? '' : match[2].slice(0, divider);
      types = divider < 0 ? [] : match[2].slice(divider + 1).split(',');
    } else if (match?.[1] === '1') {
      types = match[2].split(',');
    }
  }
  const mountains = new Set(['everfrost', 'glacier', 'whitefang', 'stormpeak']);
  if (!mountains.has(mountain) || !Array.isArray(types) || !types.length ||
      types.some(type => !allowed.has(type)) ||
      types[0] !== 'start' || types.filter(type => type === 'start').length !== 1 ||
      types.filter(type => type === 'finish').length > 1 ||
      (types.includes('finish') && types.at(-1) !== 'finish')) {
    $('buildStatus').textContent = 'Invalid track code. Export an APX2 code or use an older APEX code with START first and at most one FINISH last.';
    return;
  }
  selectedMountain = mountain;
  $('mountain').value = selectedMountain;
  entries = types.map(type => ({ key: makePieceKey(), type, rotation: 0 }));
  selectedIndex = null;
  selectedPiece = null;
  document.querySelectorAll('[data-piece]').forEach(button => button.classList.remove('selected'));
  rebuild();
  focusBuilder();
  $('buildStatus').textContent = 'Track code loaded.';
}

function placePiece() {
  if (!selectedPiece) return;
  if (selectedIndex !== null) {
    $('buildStatus').textContent = `Piece ${selectedIndex + 1} is selected. Update it or click empty space to place a new piece.`;
    return;
  }
  if (entries.length === 0 && selectedPiece !== 'start') {
    $('buildStatus').textContent = 'Place the START piece first.';
    return;
  }
  if (selectedPiece === 'start' && entries.length > 0) {
    $('buildStatus').textContent = 'The START piece must be first.';
    return;
  }
  if (entries.at(-1)?.type === 'finish') {
    $('buildStatus').textContent = 'The FINISH piece ends the track. Undo it before adding more pieces.';
    return;
  }
  if (selectedPiece === 'finish' && entries.some(piece => piece.type === 'finish')) {
    $('buildStatus').textContent = 'A track can only have one FINISH piece.';
    return;
  }
  entries.push({ key: makePieceKey(), type: selectedPiece, rotation: 0 });
  rebuild();
}

function updateSelectedPiece() {
  if (selectedIndex === null || !selectedPiece) return;
  if (selectedIndex === 0 && selectedPiece !== 'start') {
    $('buildStatus').textContent = 'The first piece must remain START.';
    return;
  }
  if (selectedIndex > 0 && selectedPiece === 'start') {
    $('buildStatus').textContent = 'START can only be the first piece.';
    return;
  }
  if (selectedPiece === 'finish' && selectedIndex !== entries.length - 1) {
    $('buildStatus').textContent = 'FINISH must be the last piece.';
    return;
  }
  if (selectedPiece === 'finish' &&
      entries.some((piece, index) => index !== selectedIndex && piece.type === 'finish')) {
    $('buildStatus').textContent = 'A track can only have one FINISH piece.';
    return;
  }
  entries[selectedIndex] = { ...entries[selectedIndex], type: selectedPiece, rotation: 0 };
  rebuild();
}

function deleteSelectedPiece() {
  if (selectedIndex === null) return;
  if (selectedIndex === 0) {
    $('buildStatus').textContent = 'The START piece cannot be deleted.';
    return;
  }
  entries.splice(selectedIndex, 1);
  selectedIndex = null;
  selectedPiece = null;
  rebuild();
}

function openBuilder(saved = null) {
  init('builderView');
  editingTrackId = saved?.id || null;
  selectedMountain = saved?.mountain || customMountain();
  $('mountain').value = selectedMountain;
  entries = (saved ? saved.pieces : custom()).map(piece => {
    if (typeof piece === 'string') return { key: makePieceKey(), type: piece === 'boost' ? 'straight' : piece, rotation: 0 };
    return { ...piece, type: piece.type === 'boost' ? 'straight' : piece.type, rotation: 0, key: piece.key || makePieceKey() };
  });
  if (entries[0]?.type !== 'start') {
    entries.unshift({ key: makePieceKey(), type: 'start', rotation: 0 });
  }
  $('trackName').value = saved?.name || '';
  selectedPiece = null;
  selectedIndex = null;
  car.group.visible = false;
  track.group.visible = true;
  showroom.visible = false;
  editorMode = 'builder';
  rebuild();
  document.querySelectorAll('[data-piece]').forEach(button => button.classList.remove('selected'));
  focusBuilder();
  show('builderScreen');
}

function vehicleUI() {
  init('vehicleView');
  car.reset(new THREE.Vector3(0, 0, 0), 0);
  track.group.visible = false;
  car.group.visible = true;
  editorMode = 'vehicle';
  loadVehicleProfile();
  setEditorMode('vehicle');
}

function loadVehicleProfile() {
  appearance = currentAppearance();
  $('bodyColor').value = appearance.bodyColor;
  $('accentColor').value = appearance.accentColor;
  $('wheelStyle').value = appearance.wheelStyle;
  $('engineStyle').value = appearance.engineStyle;
  $('exhaustStyle').value = appearance.exhaustStyle;
  if (car) car.setAppearance(appearance);
}

function updateVehicleProfile() {
  A.bodyColor = $('bodyColor').value;
  A.accentColor = $('accentColor').value;
  A.wheelStyle = $('wheelStyle').value;
  A.engineStyle = $('engineStyle').value;
  A.exhaustStyle = $('exhaustStyle').value;
  appearance = currentAppearance();
  if (car) car.setAppearance(appearance);
}

$('play').onclick = () => {
  renderTracks();
  show('tracksScreen');
};
$('build').onclick = () => {
  openBuilder();
};
$('vehicle').onclick = () => {
  show('vehicleScreen');
  vehicleUI();
};
$('settings').onclick = () => {
  show('settingsScreen');
  $('graphics').value = S.graphics;
  $('camDistance').value = S.cameraDistance;
  $('camHeight').value = S.cameraHeight;
  $('showSpeed').checked = S.showSpeed;
  $('speedUnit').value = S.speedUnit;
};

document.querySelectorAll('[data-back]').forEach(b => (b.onclick = () => show(b.dataset.back)));
document.querySelectorAll('[data-piece]').forEach(b => (b.onclick = () => {
  pv(b.dataset.piece);
  b.blur();
}));

$('placePiece').onclick = placePiece;
$('updatePiece').onclick = updateSelectedPiece;
$('deletePiece').onclick = deleteSelectedPiece;
$('mountain').onchange = event => {
  selectedMountain = event.target.value;
  saveCustomMountain(selectedMountain);
  rebuild();
  focusBuilder();
};
$('exportTrack').onclick = exportTrackCode;
$('importTrack').onclick = importTrackCode;
$('undo').onclick = () => {
  entries.pop();
  selectedIndex = null;
  rebuild();
};
$('clear').onclick = () => {
  entries = [];
  selectedIndex = null;
  selectedPiece = null;
  document.querySelectorAll('[data-piece]').forEach(button => button.classList.remove('selected'));
  rebuild();
};
$('test').onclick = () => {
  if (entries.length < 3 || entries[0]?.type !== 'start' || entries.at(-1)?.type !== 'finish') {
    $('buildStatus').textContent = 'Tracks need a START piece first and a FINISH piece last.';
    return;
  }
  clearPreview();
  race({
    id: editingTrackId || 'custom-preview',
    name: $('trackName').value.trim() || 'Custom Track',
    p: entries,
    mountain: selectedMountain
  });
};
$('saveTrack').onclick = () => {
  if (entries.length < 3 || entries[0]?.type !== 'start' || entries.at(-1)?.type !== 'finish') {
    $('buildStatus').textContent = 'Tracks need a START piece first and a FINISH piece last.';
    return;
  }
  const name = $('trackName').value.trim() || 'My Track';
  editingTrackId ||= `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  saveTrack({ id: editingTrackId, name, pieces: entries, mountain: selectedMountain });
  $('buildStatus').textContent = `"${name}" saved. Track edits are also saved as you build.`;
};
$('saveVehicle').onclick = () => {
  updateVehicleProfile();
  saveVehicle(A);
  $('vehicleStatus').textContent = 'Vehicle appearance saved.';
};

['bodyColor', 'accentColor', 'wheelStyle', 'engineStyle', 'exhaustStyle'].forEach(id => {
  $(id).oninput = updateVehicleProfile;
  $(id).onchange = updateVehicleProfile;
});

$('graphics').onchange = e => {   S.graphics = e.target.value;   saveSettings(S);   if (renderer) renderer.shadowMap.enabled = S.graphics !== 'low'; };$('camDistance').oninput = e => {
  S.cameraDistance = +e.target.value;
  saveSettings(S);
  if (follow) follow.s = S;
};
$('camHeight').oninput = e => {   S.cameraHeight = +e.target.value;   saveSettings(S);   if (follow) follow.s = S; };$('showSpeed').onchange = e => {
  S.showSpeed = e.target.checked;
  saveSettings(S);
};
$('speedUnit').onchange = e => {
  S.speedUnit = e.target.value;
  saveSettings(S);
};
$('reset').onclick = () => {
  if (confirm('Reset all Apex local data?')) {
    reset();
    location.reload();
  }
};
$('hudMenu').onclick = () => {
  $('game').classList.add('hidden');
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  $('countdown').textContent = '';
  running = false;
  finished = false;
  c = { throttle: false, brake: false, left: false, right: false };
  renderTracks();
  show('tracksScreen');
};

addEventListener('keydown', e => {
  let k = e.key.toLowerCase();
  const target = e.target instanceof Element ? e.target : null;
  const isFormControl = target?.closest('input, select, textarea');
  if (!$('builderScreen').classList.contains('hidden') && !isFormControl) {
    if (e.key === 'Enter' && (!target?.closest('button') || target.closest('[data-piece]'))) {
      e.preventDefault();
      placePiece();
    }
    if (k === 'z' || (e.metaKey && k === 'z') || (e.ctrlKey && k === 'z')) {
      entries.pop();
      rebuild();
    }
  }
  if (!$('game').classList.contains('hidden')) {
    if (!isFormControl && !e.repeat && k === 'r' && active) {
      race(active);
      return;
    }
    if (!isFormControl && !e.repeat && k === 't' && active && running) {
      const point = ci > 0 ? track.checkpoints[ci - 1] : track.getSpawn();
      const position = ci > 0 ? new THREE.Vector3(point.x, point.y, point.z) : point.position;
      car.reset(position, point.yaw);
      c = { throttle: false, brake: false, left: false, right: false };
      follow.reset(car, track);
      return;
    }
    if (e.key === 'ArrowUp' || k === 'w') c.throttle = true;
    if (e.key === 'ArrowDown' || k === 's') c.brake = true;
    if (e.key === 'ArrowLeft' || k === 'a') c.left = true;
    if (e.key === 'ArrowRight' || k === 'd') c.right = true;
  }
});

addEventListener('keyup', e => {
  let k = e.key.toLowerCase();
  if (e.key === 'ArrowUp' || k === 'w') c.throttle = false;
  if (e.key === 'ArrowDown' || k === 's') c.brake = false;
  if (e.key === 'ArrowLeft' || k === 'a') c.left = false;
  if (e.key === 'ArrowRight' || k === 'd') c.right = false;
});

addEventListener('resize', () => {
  if (camera && renderer) {
    const container = renderer.domElement.parentElement;
    const width = container?.clientWidth || innerWidth;
    const height = container?.clientHeight || innerHeight;
    resizeRenderer(container);
    updateEditorCamera();
  }
});

addEventListener('blur', () => {
  c = { throttle: false, brake: false, left: false, right: false };
});