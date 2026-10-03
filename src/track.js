import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WIDTH = 12;
const LENGTH = 28;
const ROAD_THICKNESS = 0.8;
const START_OFFSET = 8;
const ROAD_CLEARANCE = 1.1;
const RADIUS = 24;
const CURVE_STEPS = 16;
const BARRIER_HEIGHT = 1.1;
const BANK_ANGLE = 0.18;
const PIECES = new Set([
  'start', 'straight', 'curveLeft', 'curveRight', 'ramp', 'rampDown', 'bankLeft',
  'bankRight', 'checkpoint', 'finish'
]);
const MOUNTAINS = new Set(['everfrost', 'glacier', 'whitefang', 'stormpeak']);

function peak(x, z, centerX, centerZ, height, radiusX, radiusZ) {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  return height * Math.exp(-(dx * dx + dz * dz));
}

function mountainHeight(id, x, z) {
  if (id === 'glacier') {
    const ridge = 76 * Math.exp(-((x / 190) ** 2 + (z / 520) ** 2));
    return ridge + peak(x, z, -190, 190, 30, 160, 230) + peak(x, z, 205, -260, 34, 150, 210);
  }
  if (id === 'whitefang') {
    return peak(x, z, -105, -25, 96, 165, 205) +
      peak(x, z, 112, 70, 88, 150, 190) +
      peak(x, z, 10, 270, 34, 220, 180);
  }
  if (id === 'stormpeak') {
    const ridgeCenter = 105 * Math.sin(z / 230);
    const ridgeX = (x - ridgeCenter) / 145;
    return 102 * Math.exp(-(ridgeX * ridgeX + (z / 570) ** 2)) +
      peak(x, z, -245, -300, 40, 190, 220) +
      peak(x, z, 245, 320, 36, 180, 230);
  }
  return peak(x, z, 0, 0, 112, 235, 270) +
    peak(x, z, 260, 210, 42, 180, 200) +
    peak(x, z, -280, -230, 36, 190, 180);
}

