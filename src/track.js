import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WIDTH = 12;
const LENGTH = 28;
const RADIUS = 24;
const CURVE_STEPS = 12;
const PIECES = new Set(['straight', 'curveLeft', 'curveRight', 'ramp', 'boost', 'bankLeft', 'bankRight']);

function material(type) {
  const color = type === 'boost' ? 0x19a9ff :
    type === 'ramp' ? 0x9075ff :
      type.startsWith('bank') ? 0x36b77b : 0x46515e;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
}

function segment(start, end, mat) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const horizontalLength = Math.hypot(direction.x, direction.z);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH, 0.5, direction.length()),
    mat
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = Math.atan2(direction.x, direction.z);
  mesh.rotation.x = -Math.atan2(direction.y, horizontalLength);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
  }

  clear() {
    this.group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(item => item.dispose());
      else object.material.dispose();
    });
    this.group.clear();
    this.p = [];
    this.checkpoints = [];
    this.finish.copy(this.spawn);
  }

  add(type, rotation = 0) {
    if (!PIECES.has(type)) throw new Error(`Unknown track piece: ${type}`);

    const previous = this.p.at(-1);
    const start = previous ? previous.end.clone() : this.spawn.clone();
    const heading = (previous ? previous.endYaw : 0) + rotation;
    const end = start.clone();
    let endYaw = heading;
    const mat = material(type);

    if (type === 'curveLeft' || type === 'curveRight') {
      const direction = type === 'curveLeft' ? -1 : 1;
      const points = [];
      for (let i = 0; i <= CURVE_STEPS; i++) {
        const angle = (i / CURVE_STEPS) * Math.PI / 2;
        const point = new THREE.Vector3(
          direction * RADIUS * (1 - Math.cos(angle)),
          0,
          RADIUS * Math.sin(angle)
        );
        point.applyAxisAngle(new THREE.Vector3(0, 1, 0), heading).add(start);
        points.push(point);
      }
      for (let i = 0; i < CURVE_STEPS; i++) {
        this.group.add(segment(points[i], points[i + 1], mat));
      }
      end.copy(points.at(-1));
      endYaw += direction * Math.PI / 2;
    } else {
      const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      end.addScaledVector(forward, LENGTH);
      if (type === 'ramp') end.y += 9;

      const surfaceStart = start.clone();
      const surfaceEnd = end.clone();
      if (type !== 'ramp') {
        surfaceStart.y = start.y;
        surfaceEnd.y = start.y;
      }
      const road = segment(surfaceStart, surfaceEnd, mat);
      if (type === 'bankLeft') road.rotation.z = 0.38;
      if (type === 'bankRight') road.rotation.z = -0.38;
      this.group.add(road);
    }

    const piece = { type, start, yaw: heading, end, endYaw };
    this.p.push(piece);
    this.finish.copy(end);
    if (this.p.length % 3 === 0) this.checkpoints.push(end.clone());
    return piece;
  }

  build(pieces) {
    this.clear();
    for (const piece of pieces) {
      this.add(typeof piece === 'string' ? piece : piece.type, piece.rotation || 0);
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

    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(WIDTH, 0.08, 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    startLine.position.copy(this.spawn);
    startLine.position.y += 0.28;
    this.group.add(startLine);
  }

  getSpawn() {
    return { position: this.spawn.clone(), yaw: this.p[0]?.yaw || 0 };
  }
}
