import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export class Vehicle {
  constructor(scene, appearance) {
    this.scene = scene;
    this.appearance = appearance;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.speed = 0;
    this.yaw = 0;
    this.build();
  }

  build() {
    this.group.clear();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.appearance.bodyColor,
      roughness: 0.45
    });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: this.appearance.accentColor });
    const wheelColor = this.appearance.wheelStyle === 'dark' ? 0x111317 :
      this.appearance.wheelStyle === 'classic' ? 0x9ca4ad : 0x252a30;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        this.appearance.bodyStyle === 'wide' ? 3.2 : 2.7,
        0.85,
        this.appearance.bodyStyle === 'arrow' ? 4.2 : 4.5
      ),
      bodyMaterial
    );
    body.position.y = 0.8;
    body.castShadow = true;
    this.group.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.4), accentMaterial);
    nose.position.set(0, 1.15, 1.3);
    this.group.add(nose);

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: wheelColor });
    for (const x of [-1.35, 1.35]) {
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.42, z);
        wheel.castShadow = true;
        this.group.add(wheel);
      }
    }
  }

  setAppearance(appearance) {
    this.appearance = { ...this.appearance, ...appearance };
    this.build();
  }

  reset(position, yaw) {
    this.pos.copy(position);
    this.pos.y += 0.8;
    this.yaw = yaw;
    this.speed = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = yaw;
  }

  update(dt, controls) {
    const throttle = controls.throttle ? 1 : 0;
    const brake = controls.brake ? 1 : 0;
    const steering = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    this.speed += ((throttle ? 34 : 0) - (brake ? 45 : 0)) * dt;
    this.speed -= this.speed * (throttle ? 0.45 : 1.2) * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, 0, 72);
    this.yaw += steering * Math.min(1, this.speed / 20) * 1.7 * dt;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.pos.addScaledVector(forward, this.speed * dt);
    this.pos.y += (1.8 - this.pos.y) * Math.min(1, dt * 8);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }
}
