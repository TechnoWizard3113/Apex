import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Track } from './track.js';
import { Vehicle } from './vehicle.js';
import { Cam } from './camera.js';
import {
  settings, saveSettings, vehicle, saveVehicle, scores, score, isTopHundred,
  playerName, savePlayerName, custom, saveCustom, savedTracks, saveTrack, reset
} from './storage.js';

const $ = x => document.getElementById(x);
const tracks = [
  {
    id: 'mountain',
    name: 'Mountain Run',
    desc: 'Technical starter circuit',
    p: ['start', 'straight', 'straight', 'curveRight', 'straight', 'checkpoint', 'ramp', 'straight', 'curveLeft', 'boost', 'checkpoint', 'curveLeft', 'straight', 'bankRight', 'straight', 'curveRight', 'finish']
  },
  {
    id: 'speed',
    name: 'Speed Circuit',
    desc: 'High speed test track',
    p: ['start', 'straight', 'boost', 'straight', 'curveLeft', 'checkpoint', 'straight', 'boost', 'curveLeft', 'straight', 'checkpoint', 'ramp', 'straight', 'curveRight', 'boost', 'straight', 'curveRight', 'finish']
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
  preview = null,
  rot = 0,
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

function currentAppearance(style = A.bodyStyle) {
  return { ...A.profiles[style], bodyStyle: style };
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
  canvas.addEventListener('pointerdown', event => {
    if (editorMode !== 'builder' && editorMode !== 'vehicle') return;
    orbit.dragging = true;
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
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
  track.build(t.p);
  car.setAppearance(appearance);
  c = { throttle: false, brake: false, left: false, right: false };
  let sp = track.getSpawn();
  car.reset(sp.position, sp.yaw);
  follow.update(car, 1);
  active = t;
  ci = 0;
  finished = false;
  running = false;
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
  if (isTopHundred(active.id, resultTime)) {
    $('usernameInput').value = playerName() || 'Racer';
    $('usernameError').textContent = '';
    $('usernameDialog').showModal();
  } else {
    recordResult(playerName() || 'Racer');
  }
}

function recordResult(name) {
  const results = score(active.id, resultTime, name);
  $('best').textContent = fmt(results[0].time);
}

$('usernameForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('usernameInput').value.trim().replace(/\s+/g, ' ');
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const inappropriate = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'piss']
    .some(word => normalizedName.includes(word));
  if (!/^[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)*$/u.test(name) || name.length < 3 || name.length > 16 || inappropriate) {
    $('usernameError').textContent = 'Use a clean name with 3–16 letters, numbers, spaces, _ or -.';
    return;
  }
  savePlayerName(name);
  $('usernameDialog').close();
  recordResult(name);
});
$('usernameDialog').addEventListener('cancel', event => event.preventDefault());
$('usernameDialog').addEventListener('click', event => {
  if (event.target === $('usernameDialog')) event.preventDefault();
});

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running && !finished) {
    car.update(dt, c, track);
    $('time').textContent = fmt(performance.now() - start);

    if (S.showSpeed) $('speed').textContent = `${Math.round(car.speed * 3.6)} KM/H`;

    if (ci < track.checkpoints.length) {
      let cp = track.checkpoints[ci];
      let d2d = Math.hypot(car.pos.x - cp.x, car.pos.z - cp.z);
      if (d2d < 7 && Math.abs(car.pos.y - cp.y) < 10) {
        ci++;
        $('checkpoint').textContent = `CHECKPOINT ${ci}/${track.checkpoints.length}`;
      }
    }

    if (ci >= track.checkpoints.length) {
      let fin = track.finish;
      let d2d = Math.hypot(car.pos.x - fin.x, car.pos.z - fin.z);
      if (d2d < 6 && Math.abs(car.pos.y - fin.y) < 10) finish();
    }

    follow.update(car, dt);
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
  let a = scores(t.id);
  if (!a.length) a = [{ name: 'NO TIMES YET', time: Infinity }];
  a.forEach((x, i) => {
    let d = document.createElement('div');
    d.className = 'leader';
    const rank = document.createElement('span');
    rank.textContent = String(i + 1);
    const name = document.createElement('span');
    name.textContent = x.name || 'RACER';
    const time = document.createElement('span');
    time.textContent = fmt(x.time);
    d.append(rank, name, time);
    b.appendChild(d);
  });
}

function clearPreview() {
  if (!preview) return;
  scene.remove(preview);
  preview.geometry.dispose();
  preview.material.dispose();
  preview = null;
}

function rebuild() {
  track.build(entries);
  clearPreview();
  saveCustom(entries);
  $('buildStatus').textContent = `${entries.length} pieces${selectedPiece ? ` - ${selectedPiece} selected` : ''}`;
  if (selectedPiece) renderPreview();
}

function renderPreview() {
  clearPreview();
  const lastPiece = track.p.at(-1);
  const startPoint = lastPiece ? lastPiece.end.clone() : track.spawn.clone();
  const yaw = (lastPiece ? lastPiece.endYaw : 0) + rot;
  let geo = new THREE.BoxGeometry(12, 0.5, 28);
  let mat = new THREE.MeshStandardMaterial({ color: 0x32d583, transparent: true, opacity: 0.45 });
  preview = new THREE.Mesh(geo, mat);
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  preview.position.copy(startPoint).addScaledVector(forward, 14);
  preview.position.y += startPoint.y;
  preview.rotation.y = -yaw;
  scene.add(preview);
  $('buildStatus').textContent = `Preview ${selectedPiece}. ${entries.length} pieces placed. Q/E rotate, Enter place.`;
}

function pv(type) {
  selectedPiece = type;
  rot = 0;
  renderPreview();
}

function makePieceKey() {
  return `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function placePiece() {
  if (!selectedPiece) return;
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
  entries.push({ key: makePieceKey(), type: selectedPiece, rotation: rot });
  rot = 0;
  rebuild();
}

function openBuilder(saved = null) {
  init('builderView');
  editingTrackId = saved?.id || null;
  entries = (saved ? saved.pieces : custom()).map(piece => {
    if (typeof piece === 'string') return { key: makePieceKey(), type: piece, rotation: 0 };
    return { ...piece, key: piece.key || makePieceKey() };
  });
  if (entries[0]?.type !== 'start') {
    entries.unshift({ key: makePieceKey(), type: 'start', rotation: 0 });
  }
  $('trackName').value = saved?.name || '';
  selectedPiece = null;
  rot = 0;
  car.group.visible = false;
  track.group.visible = true;
  showroom.visible = false;
  editorMode = 'builder';
  rebuild();
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
  $('bodyStyle').value = A.bodyStyle;
  $('wheelStyle').value = appearance.wheelStyle;
  if (car) car.setAppearance(appearance);
}

function updateVehicleProfile() {
  A.bodyStyle = $('bodyStyle').value;
  A.profiles[A.bodyStyle] = {
    bodyColor: $('bodyColor').value,
    accentColor: $('accentColor').value,
    wheelStyle: $('wheelStyle').value
  };
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
};

document.querySelectorAll('[data-back]').forEach(b => (b.onclick = () => show(b.dataset.back)));
document.querySelectorAll('[data-piece]').forEach(b => (b.onclick = () => {
  pv(b.dataset.piece);
  b.blur();
}));

$('placePiece').onclick = placePiece;
$('undo').onclick = () => {
  entries.pop();
  rebuild();
};
$('clear').onclick = () => {
  entries = [];
  rebuild();
};
$('test').onclick = () => {
  if (entries.length < 3 || entries[0]?.type !== 'start' || entries.at(-1)?.type !== 'finish') {
    $('buildStatus').textContent = 'Tracks need a START piece first and a FINISH piece last.';
    return;
  }
  clearPreview();
  race({ id: editingTrackId || 'custom-preview', name: $('trackName').value.trim() || 'Custom Track', p: entries });
};
$('saveTrack').onclick = () => {
  if (entries.length < 3 || entries[0]?.type !== 'start' || entries.at(-1)?.type !== 'finish') {
    $('buildStatus').textContent = 'Tracks need a START piece first and a FINISH piece last.';
    return;
  }
  const name = $('trackName').value.trim() || 'My Track';
  editingTrackId ||= `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  saveTrack({ id: editingTrackId, name, pieces: entries });
  $('buildStatus').textContent = `"${name}" saved. Track edits are also saved as you build.`;
};
$('saveVehicle').onclick = () => {
  updateVehicleProfile();
  saveVehicle(A);
  $('vehicleStatus').textContent = 'Vehicle appearance saved.';
};

$('bodyStyle').onchange = () => {
  A.bodyStyle = $('bodyStyle').value;
  loadVehicleProfile();
};
['bodyColor', 'accentColor', 'wheelStyle'].forEach(id => {
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
  c = { throttle: false, brake: false, left: false, right: false };
  show('menu');
};

addEventListener('keydown', e => {
  let k = e.key.toLowerCase();
  const target = e.target instanceof Element ? e.target : null;
  const isFormControl = target?.closest('input, select, textarea');
  if (!$('builderScreen').classList.contains('hidden') && !isFormControl) {
    if (k === 'q' || k === 'e') {
      rot += k === 'q' ? -Math.PI / 12 : Math.PI / 12;
      if (selectedPiece) renderPreview();
    }
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