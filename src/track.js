import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WIDTH = 12;
const LENGTH = 28;
const RADIUS = 24;
const CURVE_STEPS = 16;
const BARRIER_HEIGHT = 1.1;
const BANK_ANGLE = 0.18;
const PIECES = new Set([
  'start', 'straight', 'curveLeft', 'curveRight', 'ramp', 'boost', 'bankLeft',
  'bankRight', 'checkpoint', 'finish'
]);

function material(type) {
  const color = type === 'boost' ? 0x137ea8 :
    type === 'start' ? 0x596b78 :
    type === 'ramp' ? 0x625094 :
      type.startsWith('bank') ? 0x3c6553 :
        type === 'checkpoint' ? 0x417e6c :
          type === 'finish' ? 0x3d454e : 0x46515e;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, side: THREE.DoubleSide });
}

function forward(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
}

function right(yaw) {
  return new THREE.Vector3(-Math.cos(yaw), 0, -Math.sin(yaw));
}

function stripGeometry(samples) {
  const vertices = [];
  const indices = [];
  for (const sample of samples) {
    const across = right(sample.yaw);
    const bankSlope = Math.tan(sample.bank);
    for (const side of [-1, 1]) {
      const offset = side * WIDTH / 2;
      vertices.push(
        sample.position.x + across.x * offset,
        sample.position.y - offset * bankSlope + 0.16,
        sample.position.z + across.z * offset
      );
    }
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBarrier(group, start, end, mat, width = 0.55, height = BARRIER_HEIGHT) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const horizontalLength = Math.hypot(direction.x, direction.z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, direction.length()), mat);
  wall.position.copy(start).add(end).multiplyScalar(0.5);
  wall.position.y += height / 2;
  wall.rotation.order = 'YXZ';
  wall.rotation.y = Math.atan2(direction.x, direction.z);
  wall.rotation.x = -Math.atan2(direction.y, horizontalLength);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
}

