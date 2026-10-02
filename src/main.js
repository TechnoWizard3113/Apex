import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Track } from './track.js';
import { Vehicle } from './vehicle.js';
import { Cam } from './camera.js';
import { settings, saveSettings, vehicle, saveVehicle, scores, score, custom, saveCustom, savedTracks, saveTrack, reset } from './storage.js';

const $ = x => document.getElementById(x);
const tracks = [
  {
    id: 'mountain',
    name: 'Mountain Run',
    desc: 'Technical starter circuit',
    p: ['straight', 'straight', 'curveRight', 'straight', 'ramp', 'straight', 'curveLeft', 'boost', 'curveLeft', 'straight', 'bankRight', 'straight', 'curveRight']
  },
  {
    id: 'speed',
    name: 'Speed Circuit',
    desc: 'High speed test track',
    p: ['straight', 'boost', 'straight', 'curveLeft', 'straight', 'boost', 'curveLeft', 'straight', 'ramp', 'straight', 'curveRight', 'boost', 'straight', 'curveRight']
  }
];

let S = settings(),
  A = vehicle(),
  scene,
  camera,
  renderer,
  track,
  car,
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
  countdownTimer = null;

let c = { throttle: false, brake: false, left: false, right: false };

const fmt = t => {
  if (!isFinite(t)) return '--:--.---';
  let n = t | 0;
  return `${String((n / 60000) | 0).padStart(2, '0')}:${String(((n % 60000) / 1000) | 0).padStart(2, '0')}.${String(n % 1000).padStart(3, '0')}`;
};

function show(id) {
  ['menu', 'tracksScreen', 'leaderScreen', 'builderScreen', 'vehicleScreen', 'settingsScreen'].forEach(x => $(x).classList.add('hidden'));
  $(id).classList.remove('hidden');
  if (renderer) requestAnimationFrame(() => resizeRenderer(renderer.domElement.parentElement));
}

function resizeRenderer(container) {
  if (!renderer || !container) return;
  const width = container.clientWidth || innerWidth;
  const height = container.clientHeight || innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x263020, 1.8));
  let l = new THREE.DirectionalLight(0xffffff, 2.2);
  l.position.set(100, 140, 80);
  l.castShadow = true;
  scene.add(l);

  track = new Track(scene);
  car = new Vehicle(scene, A);
  follow = new Cam(camera, S);
  camera.position.set(0, 32, 58);
  camera.lookAt(0, 0, 20);
  requestAnimationFrame(loop);
}

function race(t) {
  init('gameView');
  track.build(t.p);
  car.setAppearance(A);
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
  let t = performance.now() - start,
    a = score(active.id, t);
  $('time').textContent = fmt(t);
  $('best').textContent = fmt(a[0].time);$('finish').textContent = `FINISH  ${fmt(t)}`;
  $('finish').classList.remove('hidden');
}

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
      if (d2d < 16 && Math.abs(car.pos.y - cp.y) < 10) {
        ci++;
        $('checkpoint').textContent = `CHECKPOINT ${ci}/${track.checkpoints.length}`;
      }
    }

    if (ci >= track.checkpoints.length) {
      let fin = track.finish;
      let d2d = Math.hypot(car.pos.x - fin.x, car.pos.z - fin.z);
      if (d2d < 16 && Math.abs(car.pos.y - fin.y) < 10) finish();
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
    d.innerHTML = `<span>${i + 1}</span><span>${x.name}</span><span>${fmt(x.time)}</span>`;
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
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  preview.position.copy(startPoint).addScaledVector(forward, 14);
  preview.position.y += startPoint.y;
  preview.rotation.y = yaw;
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
  entries.push({ key: makePieceKey(), type: selectedPiece, rotation: rot });
  rot = 0;
  rebuild();
}

function openBuilder(saved = null) {
  init('builderView');
  editingTrackId = saved?.id || null;
  entries = saved ? saved.pieces.map(piece => ({ ...piece })) : custom();
  $('trackName').value = saved?.name || '';
  selectedPiece = null;
  rot = 0;
  rebuild();
  show('builderScreen');
}

function vehicleUI() {
  $('bodyColor').value = A.bodyColor;
  $('accentColor').value = A.accentColor;
  $('bodyStyle').value = A.bodyStyle;
  $('wheelStyle').value = A.wheelStyle;
  init('vehicleView');
}

$('play').onclick = () => {
  renderTracks();
  show('tracksScreen');
};
$('tracks').onclick = () => {
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
  $('showCheckpoints').checked = S.showCheckpoints;
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
  if (entries.length < 3) {
    $('buildStatus').textContent = 'Add at least 3 pieces before testing the track.';
    return;
  }
  race({ id: editingTrackId || 'custom-preview', name: $('trackName').value.trim() || 'Custom Track', p: entries });
};
$('saveTrack').onclick = () => {
  if (entries.length < 3) {
    $('buildStatus').textContent = 'Add at least 3 pieces before saving the track.';
    return;
  }
  const name = $('trackName').value.trim() || 'My Track';
  editingTrackId ||= `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  saveTrack({ id: editingTrackId, name, pieces: entries });
  $('buildStatus').textContent = `"${name}" saved. Track edits are also saved as you build.`;
};
$('saveVehicle').onclick = () => {
  A = {
    bodyColor: $('bodyColor').value,
    accentColor: $('accentColor').value,
    bodyStyle: $('bodyStyle').value,
    wheelStyle: $('wheelStyle').value
  };
  saveVehicle(A);
  if (car) car.setAppearance(A);
};

$('graphics').onchange = e => {   S.graphics = e.target.value;   saveSettings(S);   if (renderer) renderer.shadowMap.enabled = S.graphics !== 'low'; };$('camDistance').oninput = e => {
  S.cameraDistance = +e.target.value;
  saveSettings(S);
  if (follow) follow.s = S;
};
$('camHeight').oninput = e => {   S.cameraHeight = +e.target.value;   saveSettings(S);   if (follow) follow.s = S; };$('showSpeed').onchange = e => {
  S.showSpeed = e.target.checked;
  saveSettings(S);
};
$('showCheckpoints').onchange = e => {   S.showCheckpoints = e.target.checked;   saveSettings(S); };$('reset').onclick = () => {
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
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resizeRenderer(container);
  }
});

addEventListener('blur', () => {
  c = { throttle: false, brake: false, left: false, right: false };
});