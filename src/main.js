import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Track } from './track.js';
import { Vehicle } from './vehicle.js';
import { Cam } from './camera.js';
import { settings, saveSettings, vehicle, saveVehicle, scores, score, custom, saveCustom, reset } from './storage.js';

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
  rot = 0;

let c = { throttle: false, brake: false, left: false, right: false };

const fmt = t => {
  if (!isFinite(t)) return '--:--.---';
  let n = t | 0;
  return `${String((n / 60000) | 0).padStart(2, '0')}:${String(((n % 60000) / 1000) | 0).padStart(2, '0')}.${String(n % 1000).padStart(3, '0')}`;
};

function show(id) {
  ['menu', 'tracksScreen', 'leaderScreen', 'builderScreen', 'vehicleScreen', 'settingsScreen'].forEach(x => $(x).classList.add('hidden'));$(id).classList.remove('hidden');
}

function init(id) {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea0ae);
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 3000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = S.graphics !== 'low';
  $(id).appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x263020, 1.8));
  let l = new THREE.DirectionalLight(0xffffff, 2.2);
  l.position.set(100, 140, 80);
  l.castShadow = true;
  scene.add(l);

  track = new Track(scene);
  car = new Vehicle(scene, A);
  follow = new Cam(camera, S);
  requestAnimationFrame(loop);
}

function race(t) {
  init('gameView');
  track.build(t.p);
  car.setAppearance(A);
  let sp = track.getSpawn();
  car.reset(sp.position, sp.yaw);
  active = t;
  ci = 0;
  finished = false;
  running = false;
  $('game').classList.remove('hidden');$('gameTrack').textContent = t.name;
  $('best').textContent = scores(t.id)[0] ? fmt(scores(t.id)[0].time) : '--:--.---';
  $('checkpoint').textContent = `CHECKPOINT 0/${track.checkpoints.length}`;

  let n = 3;
  $('countdown').textContent = n;
  let q = setInterval(() => {
    n--;
    if (n) {
      $('countdown').textContent = n;
    } else {
      clearInterval(q);
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
  tracks.forEach(t => {
    let b = document.createElement('button');
    b.className = 'card';
    let best = scores(t.id)[0];
    b.innerHTML = `<div><small>${t.id.toUpperCase()}</small><h2>${t.name}</h2><p class="muted">${t.desc}</p></div><div>BEST ${best ? fmt(best.time) : '--:--.---'}</div>`;
    b.onclick = () => {
      active = t;
      renderLeader(t);
      show('leaderScreen');
    };
    box.appendChild(b);
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

function rebuild() {
  track.build(entries);
  if (preview) {
    scene.remove(preview);
    preview = null;
  }
  $('buildStatus').textContent = `${entries.length} pieces`;
}

function pv(type) {
  if (preview) scene.remove(preview);
  let p = track.p.at(-1),
    st = p ? p.end.clone() : track.spawn.clone(),
    y = (p ? p.endYaw : 0) + rot;

  let geo = new THREE.BoxGeometry(12, 0.5, 28);
  let mat = new THREE.MeshStandardMaterial({ color: 0x32d583, transparent: true, opacity: 0.45 });
  preview = new THREE.Mesh(geo, mat);

  let q = new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
  preview.position.copy(st).addScaledVector(q, 14);
  preview.rotation.y = y;

  scene.add(preview);
  $('buildStatus').textContent = `Preview ${type}. Q/E rotate, Enter place.`;
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
  init('builderView');
  entries = custom();
  rebuild();
  show('builderScreen');
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
document.querySelectorAll('[data-piece]').forEach(b => (b.onclick = () => pv(b.dataset.piece)));

$('undo').onclick = () => {
  entries.pop();
  rebuild();
};
$('clear').onclick = () => {
  entries = [];
  rebuild();
};
$('test').onclick = () => {   if (entries.length >= 3) race({ id: 'custom', name: 'Custom Track', p: entries.map(x => x.type) }); };$('saveTrack').onclick = () => {
  saveCustom(entries);
  $('buildStatus').textContent = 'Track saved locally.';
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
$('hudMenu').onclick = () => {$('game').classList.add('hidden');
  running = false;
  show('menu');
};

addEventListener('keydown', e => {
  let k = e.key.toLowerCase();
  if (!$('builderScreen').classList.contains('hidden')) {
    if (k === 'q') rot -= Math.PI / 12;
    if (k === 'e') rot += Math.PI / 12;
    if (e.key === 'Enter' && preview) {
      entries.push({ type: 'straight', rotation: rot });
      rot = 0;
      rebuild();
    }
    if (k === 'z') {
      entries.pop();
      rebuild();
    }
  }
  if (e.key === 'ArrowUp' || k === 'w') c.throttle = true;
  if (e.key === 'ArrowDown' || k === 's') c.brake = true;
  if (e.key === 'ArrowLeft' || k === 'a') c.left = true;
  if (e.key === 'ArrowRight' || k === 'd') c.right = true;
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
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
});