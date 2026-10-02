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
    this.group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(item => item.dispose());
      else object.material.dispose();
    });
    this.group.clear();

    const style = this.appearance.bodyStyle;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.appearance.bodyColor,
      roughness: 0.4,
      metalness: 0.12
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: this.appearance.accentColor,
      roughness: 0.3,
      metalness: 0.08
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x183344,
      roughness: 0.18,
      metalness: 0.25
    });
    const wheelColor = this.appearance.wheelStyle === 'dark' ? 0x111317 :
      this.appearance.wheelStyle === 'classic' ? 0xb7bec3 : 0x252a30;
    const dimensions = style === 'wide' ? { width: 3.35, height: 0.72, length: 4.8 } :
      style === 'arrow' ? { width: 2.35, height: 0.68, length: 5.2 } :
        { width: 2.7, height: 0.82, length: 4.5 };

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.length),
      bodyMaterial
    );
    body.position.y = 0.82;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.width * 0.82, 0.18, style === 'arrow' ? 2.25 : 1.8),
      accentMaterial
    );
    hood.position.set(0, 1.25, dimensions.length * 0.25);
    hood.castShadow = true;
    this.group.add(hood);

    const cabinWidth = style === 'wide' ? 2.15 : style === 'arrow' ? 1.55 : 1.8;
    const cabinLength = style === 'arrow' ? 1.75 : 1.55;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(cabinWidth, 0.68, cabinLength),
      glassMaterial
    );
    cabin.position.set(0, 1.48, -0.25);
    cabin.castShadow = true;
    this.group.add(cabin);

    if (style !== 'apex') {
      const spoiler = new THREE.Mesh(
        new THREE.BoxGeometry(style === 'wide' ? 3.1 : 2.3, 0.14, 0.45),
        accentMaterial
      );
      spoiler.position.set(0, 1.23, -dimensions.length * 0.48);
      this.group.add(spoiler);
      for (const x of [-0.85, 0.85]) {
        const support = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), accentMaterial);
        support.position.set(x, 1.08, -dimensions.length * 0.43);
        this.group.add(support);
      }
    }

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.85 });
    const wheelX = dimensions.width / 2 - 0.12;
    const wheelRadius = this.appearance.wheelStyle === 'classic' ? 0.45 : 0.4;
    for (const x of [-wheelX, wheelX]) {
      for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.3, 20),
          wheelMaterial
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, wheelRadius, z);
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
    this.pos.y += 0.16;
    this.yaw = yaw;
    this.speed = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = -yaw;
  }

  update(dt, controls, track) {
    const throttle = controls.throttle ? 1 : 0;
    const brake = controls.brake ? 1 : 0;
    const steering = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    this.speed += ((throttle ? 34 : 0) - (brake ? 45 : 0)) * dt;
    this.speed -= this.speed * (throttle ? 0.45 : 1.2) * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, 0, 72);
    this.yaw += steering * Math.min(1, this.speed / 20) * 2.8 * dt;

    const direction = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.pos.addScaledVector(direction, this.speed * dt);
    const surface = track.constrainVehicle(this.pos);
    if (surface.onTrack) {
      if (surface.hitBarrier) this.speed *= 0.58;
      this.pos.y += (surface.y - this.pos.y) * Math.min(1, dt * 18);
    } else {
      this.pos.y = Math.max(-30, this.pos.y - 15 * dt);
      this.speed *= Math.max(0, 1 - dt * 0.7);
      if (this.pos.y <= -29) this.reset(track.getSpawn().position, track.getSpawn().yaw);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = -this.yaw;
  }
}
