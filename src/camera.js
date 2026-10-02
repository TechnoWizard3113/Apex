import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export class Cam {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.target = new THREE.Vector3();
  }

  update(vehicle, dt) {
    const distance = +this.settings.cameraDistance;
    const height = +this.settings.cameraHeight;
    const forward = new THREE.Vector3(-Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw));
    const position = vehicle.pos.clone().addScaledVector(forward, -distance);
    position.y += height;
    this.camera.position.lerp(position, 1 - Math.pow(0.001, dt));
    this.target.copy(vehicle.pos).addScaledVector(forward, 8);
    this.target.y += 1.2;
    this.camera.lookAt(this.target);
  }
}
