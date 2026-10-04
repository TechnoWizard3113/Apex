import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WIDTH = 12;
const LENGTH = 28;
const ROAD_THICKNESS = 0.8;
const START_OFFSET = 8;
const ROAD_CLEARANCE = 1;
const RADIUS = 24;
const CURVE_STEPS = 48;
const STRAIGHT_STEPS = 16;
const BARRIER_HEIGHT = 1.1;
const BANK_ANGLE = 0.18;
const PIECES = new Set([
  'start', 'straight', 'curveLeft', 'curveRight', 'ramp', 'rampDown', 'bankLeft',
  'bankRight', 'checkpoint', 'finish'
]);
const MOUNTAINS = new Set(['everfrost', 'glacier', 'whitefang', 'stormpeak']);

function peak(x, z, centerX, centerZ, height, radiusX, radiusZ) {
  const dx = Math.abs((x - centerX) / radiusX);
  const dz = Math.abs((z - centerZ) / radiusZ);
  return height * Math.exp(-(dx ** 1.45 + dz ** 1.45));
}

function mountainHeight(id, x, z) {
  let height;
  if (id === 'glacier') {
    const ridge = 76 * Math.exp(-(Math.abs(x / 190) ** 1.35 + Math.abs(z / 520) ** 1.55));
    height = ridge + peak(x, z, -190, 190, 30, 160, 230) + peak(x, z, 205, -260, 34, 150, 210);
  } else if (id === 'whitefang') {
    height = peak(x, z, -105, -25, 96, 165, 205) +
      peak(x, z, 112, 70, 88, 150, 190) +
      peak(x, z, 10, 270, 34, 220, 180);
  } else if (id === 'stormpeak') {
    const ridgeCenter = 105 * Math.sin(z / 230);
    const ridgeX = (x - ridgeCenter) / 145;
    height = 102 * Math.exp(-(Math.abs(ridgeX) ** 1.4 + Math.abs(z / 570) ** 1.6)) +
      peak(x, z, -245, -300, 40, 190, 220) +
      peak(x, z, 245, 320, 36, 180, 230);
  } else {
    height = peak(x, z, 0, 0, 112, 235, 270) +
      peak(x, z, 260, 210, 42, 180, 200) +
      peak(x, z, -280, -230, 36, 190, 180);
  }
  const detail = Math.sin(x * 0.026 + z * 0.011) *
    Math.sin(z * 0.031 - x * 0.009) * 1.8;
  return Math.max(0, height + detail * Math.min(1, height / 18));
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

function terrainSupport(mountainId, x, z, yaw, bank = 0) {
  let height = -Infinity;
  const across = right(yaw);
  for (let i = 0; i <= 24; i++) {
    const lateral = -WIDTH / 2 + WIDTH * i / 24;
    height = Math.max(height, mountainHeight(
      mountainId,
      x + across.x * lateral,
      z + across.z * lateral
    ) + lateral * Math.tan(bank));
  }
  return height;
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

function bandGeometry(samples, startLateral, endLateral, heightOffset = 0.19) {
  const vertices = [];
  const indices = [];
  for (const sample of samples) {
    const across = right(sample.yaw);
    const bankSlope = Math.tan(sample.bank);
    for (const lateral of [startLateral, endLateral]) {
      vertices.push(
        sample.position.x + across.x * lateral,
        sample.position.y - lateral * bankSlope + heightOffset,
        sample.position.z + across.z * lateral
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
    this.surfaceBuckets = new Map();
    this.mountainId = 'everfrost';
    this.spawn.y = terrainSupport(this.mountainId, 0, 0, 0) + ROAD_CLEARANCE;
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
    this.surfaceBuckets.clear();
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
    const maxBank = type === 'bankLeft' ? BANK_ANGLE : type === 'bankRight' ? -BANK_ANGLE : 0;
    const supportAtStart = terrainSupport(this.mountainId, start.x, start.z, yaw);
    const startOffset = start.y - supportAtStart - ROAD_CLEARANCE;
    const samples = [];
    const end = start.clone();
    let endYaw = yaw;

    if (type === 'curveLeft' || type === 'curveRight') {
      const direction = type === 'curveLeft' ? 1 : -1;
      for (let i = 0; i <= CURVE_STEPS; i++) {
        const angle = i / CURVE_STEPS * Math.PI / 2;
        const position = start.clone()
          .addScaledVector(right(yaw), direction * RADIUS * (1 - Math.cos(angle)))
          .addScaledVector(forward(yaw), RADIUS * Math.sin(angle));
        position.y = terrainSupport(this.mountainId, position.x, position.z, yaw + direction * angle) +
          ROAD_CLEARANCE + startOffset;
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
      const count = STRAIGHT_STEPS * 2;
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const rampTransition = fraction * fraction * (3 - 2 * fraction);
        const bank = maxBank * Math.sin(Math.PI * fraction);
        samples.push({
          position: new THREE.Vector3()
            .copy(start)
            .addScaledVector(forward(yaw), LENGTH * fraction),
          yaw,
          bank
        });
        const position = samples.at(-1).position;
        const inheritedOffset = rampHeight
          ? startOffset * (1 - rampTransition)
          : startOffset;
        const terrainFloor = terrainSupport(this.mountainId, position.x, position.z, yaw, bank) +
          ROAD_CLEARANCE + inheritedOffset;
        const rampHeightAtSample = start.y + rampHeight * rampTransition;
        position.y = rampHeight
          ? Math.max(terrainFloor, rampHeightAtSample)
          : terrainFloor;
      }
      end.copy(samples.at(-1).position);
    }

    const mesh = new THREE.Mesh(stripGeometry(samples), material(type));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.trackPieceIndex = pieceIndex;
    this.group.add(mesh);

    const edgeColor = type === 'checkpoint' ? 0x32d583 :
      type === 'ramp' || type === 'rampDown' ? 0xffbd55 :
        type === 'bankLeft' || type === 'bankRight' ? 0x69d2ed :
          type === 'start' || type === 'finish' ? 0xf3f6f8 : 0xd9e3ed;
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide
    });
    for (const [inner, outer] of [
      [-WIDTH / 2 + 0.42, -WIDTH / 2 + 0.82],
      [WIDTH / 2 - 0.82, WIDTH / 2 - 0.42]
    ]) {
      const edge = new THREE.Mesh(bandGeometry(samples, inner, outer), edgeMaterial);
      edge.receiveShadow = true;
      edge.userData.trackPieceIndex = pieceIndex;
      this.group.add(edge);
    }

    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0xeaf1f5,
      roughness: 0.65,
      side: THREE.DoubleSide
    });
    for (let i = 0; i < samples.length - 1; i += 6) {
      const dash = samples.slice(i, Math.min(i + 3, samples.length));
      if (dash.length < 2) continue;
      const marking = new THREE.Mesh(bandGeometry(dash, -0.1, 0.1, 0.205), laneMaterial);
      marking.userData.trackPieceIndex = pieceIndex;
      this.group.add(marking);
    }

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
    this.spawn.set(0, terrainSupport(this.mountainId, 0, 0, 0) + ROAD_CLEARANCE, 0);
    this.finish.copy(this.spawn);
    for (const piece of pieces) {
      this.add(typeof piece === 'string' ? piece : piece.type, typeof piece === 'string' ? 0 : piece.rotation || 0);
    }
    this.addEnvironment();
  }

  addEnvironment() {
    const size = 1800;
    const divisions = 400;
    const step = size / divisions;
    const vertices = [];
    const colors = [];
    const indices = [];
    const snow = new THREE.Color(0xe6f1f7);
    const rock = new THREE.Color(0x66717a);
    const tint = new THREE.Color();
    this.buildSurfaceBuckets(WIDTH / 2 + step * 4);
    for (let row = 0; row <= divisions; row++) {
      const z = -size / 2 + row * step;
      for (let column = 0; column <= divisions; column++) {
        const x = -size / 2 + column * step;
        let height = mountainHeight(this.mountainId, x, z) - 0.3;
        const road = this.getTerrainRoadSurface(x, z);
        if (road && road.distance < WIDTH / 2 + step * 4) {
          const roadUnderside = road.y - ROAD_THICKNESS - 0.02;
          const cutRadius = WIDTH / 2 + step * 0.35;
          const blend = THREE.MathUtils.clamp(
            (road.distance - cutRadius) / (step * 2.8),
            0,
            1
          );
          const smoothBlend = blend * blend * (3 - 2 * blend);
          height = roadUnderside + (height - roadUnderside) * smoothBlend;
        }
        const slopeX = (mountainHeight(this.mountainId, x + 2, z) -
          mountainHeight(this.mountainId, x - 2, z)) / 4;
        const slopeZ = (mountainHeight(this.mountainId, x, z + 2) -
          mountainHeight(this.mountainId, x, z - 2)) / 4;
        const steepness = Math.hypot(slopeX, slopeZ);
        const exposedRock = THREE.MathUtils.clamp((steepness - 0.32) * 1.45, 0, 0.9);
        const shade = THREE.MathUtils.clamp(0.94 + height * 0.0007, 0.9, 1);
        tint.copy(snow).lerp(rock, exposedRock).multiplyScalar(shade);
        vertices.push(x, height, z);
        colors.push(tint.r, tint.g, tint.b);
        if (row < divisions && column < divisions) {
          const a = row * (divisions + 1) + column;
          const b = a + divisions + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const keepTerrainBelowRoad = (x, z, roadBottom) => {
      const gridX = (x + size / 2) / step;
      const gridZ = (z + size / 2) / step;
      const column = THREE.MathUtils.clamp(Math.floor(gridX), 0, divisions - 1);
      const row = THREE.MathUtils.clamp(Math.floor(gridZ), 0, divisions - 1);
      const u = THREE.MathUtils.clamp(gridX - column, 0, 1);
      const v = THREE.MathUtils.clamp(gridZ - row, 0, 1);
      const a = row * (divisions + 1) + column;
      const b = a + divisions + 1;
      const triangle = u + v <= 1
        ? [[a, 1 - u - v], [b, v], [a + 1, u]]
        : [[a + 1, 1 - v], [b, 1 - u], [b + 1, u + v - 1]];
      const terrainHeight = triangle.reduce(
        (height, [index, weight]) => height + vertices[index * 3 + 1] * weight,
        0
      );
      if (terrainHeight <= roadBottom) return;
      const correction = terrainHeight - roadBottom;
      for (const [index] of triangle) vertices[index * 3 + 1] -= correction;
    };
    for (const segment of this.surfaceSegments) {
      const dx = segment.end.x - segment.start.x;
      const dz = segment.end.z - segment.start.z;
      const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.5));
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const centerX = segment.start.x + dx * fraction;
        const centerY = segment.start.y + (segment.end.y - segment.start.y) * fraction;
        const centerZ = segment.start.z + dz * fraction;
        for (let lateral = -WIDTH / 2; lateral <= WIDTH / 2; lateral += 0.5) {
          const x = centerX - Math.cos(segment.yaw) * lateral;
          const z = centerZ - Math.sin(segment.yaw) * lateral;
          const roadBottom = centerY - lateral * Math.tan(segment.bank) +
            0.16 - ROAD_THICKNESS - 0.02;
          keepTerrainBelowRoad(x, z, roadBottom);
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
      flatShading: true,
      side: THREE.DoubleSide
    }));
    terrain.receiveShadow = true;
    this.group.add(terrain);
    this.addRocks();
  }

  addRocks() {
    let seed = [...this.mountainId].reduce((value, character) => value * 31 + character.charCodeAt(0), 17) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const rock = new THREE.MeshStandardMaterial({ color: 0x303943, roughness: 0.94, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0x505b67, roughness: 0.92, flatShading: true });
    const rockInstances = new THREE.InstancedMesh(geometry, rock, 320);
    const snowInstances = new THREE.InstancedMesh(geometry, snow, 180);
    rockInstances.castShadow = true;
    rockInstances.receiveShadow = true;
    snowInstances.castShadow = true;
    snowInstances.receiveShadow = true;
    const transform = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    let rockCount = 0;
    let snowCount = 0;
    for (let attempt = 0; attempt < 1100 && (rockCount < rockInstances.count || snowCount < snowInstances.count); attempt++) {
      const x = (random() - 0.5) * 1250;
      const z = (random() - 0.5) * 1450;
      const ground = mountainHeight(this.mountainId, x, z);
      const slopeX = (mountainHeight(this.mountainId, x + 3, z) - mountainHeight(this.mountainId, x - 3, z)) / 6;
      const slopeZ = (mountainHeight(this.mountainId, x, z + 3) - mountainHeight(this.mountainId, x, z - 3)) / 6;
      const steepness = Math.hypot(slopeX, slopeZ);
      const scale = 1.4 + random() ** 2 * 7;
      if (ground < 4 || steepness < 0.28 ||
          (this.getTerrainRoadSurface(x, z)?.distance ?? Infinity) < WIDTH / 2 + 12 + scale * 1.5) continue;

      const normal = new THREE.Vector3(-slopeX, 1, -slopeZ).normalize();
      transform.position.set(x, ground - 0.1, z);
      transform.quaternion.setFromUnitVectors(up, normal);
      transform.quaternion.premultiply(
        new THREE.Quaternion().setFromAxisAngle(normal, random() * Math.PI * 2)
      );
      transform.rotation.x += (random() - 0.5) * 0.15;
      transform.rotation.z += (random() - 0.5) * 0.15;
      transform.scale.set(scale, scale * (0.55 + random() * 0.5), scale * (0.7 + random() * 0.5));
      transform.updateMatrix();
      if (steepness > 0.85 && rockCount < rockInstances.count) {
        rockInstances.setMatrixAt(rockCount++, transform.matrix);
      } else if (snowCount < snowInstances.count) {
        snowInstances.setMatrixAt(snowCount++, transform.matrix);
      }
    }
    rockInstances.count = rockCount;
    snowInstances.count = snowCount;
    rockInstances.instanceMatrix.needsUpdate = true;
    snowInstances.instanceMatrix.needsUpdate = true;
    if (rockCount) this.group.add(rockInstances);
    else rock.dispose();
    if (snowCount) this.group.add(snowInstances);
    else snow.dispose();
    if (!rockCount && !snowCount) geometry.dispose();
  }

  getTerrainHeight(x, z) {
    return mountainHeight(this.mountainId, x, z);
  }

  getSurfaceAt(x, z, y = null) {
    return this.findSurfaceAt(x, z, y, this.surfaceSegments);
  }

  findSurfaceAt(x, z, y, segments) {
    let nearest = null;
    for (const segment of segments) {
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
        yaw: segment.yaw,
        pitch: Math.atan2(segment.end.y - segment.start.y, Math.hypot(dx, dz)),
        bank: segment.bank
      };
    }
    return nearest;
  }

  buildSurfaceBuckets(radius) {
    const cellSize = 32;
    const buckets = new Map();
    for (const segment of this.surfaceSegments) {
      const minX = Math.floor((Math.min(segment.start.x, segment.end.x) - radius) / cellSize);
      const maxX = Math.floor((Math.max(segment.start.x, segment.end.x) + radius) / cellSize);
      const minZ = Math.floor((Math.min(segment.start.z, segment.end.z) - radius) / cellSize);
      const maxZ = Math.floor((Math.max(segment.start.z, segment.end.z) + radius) / cellSize);
      for (let cellX = minX; cellX <= maxX; cellX++) {
        for (let cellZ = minZ; cellZ <= maxZ; cellZ++) {
          const key = `${cellX},${cellZ}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(segment);
        }
      }
    }
    this.surfaceBuckets = buckets;
  }

  getTerrainRoadSurface(x, z) {
    const segments = this.surfaceBuckets.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) || [];
    return this.findSurfaceAt(x, z, null, segments);
  }

  constrainVehicle(position) {
    const surface = this.getSurfaceAt(position.x, position.z, position.y);
    const groundY = this.getTerrainHeight(position.x, position.z);
    if (!surface || surface.distance > WIDTH / 2 + 5 ||
        Math.abs(groundY - position.y) < Math.abs(surface.y - position.y)) {
      return { onTrack: true, hitBarrier: false, y: groundY, pitch: 0, bank: 0 };
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
      y: constrainedSurface?.y ?? surface.y,
      pitch: constrainedSurface?.pitch ?? surface.pitch,
      bank: constrainedSurface?.bank ?? surface.bank
    };
  }

  getSpawn() {
    const yaw = this.p[0]?.yaw || 0;
    const position = this.spawn.clone().addScaledVector(forward(yaw), START_OFFSET);
    const surface = this.getSurfaceAt(position.x, position.z, position.y);
    if (surface) position.y = Math.max(surface.y, this.getTerrainHeight(position.x, position.z) + ROAD_CLEARANCE);
    return { position, yaw };
  }
}