function addGate(group, position, yaw, type) {
  const color = type === 'finish' ? 0xf2f4f5 : 0x32d583;
  const postMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const postGeometry = new THREE.BoxGeometry(0.7, 4.3, 0.7);
  const beamGeometry = new THREE.BoxGeometry(WIDTH, 0.7, 0.7);
  const gate = new THREE.Group();
  gate.position.copy(position);
  gate.position.y += 2.15;
  gate.rotation.y = yaw;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.x = side * (WIDTH / 2 - 0.4);
    post.castShadow = true;
    gate.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, postMaterial);
  beam.position.y = 2.15;
  beam.castShadow = true;
  gate.add(beam);
  group.add(gate);
}

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.p = [];
    this.checkpoints = [];
    this.spawn = new THREE.Vector3(0, 0, 0);
    this.finish = this.spawn.clone();
    this.surfaceSegments = [];
    this.barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x9eabb2, roughness: 0.55 });
  }

  clear() {
    this.group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach(item => {
          if (item !== this.barrierMaterial) item.dispose();
        });
      } else if (object.material !== this.barrierMaterial) object.material.dispose();
    });
    this.group.clear();
    this.p = [];
    this.checkpoints = [];
    this.surfaceSegments = [];
    this.finish.copy(this.spawn);
  }

  add(type, rotation = 0) {
    if (!PIECES.has(type)) throw new Error(`Unknown track piece: ${type}`);

    const previous = this.p.at(-1);
    const start = previous ? previous.end.clone() : this.spawn.clone();
    const yaw = (previous ? previous.endYaw : 0) + rotation;
    const maxBank = type === 'bankLeft' ? BANK_ANGLE : type === 'bankRight' ? -BANK_ANGLE : 0;
    const samples = [];
    const end = start.clone();
    let endYaw = yaw;

    if (type === 'curveLeft' || type === 'curveRight') {
      const direction = type === 'curveLeft' ? -1 : 1;
      for (let i = 0; i <= CURVE_STEPS; i++) {
        const angle = i / CURVE_STEPS * Math.PI / 2;
        const position = start.clone()
          .addScaledVector(right(yaw), direction * RADIUS * (1 - Math.cos(angle)))
          .addScaledVector(forward(yaw), RADIUS * Math.sin(angle));
        samples.push({
          position,
          yaw: yaw + direction * angle,
          bank: 0
        });
      }
      end.copy(samples.at(-1).position);
      endYaw += direction * Math.PI / 2;
    } else {
      const rampHeight = type === 'ramp' ? 9 : 0;
      const count = 4;
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const bank = maxBank * Math.sin(Math.PI * fraction);
        samples.push({
          position: start.clone()
            .addScaledVector(forward(yaw), LENGTH * fraction)
            .add(new THREE.Vector3(0, rampHeight * fraction, 0)),
          yaw,
          bank
        });
      }
      end.copy(samples.at(-1).position);
    }

    const mesh = new THREE.Mesh(stripGeometry(samples), material(type));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    for (let i = 0; i < samples.length - 1; i++) {
      const first = samples[i];
      const second = samples[i + 1];
      for (const side of [-1, 1]) {
        const lateral = side * WIDTH / 2;
        const startRail = first.position.clone()
          .addScaledVector(right(first.yaw), lateral)
          .add(new THREE.Vector3(0, -lateral * Math.tan(first.bank) + 0.16, 0));
        const endRail = second.position.clone()
          .addScaledVector(right(second.yaw), lateral)
          .add(new THREE.Vector3(0, -lateral * Math.tan(second.bank) + 0.16, 0));
        createBarrier(this.group, startRail, endRail, this.barrierMaterial);
      }
      this.surfaceSegments.push({
        start: first.position.clone(),
        end: second.position.clone(),
        yaw: first.yaw + (second.yaw - first.yaw) / 2,
        bank: (first.bank + second.bank) / 2
      });
      if (i === 0 && previous && Math.abs(previous.endYaw - yaw) > 0.01 && Math.abs(previous.end.y - start.y) < 0.1) {
        const join = new THREE.Mesh(
          new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, 0.34, 24),
          material(type)
        );
        join.position.copy(start);
        join.position.y += 0.05;
        join.rotation.y = yaw;
        join.receiveShadow = true;
        this.group.add(join);
      }
    }

    const piece = { type, start, yaw, end, endYaw };
    this.p.push(piece);
    this.finish.copy(end);

    if (type === 'checkpoint') {
      const middle = samples[Math.floor(samples.length / 2)];
      this.checkpoints.push({ ...middle.position });
      addGate(this.group, middle.position, middle.yaw, type);
    } else if (type === 'start') {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(WIDTH, 0.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5 })
      );
      marker.position.copy(start).addScaledVector(forward(yaw), 3.2);
      marker.position.y += 0.22;
      marker.rotation.y = -yaw;
      this.group.add(marker);
    } else if (type === 'finish') {
      const finishPosition = samples.at(-1);
      this.finish.copy(finishPosition.position);
      addGate(this.group, finishPosition.position, endYaw, type);
    }
    return piece;
  }

  build(pieces) {
    this.clear();
    for (const piece of pieces) {
      this.add(typeof piece === 'string' ? piece : piece.type, typeof piece === 'string' ? 0 : piece.rotation || 0);
    }
    this.addEnvironment();
  }

  addEnvironment() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshStandardMaterial({ color: 0x17211a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    this.group.add(ground);

  }

  getSurfaceAt(x, z) {
    let nearest = null;
    for (const segment of this.surfaceSegments) {
      const dx = segment.end.x - segment.start.x;
      const dz = segment.end.z - segment.start.z;
      const lengthSquared = dx * dx + dz * dz;
      if (lengthSquared === 0) continue;
      const fraction = THREE.MathUtils.clamp(
        ((x - segment.start.x) * dx + (z - segment.start.z) * dz) / lengthSquared,
        0,
        1
      );
      const centerX = segment.start.x + dx * fraction;
      const centerZ = segment.start.z + dz * fraction;
      const offsetX = x - centerX;
      const offsetZ = z - centerZ;
      const distance = Math.hypot(offsetX, offsetZ);
      if (nearest && distance >= nearest.distance) continue;
      const lateral = -offsetX * Math.cos(segment.yaw) - offsetZ * Math.sin(segment.yaw);
      const centerY = segment.start.y + (segment.end.y - segment.start.y) * fraction;
      nearest = {
        distance,
        lateral,
        y: centerY - lateral * Math.tan(segment.bank) + 0.16,
        yaw: segment.yaw
      };
    }
    return nearest;
  }

  constrainVehicle(position) {
    const surface = this.getSurfaceAt(position.x, position.z);
    if (!surface || surface.distance > WIDTH / 2 + 5) return { onTrack: false, hitBarrier: false };

    const maxLateral = WIDTH / 2 - 2;
    let hitBarrier = false;
    if (Math.abs(surface.lateral) > maxLateral) {
      hitBarrier = true;
      const lateral = Math.sign(surface.lateral) * maxLateral;
      position.x += (lateral - surface.lateral) * -Math.cos(surface.yaw);
      position.z += (lateral - surface.lateral) * -Math.sin(surface.yaw);
    }
    const constrainedSurface = this.getSurfaceAt(position.x, position.z);
    return {
      onTrack: true,
      hitBarrier,
      y: constrainedSurface?.y ?? surface.y
    };
  }

  getSpawn() {
    return { position: this.spawn.clone(), yaw: this.p[0]?.yaw || 0 };
  }
}
