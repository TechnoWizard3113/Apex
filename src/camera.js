import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function dampVector(current, target, velocity, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current.clone().sub(target);
  const temporary = velocity.clone().addScaledVector(change, omega).multiplyScalar(dt);
  velocity.sub(temporary.clone().multiplyScalar(omega)).multiplyScalar(decay);
  return target.clone().add(change.add(temporary).multiplyScalar(decay));
}

export class Cam {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.target = new THREE.Vector3();
    this.positionVelocity = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.initialized = false;
  }

  reset(vehicle, track) {
    this.positionVelocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
    this.position.copy(this.getPosition(vehicle));
    this.target.copy(this.getTarget(vehicle));
    if (track) {
      const ground = track.getTerrainHeight(this.position.x, this.position.z) + 2;
      this.position.y = Math.max(this.position.y, ground);
    }
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    this.initialized = true;
  }

  getPosition(vehicle) {
    const speed = Math.abs(vehicle.speed);
    const distance = +this.settings.cameraDistance + Math.min(speed * 0.16, 10);
    const height = +this.settings.cameraHeight + Math.min(speed * 0.025, 1.5);
    const forward = new THREE.Vector3(-Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw));
    const position = vehicle.pos.clone().addScaledVector(forward, -distance);
    position.y += height - distance * Math.sin(vehicle.pitch || 0) * 0.22;
    return position;
  }

  getTarget(vehicle) {
    const speed = Math.abs(vehicle.speed);
    const forward = new THREE.Vector3(-Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw));
    const lookAhead = 6 + Math.min(speed * 0.2, 12);
    const target = vehicle.pos.clone().addScaledVector(forward, lookAhead);
    target.y += 1.2 + Math.sin(vehicle.pitch || 0) * lookAhead * 0.15;
    return target;
  }

  update(vehicle, dt, track) {
    const safeDt = Math.min(dt, 0.05);
    const desiredPosition = this.getPosition(vehicle);
    const desiredTarget = this.getTarget(vehicle);
    if (!this.initialized) {
      this.reset(vehicle, track);
      return;
    }

    if (track) {
      const ground = track.getTerrainHeight(desiredPosition.x, desiredPosition.z) + 2;
      desiredPosition.y = Math.max(desiredPosition.y, ground);
    }
    this.position.copy(dampVector(
      this.position,
      desiredPosition,
      this.positionVelocity,
      0.22,
      safeDt
    ));
    if (track) {
      const ground = track.getTerrainHeight(this.position.x, this.position.z) + 1.5;
      this.position.y = Math.max(this.position.y, ground);
    }
    this.target.copy(dampVector(
      this.target,
      desiredTarget,
      this.targetVelocity,
      0.12,
      safeDt
    ));
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
  }
}