function material(type) {
  const color = type === 'start' ? 0x596b78 :
    type === 'ramp' ? 0x625094 :
      type === 'rampDown' ? 0x8b563d :
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
      const x = sample.position.x + across.x * offset;
      const y = sample.position.y - offset * bankSlope + 0.16;
      const z = sample.position.z + across.z * offset;
      vertices.push(x, y, z, x, y - ROAD_THICKNESS, z);
    }
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 4;
    const b = a + 4;
    indices.push(
      a, a + 2, b,
      a + 2, b + 2, b,
      a + 1, b + 1, a + 3,
      a + 3, b + 1, b + 3,
      a, b, a + 1,
      a + 1, b, b + 1,
      a + 2, a + 3, b + 2,
      a + 3, b + 3, b + 2
    );
  }
  const first = 0;
  const last = (samples.length - 1) * 4;
  indices.push(
    first, first + 1, first + 2,
    first + 1, first + 3, first + 2,
    last, last + 2, last + 1,
    last + 1, last + 2, last + 3
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBarrier(group, start, end, mat, pieceIndex, width = 0.55, height = BARRIER_HEIGHT) {
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
  wall.userData.trackPieceIndex = pieceIndex;
  group.add(wall);
}

function addGate(group, position, yaw, type, pieceIndex) {
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
    post.userData.trackPieceIndex = pieceIndex;
    gate.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, postMaterial);
  beam.position.y = 2.15;
  beam.castShadow = true;
  beam.userData.trackPieceIndex = pieceIndex;
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
    this.mountainId = 'everfrost';
    this.spawn.y = mountainHeight(this.mountainId, 0, 0) + ROAD_CLEARANCE;
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
    if (type === 'boost') type = 'straight';
    if (!PIECES.has(type)) throw new Error(`Unknown track piece: ${type}`);

    rotation = Math.round(rotation / (Math.PI / 2)) * Math.PI / 2;
    const pieceIndex = this.p.length;
    const previous = this.p.at(-1);
    const start = previous ? previous.end.clone() : this.spawn.clone();
    const yaw = (previous ? previous.endYaw : 0) + rotation;
    const startOffset = start.y - mountainHeight(this.mountainId, start.x, start.z) - ROAD_CLEARANCE;
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
        position.y = mountainHeight(this.mountainId, position.x, position.z) + ROAD_CLEARANCE + startOffset;
        samples.push({
          position,
          yaw: yaw + direction * angle,
          bank: 0
        });
      }
      end.copy(samples.at(-1).position);
      endYaw += direction * Math.PI / 2;
    } else {
      const rampHeight = type === 'ramp' ? 9 : type === 'rampDown' ? -9 : 0;
      const count = 4;
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const bank = maxBank * Math.sin(Math.PI * fraction);
        samples.push({
          position: new THREE.Vector3()
            .copy(start)
            .addScaledVector(forward(yaw), LENGTH * fraction),
          yaw,
          bank
        });
        const position = samples.at(-1).position;
        position.y = mountainHeight(this.mountainId, position.x, position.z) +
          ROAD_CLEARANCE + startOffset + rampHeight * fraction;
      }
      end.copy(samples.at(-1).position);
    }

    const mesh = new THREE.Mesh(stripGeometry(samples), material(type));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.trackPieceIndex = pieceIndex;
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
        createBarrier(this.group, startRail, endRail, this.barrierMaterial, pieceIndex);
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
        join.userData.trackPieceIndex = pieceIndex;
        this.group.add(join);
      }
    }

    const piece = { type, start, yaw, end, endYaw, mesh };
    this.p.push(piece);
    this.finish.copy(end);

    if (type === 'checkpoint') {
      const middle = samples[Math.floor(samples.length / 2)];
      this.checkpoints.push({ ...middle.position, yaw: middle.yaw });
      addGate(this.group, middle.position, middle.yaw, type, pieceIndex);
    } else if (type === 'start') {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(WIDTH, 0.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5 })
      );
      marker.position.copy(start).addScaledVector(forward(yaw), 3.2);
      marker.position.y += 0.22;
      marker.rotation.y = -yaw;
      marker.userData.trackPieceIndex = pieceIndex;
      this.group.add(marker);
    } else if (type === 'finish') {
      const finishPosition = samples.at(-1);
      this.finish.copy(finishPosition.position);
      addGate(this.group, finishPosition.position, endYaw, type, pieceIndex);
    }
    return piece;
  }

  build(pieces, selectedMountain = this.mountainId) {
    this.clear();
    if (!MOUNTAINS.has(selectedMountain)) throw new Error(`Unknown mountain: ${selectedMountain}`);
    this.mountainId = selectedMountain;
    this.spawn.set(0, mountainHeight(this.mountainId, 0, 0) + ROAD_CLEARANCE, 0);
    this.finish.copy(this.spawn);
    for (const piece of pieces) {
      this.add(typeof piece === 'string' ? piece : piece.type, typeof piece === 'string' ? 0 : piece.rotation || 0);
    }
    this.addEnvironment();
  }

  addEnvironment() {
    const size = 1800;
    const divisions = 100;
    const step = size / divisions;
    const vertices = [];
    const colors = [];
    const indices = [];
    const snow = new THREE.Color(0xe6f1f7);
    const rock = new THREE.Color(0x66717a);
    const tint = new THREE.Color();
    for (let row = 0; row <= divisions; row++) {
      const z = -size / 2 + row * step;
      for (let column = 0; column <= divisions; column++) {
        const x = -size / 2 + column * step;
        const height = mountainHeight(this.mountainId, x, z);
        const slopeX = (mountainHeight(this.mountainId, x + 4, z) -
          mountainHeight(this.mountainId, x - 4, z)) / 8;
        const slopeZ = (mountainHeight(this.mountainId, x, z + 4) -
          mountainHeight(this.mountainId, x, z - 4)) / 8;
        const steepness = Math.hypot(slopeX, slopeZ);
        const exposedRock = THREE.MathUtils.clamp((steepness - 0.48) * 1.8, 0, 0.82);
        const shade = THREE.MathUtils.clamp(0.94 + height * 0.0007, 0.9, 1);
        tint.copy(snow).lerp(rock, exposedRock).multiplyScalar(shade);
        vertices.push(x, height - 0.3, z);
        colors.push(tint.r, tint.g, tint.b);
        if (row < divisions && column < divisions) {
          const a = row * (divisions + 1) + column;
          const b = a + divisions + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      side: THREE.DoubleSide
    }));
    terrain.receiveShadow = true;
    this.group.add(terrain);
  }

  getTerrainHeight(x, z) {
    return mountainHeight(this.mountainId, x, z);
  }

  getSurfaceAt(x, z, y = null) {
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
      const lateral = -offsetX * Math.cos(segment.yaw) - offsetZ * Math.sin(segment.yaw);
      const centerY = segment.start.y + (segment.end.y - segment.start.y) * fraction;
      const verticalDistance = y === null ? 0 : Math.abs(centerY - y);
      const score = Math.hypot(distance, verticalDistance * 1.5);
      if (nearest && score >= nearest.score) continue;
      nearest = {
        distance,
        score,
        lateral,
        y: centerY - lateral * Math.tan(segment.bank) + 0.16,
        yaw: segment.yaw
      };
    }
    return nearest;
  }

  constrainVehicle(position) {
    const surface = this.getSurfaceAt(position.x, position.z, position.y);
    const groundY = this.getTerrainHeight(position.x, position.z);
    if (!surface || surface.distance > WIDTH / 2 + 5 ||
        Math.abs(groundY - position.y) < Math.abs(surface.y - position.y)) {
      return { onTrack: true, hitBarrier: false, y: groundY };
    }

    const maxLateral = WIDTH / 2 - 2;
    let hitBarrier = false;
    if (Math.abs(surface.lateral) > maxLateral) {
      hitBarrier = true;
      const lateral = Math.sign(surface.lateral) * maxLateral;
      position.x += (lateral - surface.lateral) * -Math.cos(surface.yaw);
      position.z += (lateral - surface.lateral) * -Math.sin(surface.yaw);
    }
    const constrainedSurface = this.getSurfaceAt(position.x, position.z, position.y);
    return {
      onTrack: true,
      hitBarrier,
      y: constrainedSurface?.y ?? surface.y
    };
  }

  getSpawn() {
    const yaw = this.p[0]?.yaw || 0;
    const position = this.spawn.clone().addScaledVector(forward(yaw), START_OFFSET);
    const surface = this.getSurfaceAt(position.x, position.z, position.y);
    if (surface) position.y = surface.y;
    return { position, yaw };
  }
}
