import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WHEELBASE = 2.9;
const MAX_STEERING_ANGLE = 0.54;

export class Vehicle {
  constructor(scene, appearance) {
    this.scene = scene;
    this.appearance = appearance;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.speed = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.steering = 0;
    this.wheels = [];
    this.skidTimer = 0;
    this.skidPrevious = [null, null];
    this.skidSegments = [0, 0];
    this.skidGeometries = [];
    this.maxSkidSegments = 1200;
    for (let side = 0; side < 2; side++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(this.maxSkidSegments * 18);
      const attribute = new THREE.BufferAttribute(positions, 3);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', attribute);
      const mark = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x25282b,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      );
      mark.frustumCulled = false;
      this.scene.add(mark);
      this.skidGeometries.push({ geometry, attribute, mark });
    }
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
      color: 0x31546a,
      roughness: 0.18,
      metalness: 0.25,
      side: THREE.DoubleSide
    });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: 0.65 });
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9f4ff,
      emissive: 0xa8d8ff,
      emissiveIntensity: 0.7,
      roughness: 0.25
    });
    const tailLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe52e35,
      emissive: 0x8f1018,
      emissiveIntensity: 0.8
    });
    this.tailLightMaterial = tailLightMaterial;
    const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, metalness: 0.65, roughness: 0.35 });
    const wheelColor = this.appearance.wheelStyle === 'dark' ? 0x111317 :
      this.appearance.wheelStyle === 'classic' ? 0xb7bec3 : 0x252a30;
    const dimensions = { width: 2.7, height: 0.82, length: 4.5 };

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.length),
      bodyMaterial
    );
    body.position.y = 0.82;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.width * 0.82, 0.18, 1.8),
      bodyMaterial
    );
    hood.position.set(0, 1.25, dimensions.length * 0.25);
    hood.castShadow = true;
    this.group.add(hood);
    for (const x of [-0.32, 0.32]) {
      const hoodStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.025, 1.05),
        accentMaterial
      );
      hoodStripe.position.set(x, 1.35, dimensions.length * 0.27);
      this.group.add(hoodStripe);
    }

    const cabinWidth = 1.8;
    const cabinLength = 1.55;
    const cabinCenterZ = -0.25;
    const cabinVertices = [
      -cabinWidth / 2, 1.12, cabinCenterZ + cabinLength / 2,
      cabinWidth / 2, 1.12, cabinCenterZ + cabinLength / 2,
      cabinWidth / 2, 1.12, cabinCenterZ - cabinLength / 2,
      -cabinWidth / 2, 1.12, cabinCenterZ - cabinLength / 2,
      -cabinWidth * 0.42, 1.78, cabinCenterZ + cabinLength * 0.31,
      cabinWidth * 0.42, 1.78, cabinCenterZ + cabinLength * 0.31,
      cabinWidth * 0.42, 1.78, cabinCenterZ - cabinLength * 0.31,
      -cabinWidth * 0.42, 1.78, cabinCenterZ - cabinLength * 0.31
    ];
    const cabinGeometry = new THREE.BufferGeometry();
    cabinGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cabinVertices, 3));
    cabinGeometry.setIndex([
      0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7, 1, 2, 6, 1, 6, 5,
      4, 5, 6, 4, 6, 7, 0, 3, 2, 0, 2, 1
    ]);
    cabinGeometry.computeVertexNormals();
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.castShadow = true;
    this.group.add(cabin);

    const addDetail = (geometry, material, position) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      this.group.add(mesh);
    };
    const addPanel = (vertices, material) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      const panel = new THREE.Mesh(geometry, material);
      panel.castShadow = true;
      this.group.add(panel);
    };
    const engineStyle = this.appearance.engineStyle || 'v8';
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x30383e,
      roughness: 0.38,
      metalness: 0.48
    });
    const engineMetal = new THREE.MeshStandardMaterial({
      color: 0x9aa7ae,
      roughness: 0.3,
      metalness: 0.72
    });
    if (engineStyle === 'supercharged') {
      addDetail(new THREE.BoxGeometry(0.88, 0.13, 0.76), engineMaterial, [0, 1.4, 0.46]);
      addDetail(new THREE.BoxGeometry(0.5, 0.22, 0.5), engineMetal, [0, 1.56, 0.48]);
      addDetail(new THREE.BoxGeometry(0.64, 0.08, 0.18), trimMaterial, [0, 1.71, 0.48]);
      for (const x of [-0.34, 0.34]) {
        addDetail(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 12), engineMetal,
          [x, 1.49, 0.46]);
      }
    } else if (engineStyle === 'v8') {
      addDetail(new THREE.BoxGeometry(0.82, 0.12, 0.68), engineMaterial, [0, 1.4, 0.46]);
      addDetail(new THREE.BoxGeometry(0.58, 0.11, 0.38), engineMetal, [0, 1.52, 0.46]);
      for (const side of [-1, 1]) {
        addDetail(new THREE.BoxGeometry(0.16, 0.1, 0.48), engineMetal,
          [side * 0.4, 1.46, 0.46]);
      }
    } else {
      addDetail(new THREE.BoxGeometry(0.68, 0.09, 0.55), engineMaterial, [0, 1.38, 0.46]);
      for (const x of [-0.2, 0, 0.2]) {
        addDetail(new THREE.BoxGeometry(0.07, 0.12, 0.36), engineMetal,
          [x, 1.48, 0.46]);
      }
    }

    const exhaustStyle = this.appearance.exhaustStyle || 'dual';
    const exhaustMetal = new THREE.MeshStandardMaterial({
      color: 0x89949a,
      roughness: 0.3,
      metalness: 0.8
    });
    const exhaustOpening = new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 0.9 });
    const exhaustPositions = exhaustStyle === 'single' ? [0] :
      exhaustStyle === 'side' ? [
        -(dimensions.width / 2 - 0.05),
        dimensions.width / 2 - 0.05
      ] : [-0.48, 0.48];
    for (const x of exhaustPositions) {
      const sidePipe = exhaustStyle === 'side';
      const length = sidePipe ? 0.82 : 0.3;
      const z = sidePipe ? -0.18 : -dimensions.length / 2 + length / 2 + 0.05;
      const radius = sidePipe ? 0.05 : 0.085;
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.82, length, 12),
        exhaustMetal
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, sidePipe ? 0.4 : 0.51, z);
      pipe.castShadow = true;
      this.group.add(pipe);
      const opening = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, 0.012, 12),
        exhaustOpening
      );
      opening.rotation.x = Math.PI / 2;
      opening.position.set(x, pipe.position.y, z - length / 2 - 0.008);
      this.group.add(opening);
    }
    const frontZ = cabinCenterZ + cabinLength / 2 + 0.012;
    const rearZ = cabinCenterZ - cabinLength / 2 - 0.012;
    const windowHalf = cabinWidth * 0.34;
    addPanel([
      -windowHalf, 1.3, frontZ,
      windowHalf, 1.3, frontZ,
      windowHalf * 0.88, 1.73, cabinCenterZ + cabinLength * 0.32,
      -windowHalf * 0.88, 1.73, cabinCenterZ + cabinLength * 0.32
    ], glassMaterial);
    addPanel([
      -windowHalf, 1.3, rearZ,
      windowHalf, 1.3, rearZ,
      windowHalf * 0.84, 1.73, cabinCenterZ - cabinLength * 0.32,
      -windowHalf * 0.84, 1.73, cabinCenterZ - cabinLength * 0.32
    ], glassMaterial);
    for (const side of [-1, 1]) {
      const windowX = side * (cabinWidth / 2 + 0.012);
      const roofX = side * (cabinWidth * 0.42 + 0.012);
      addPanel([
        windowX, 1.3, cabinCenterZ + cabinLength * 0.41,
        windowX, 1.3, cabinCenterZ - cabinLength * 0.41,
        roofX, 1.72, cabinCenterZ - cabinLength * 0.29,
        roofX, 1.72, cabinCenterZ + cabinLength * 0.29
      ], glassMaterial);
      addDetail(new THREE.BoxGeometry(0.07, 0.48, 0.1), accentMaterial,
        [side * (cabinWidth * 0.45 + 0.02), 1.51, cabinCenterZ + 0.12]);
      addDetail(new THREE.BoxGeometry(0.08, 0.08, 0.48), trimMaterial,
        [side * (dimensions.width / 2 + 0.025), 0.83, -0.08]);
      addDetail(new THREE.BoxGeometry(0.08, 0.045, 0.32), accentMaterial,
        [side * (dimensions.width / 2 + 0.025), 0.9, -0.56]);
    }
    addDetail(new THREE.BoxGeometry(cabinWidth * 0.84, 0.1, cabinLength * 0.62), bodyMaterial,
      [0, 1.82, cabinCenterZ]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.72, 0.13, 0.18), trimMaterial,
      [0, 0.64, dimensions.length * 0.5 - 0.04]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.76, 0.13, 0.18), trimMaterial,
      [0, 0.64, -dimensions.length * 0.5 + 0.04]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.88, 0.2, 0.26), trimMaterial,
      [0, 0.66, dimensions.length * 0.5 + 0.06]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.86, 0.18, 0.25), trimMaterial,
      [0, 0.66, -dimensions.length * 0.5 - 0.06]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.42, 0.12, 0.08), trimMaterial,
      [0, 0.9, dimensions.length * 0.5 + 0.01]);
    addDetail(new THREE.BoxGeometry(dimensions.width * 0.34, 0.24, 0.12), trimMaterial,
      [0, 0.93, dimensions.length * 0.5 + 0.07]);
    for (let i = -2; i <= 2; i++) {
      addDetail(new THREE.BoxGeometry(0.045, 0.16, 0.035), hubMaterial,
        [i * 0.17, 0.93, dimensions.length * 0.5 + 0.145]);
    }
    for (const x of [-0.3, 0.3]) {
      addDetail(new THREE.BoxGeometry(0.12, 0.025, 0.38), trimMaterial,
        [x, 1.36, dimensions.length * 0.2]);
    }
    for (const x of [-dimensions.width * 0.31, dimensions.width * 0.31]) {
      addDetail(new THREE.BoxGeometry(0.42, 0.2, 0.12), headlightMaterial,
        [x, 0.94, dimensions.length * 0.5 + 0.04]);
      addDetail(new THREE.BoxGeometry(0.38, 0.18, 0.12), tailLightMaterial,
        [x, 0.92, -dimensions.length * 0.5 - 0.04]);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.3), accentMaterial);
      mirror.position.set(x * 1.16, 1.42, 0.45);
      mirror.castShadow = true;
      this.group.add(mirror);
    }
    for (const side of [-1, 1]) {
      addDetail(new THREE.BoxGeometry(0.12, 0.2, dimensions.length * 0.56), accentMaterial,
        [side * (dimensions.width / 2 + 0.015), 0.56, -0.05]);
      addDetail(new THREE.BoxGeometry(0.035, 0.015, dimensions.length * 0.34), trimMaterial,
        [side * (dimensions.width / 2 + 0.025), 0.75, -0.1]);
    }

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.85 });
    const spokeMaterial = new THREE.MeshStandardMaterial({ color: 0xc4cbd0, metalness: 0.75, roughness: 0.28 });
    const rotorMaterial = new THREE.MeshStandardMaterial({ color: 0x59636c, metalness: 0.62, roughness: 0.48 });
    const wheelX = dimensions.width / 2 - 0.12;
    const wheelRadius = 0.4;
    const wheelWidth = 0.3;
    this.wheelX = wheelX;
    this.rearWheelZ = -1.45;
    this.tireWidth = wheelWidth;
    this.wheels = [];
    for (const x of [-wheelX, wheelX]) {
      for (const z of [this.rearWheelZ, 1.45]) {
        const side = Math.sign(x);
        const steeringPivot = new THREE.Group();
        steeringPivot.position.set(x, 0, z);
        this.group.add(steeringPivot);
        const spinGroup = new THREE.Group();
        spinGroup.position.y = wheelRadius;
        steeringPivot.add(spinGroup);
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20),
          wheelMaterial
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        spinGroup.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 16), hubMaterial);
        hub.rotation.z = Math.PI / 2;
        hub.castShadow = true;
        spinGroup.add(hub);
        const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 20), rotorMaterial);
        rotor.rotation.z = Math.PI / 2;
        rotor.position.x = side * 0.17;
        spinGroup.add(rotor);
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = spoke * Math.PI / 3;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.25, 0.055), spokeMaterial);
          mesh.rotation.x = angle;
          mesh.position.set(
            side * 0.205,
            Math.cos(angle) * 0.09,
            Math.sin(angle) * 0.09
          );
          mesh.castShadow = true;
          spinGroup.add(mesh);
        }
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(wheelRadius + 0.11, 0.075, 8, 24, Math.PI),
          accentMaterial
        );
        arch.rotation.y = Math.PI / 2;
        arch.position.set(x - side * 0.02, wheelRadius, z);
        arch.castShadow = true;
        this.group.add(arch);
        this.wheels.push({ steeringPivot, spinGroup, front: z > 0, radius: wheelRadius });
      }
    }
  }

  setAppearance(appearance) {
    this.appearance = { ...this.appearance, ...appearance };
    this.build();
  }

  reset(position, yaw) {
    this.clearSkids();
    this.pos.copy(position);
    this.pos.y += 0.16;
    this.yaw = yaw;
    this.speed = 0;
    this.pitch = 0;
    this.steering = 0;
    for (const wheel of this.wheels) {
      wheel.steeringPivot.rotation.y = 0;
      wheel.spinGroup.rotation.x = 0;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, -yaw, 0, 'YXZ');
  }

  update(dt, controls, track) {
    const throttle = controls.throttle;
    const braking = controls.brake;
    this.tailLightMaterial.emissiveIntensity = braking ? 2.2 : 0.8;
    const steeringInput = Number(controls.left) - Number(controls.right);
    const maxSpeed = 300 / 3.6;
    if (braking) {
      this.speed = this.speed > 0.15
        ? Math.max(0, this.speed - 18 * dt)
        : Math.max(-12, this.speed - 7 * dt);
    } else if (throttle) {
      this.speed += 1.8 * dt;
    } else {
      const speed = Math.abs(this.speed);
      const drag = 7 + speed * 0.18;
      this.speed -= Math.sign(this.speed) * Math.min(speed, drag * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -12, maxSpeed);

    const speedFraction = Math.min(1, Math.abs(this.speed) / maxSpeed);
    this.steering += (steeringInput - this.steering) * (1 - Math.exp(-9 * dt));
    const wheelAngle = this.steering * MAX_STEERING_ANGLE * (1 - speedFraction * 0.5);
    const requestedYawRate = -this.speed / WHEELBASE * Math.tan(wheelAngle);
    const grip = braking ? 13 : 16;
    const maximumYawRate = grip / Math.max(Math.abs(this.speed), 1);
    this.yaw += THREE.MathUtils.clamp(requestedYawRate, -maximumYawRate, maximumYawRate) * dt;
    for (const wheel of this.wheels) {
      wheel.steeringPivot.rotation.y = wheel.front ? wheelAngle : 0;
      wheel.spinGroup.rotation.x -= this.speed * dt / wheel.radius;
    }

    const direction = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.pos.addScaledVector(direction, this.speed * dt);
    const surface = track.constrainVehicle(this.pos);
    if (surface.onTrack) {
      this.pos.y = surface.y;
      this.pitch = surface.pitch || 0;
      this.speed -= Math.sin(this.pitch) * 8.2 * dt;
      if (surface.hitStartBarrier &&
          (this.speed < 0 || (!throttle && this.speed < 0.1))) this.speed = 0;
      this.speed = THREE.MathUtils.clamp(this.speed, -12, maxSpeed);
      this.group.rotation.set(
        -this.pitch,
        -this.yaw,
        surface.bank || 0,
        'YXZ'
      );
    } else {
      this.pitch = 0;
      this.pos.y = Math.max(-30, this.pos.y - 15 * dt);
      this.speed *= Math.max(0, 1 - dt * 0.7);
      this.group.rotation.set(0, -this.yaw, 0, 'YXZ');
      if (this.pos.y <= -29) this.reset(track.getSpawn().position, track.getSpawn().yaw);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -12, maxSpeed);
    this.group.position.copy(this.pos);
    this.group.rotation.y = -this.yaw;
    this.group.updateMatrixWorld(true);
    this.updateSkids(dt, controls);
  }

  updateSkids(dt, controls) {
    const drifting = Math.abs(this.speed) > 9 &&
      (controls.brake || ((controls.left || controls.right) && Math.abs(this.speed) > 20));
    if (!drifting) {
      this.skidPrevious = [null, null];
      this.skidTimer = 0;
      return;
    }
    this.skidTimer += dt;
    if (this.skidTimer < 0.045) return;
    this.skidTimer %= 0.045;
    const up = new THREE.Vector3(0, 1, 0);
    for (let side = 0; side < 2; side++) {
      const point = this.group.localToWorld(new THREE.Vector3(
        side === 0 ? -this.wheelX : this.wheelX,
        0.04,
        this.rearWheelZ
      ));
      const previous = this.skidPrevious[side];
      this.skidPrevious[side] = point.clone();
      if (!previous) continue;
      const data = this.skidGeometries[side];
      const segment = this.skidSegments[side] % this.maxSkidSegments;
      const direction = point.clone().sub(previous);
      direction.y = 0;
      if (direction.lengthSq() < 1e-8) continue;
      const halfWidth = this.tireWidth / 2;
      const lateral = new THREE.Vector3()
        .crossVectors(direction.normalize(), up)
        .multiplyScalar(halfWidth);
      const previousLeft = previous.clone().add(lateral);
      const previousRight = previous.clone().sub(lateral);
      const pointLeft = point.clone().add(lateral);
      const pointRight = point.clone().sub(lateral);
      const offset = segment * 18;
      data.attribute.array.set([
        previousLeft.x, previousLeft.y, previousLeft.z,
        previousRight.x, previousRight.y, previousRight.z,
        pointLeft.x, pointLeft.y, pointLeft.z,
        pointLeft.x, pointLeft.y, pointLeft.z,
        previousRight.x, previousRight.y, previousRight.z,
        pointRight.x, pointRight.y, pointRight.z
      ], offset);
      data.attribute.needsUpdate = true;
      this.skidSegments[side] = Math.min(this.skidSegments[side] + 1, this.maxSkidSegments);
      data.geometry.setDrawRange(0, this.skidSegments[side] * 6);
    }
  }

  setSkidsVisible(visible) {
    for (const data of this.skidGeometries) data.mark.visible = visible;
  }

  clearSkids() {
    this.skidPrevious = [null, null];
    this.skidTimer = 0;
    this.skidSegments = [0, 0];
    for (const data of this.skidGeometries) data.geometry.setDrawRange(0, 0);
  }
}
