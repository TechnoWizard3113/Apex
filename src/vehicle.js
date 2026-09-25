import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class Vehicle {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);

        this.velocity = new THREE.Vector3();
        this.localVelocity = new THREE.Vector3();

        this.speed = 0;
        this.steering = 0;
        this.verticalVelocity = 0;

        this.grounded = true;
        this.airTime = 0;

        this.maxSpeed = 55;
        this.reverseSpeed = 18;
        this.acceleration = 28;
        this.brakeForce = 42;
        this.drag = 4;

        this.grip = 7;
        this.airControl = 2;

        this.gravity = 28;
        this.jumpVelocity = 10;

        this.wheelRadius = 0.42;

        this.spawnPosition = new THREE.Vector3(0, 0, 0);
        this.spawnRotation = 0;

        this.createModel();
        this.reset();
    }

    createModel() {
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xe84c3d,
            roughness: 0.65
        });

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, 0.65, 3.6),
            bodyMaterial
        );

        body.position.y = 0.75;
        body.castShadow = true;

        this.group.add(body);

        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: 0x263746,
            roughness: 0.3,
            metalness: 0.15
        });

        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.6, 1.65),
            cabinMaterial
        );

        cabin.position.set(0, 1.2, -0.15);
        cabin.castShadow = true;

        this.group.add(cabin);

        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x151515,
            roughness: 0.9
        });

        const wheelGeometry = new THREE.CylinderGeometry(
            this.wheelRadius,
            this.wheelRadius,
            0.32,
            16
        );

        this.wheels = [];

        const positions = [
            [-1.05, 1.15],
            [1.05, 1.15],
            [-1.05, -1.15],
            [1.05, -1.15]
        ];

        for (const [x, z] of positions) {
            const wheel = new THREE.Mesh(
                wheelGeometry,
                wheelMaterial
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.43, z);
            wheel.castShadow = true;

            this.group.add(wheel);
            this.wheels.push(wheel);
        }
    }

    update(delta, input, track) {
        this.updateGroundState(track);

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(this.group.quaternion)
            .normalize();

        const right = new THREE.Vector3(1, 0, 0)
            .applyQuaternion(this.group.quaternion)
            .normalize();

        const forwardSpeed = this.velocity.dot(forward);
        const sidewaysSpeed = this.velocity.dot(right);

        if (this.grounded) {
            this.applyAcceleration(
                delta,
                input.throttle,
                input.brake,
                forward
            );

            this.applySteering(
                delta,
                input.steering,
                forwardSpeed
            );

            this.applyGrip(
                delta,
                right,
                sidewaysSpeed
            );

            this.applyGroundDrag(delta);
        } else {
            this.applyAirPhysics(
                delta,
                input.steering
            );
        }

        this.velocity.y +=
            -this.gravity * delta;

        this.group.position.addScaledVector(
            this.velocity,
            delta
        );

        this.updateWheels(delta);

        if (this.group.position.y < -30) {
            this.reset();
        }
    }

    applyAcceleration(
        delta,
        throttle,
        brake,
        forward
    ) {
        const forwardSpeed =
            this.velocity.dot(forward);

        if (throttle) {
            if (forwardSpeed < this.maxSpeed) {
                this.velocity.addScaledVector(
                    forward,
                    this.acceleration * delta
                );
            }
        }

        if (brake) {
            if (forwardSpeed > 0) {
                this.velocity.addScaledVector(
                    forward,
                    -this.brakeForce * delta
                );
            } else if (forwardSpeed > -this.reverseSpeed) {
                this.velocity.addScaledVector(
                    forward,
                    -this.acceleration * 0.5 * delta
                );
            }
        }
    }

    applySteering(
        delta,
        steeringInput,
        forwardSpeed
    ) {
        const speedFactor = Math.min(
            Math.abs(forwardSpeed) / 12,
            1
        );

        const steeringStrength =
            1.9 * speedFactor;

        const targetSteering =
            steeringInput * steeringStrength;

        this.steering +=
            (targetSteering - this.steering) *
            Math.min(delta * 7, 1);

        const direction =
            Math.sign(forwardSpeed || 1);

        this.group.rotation.y -=
            this.steering *
            direction *
            delta;
    }

    applyGrip(
        delta,
        right,
        sidewaysSpeed
    ) {
        const gripForce =
            Math.min(this.grip * delta, 1);

        this.velocity.addScaledVector(
            right,
            -sidewaysSpeed * gripForce
        );
    }

    applyGroundDrag(delta) {
        const horizontalVelocity =
            new THREE.Vector3(
                this.velocity.x,
                0,
                this.velocity.z
            );

        const speed =
            horizontalVelocity.length();

        if (speed <= 0) {
            return;
        }

        const drag =
            Math.min(
                this.drag * delta,
                speed
            );

        horizontalVelocity.multiplyScalar(
            (speed - drag) / speed
        );

        this.velocity.x =
            horizontalVelocity.x;

        this.velocity.z =
            horizontalVelocity.z;
    }

    applyAirPhysics(
        delta,
        steeringInput
    ) {
        this.group.rotation.y -=
            steeringInput *
            this.airControl *
            delta;

        this.airTime += delta;
    }

    updateGroundState(track) {
        const groundHeight =
            track.getHeightAt(
                this.group.position.x,
                this.group.position.z
            );

        const bottom =
            this.group.position.y;

        const distance =
            bottom - groundHeight;

        if (
            distance <= 0.15 &&
            this.velocity.y <= 0
        ) {
            if (!this.grounded) {
                this.land();
            }

            this.grounded = true;
            this.group.position.y =
                groundHeight;

            this.velocity.y = 0;
        } else {
            this.grounded = false;
        }
    }

    land() {
        this.airTime = 0;
    }

    updateWheels(delta) {
        const speed =
            this.velocity.length();

        for (const wheel of this.wheels) {
            wheel.rotation.x -=
                speed *
                delta *
                1.8;
        }
    }

    reset() {
        this.group.position.copy(
            this.spawnPosition
        );

        this.group.rotation.set(
            0,
            this.spawnRotation,
            0
        );

        this.velocity.set(0, 0, 0);
        this.steering = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
        this.airTime = 0;
    }

    getPosition() {
        return this.group.position;
    }

    getSpeed() {
        return this.velocity.length();
    }

    getGroup() {
        return this.group;
    }
}