import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class Vehicle {
    constructor(scene, track) {
        this.track = track;

        this.group = new THREE.Group();
        scene.add(this.group);

        this.velocity = new THREE.Vector3();
        this.forwardSpeed = 0;
        this.steering = 0;

        this.maxSpeed = 62;
        this.reverseSpeed = 14;
        this.acceleration = 34;
        this.brakeStrength = 48;
        this.drag = 2.2;
        this.grip = 9;
        this.airControl = 2;
        this.gravity = 30;

        this.grounded = true;
        this.verticalVelocity = 0;

        this.spawnPosition = new THREE.Vector3();
        this.spawnRotation = 0;

        this.buildModel();
        this.reset();
    }

    buildModel() {
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xc83a3a,
            roughness: 0.55,
            metalness: 0.1
        });

        const darkMaterial = new THREE.MeshStandardMaterial({
            color: 0x171a1e,
            roughness: 0.35,
            metalness: 0.25
        });

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 0.65, 4.4),
            bodyMaterial
        );

        body.position.y = 0.75;
        body.castShadow = true;
        this.group.add(body);

        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(2.05, 0.65, 1.9),
            darkMaterial
        );

        cabin.position.set(0, 1.25, -0.15);
        cabin.castShadow = true;
        this.group.add(cabin);

        const wheelGeometry = new THREE.CylinderGeometry(
            0.48,
            0.48,
            0.38,
            12
        );

        const wheelPositions = [
            [-1.35, 0.48, 1.35],
            [1.35, 0.48, 1.35],
            [-1.35, 0.48, -1.35],
            [1.35, 0.48, -1.35]
        ];

        for (const [x, y, z] of wheelPositions) {
            const wheel = new THREE.Mesh(
                wheelGeometry,
                darkMaterial
            );

            wheel.position.set(x, y, z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;

            this.group.add(wheel);
        }
    }

    reset() {
        const spawn = this.track.getSpawn();

        this.spawnPosition.copy(spawn.position);
        this.spawnRotation = spawn.direction;

        this.group.position.copy(this.spawnPosition);
        this.group.rotation.y = this.spawnRotation;

        this.velocity.set(0, 0, 0);
        this.forwardSpeed = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
    }

    update(delta, controls) {
        const forward = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(this.group.quaternion);

        const right = new THREE.Vector3(1, 0, 0)
            .applyQuaternion(this.group.quaternion);

        const currentPiece =
            this.track.getPieceAt(this.group.position);

        const groundHeight =
            this.track.getHeightAt(this.group.position);

        if (groundHeight !== null) {
            const targetHeight = groundHeight + 0.48;

            if (
                this.group.position.y <= targetHeight + 0.7 &&
                this.verticalVelocity <= 0
            ) {
                this.group.position.y = targetHeight;
                this.verticalVelocity = 0;
                this.grounded = true;
            } else {
                this.grounded = false;
            }
        } else {
            this.grounded = false;
        }

        const throttle =
            controls.forward ? 1 : 0;

        const brake =
            controls.backward ? 1 : 0;

        const steerInput =
            (controls.left ? 1 : 0) -
            (controls.right ? 1 : 0);

        if (this.grounded) {
            if (throttle) {
                this.forwardSpeed +=
                    this.acceleration * delta;
            }

            if (brake) {
                if (this.forwardSpeed > 0) {
                    this.forwardSpeed -=
                        this.brakeStrength * delta;
                } else {
                    this.forwardSpeed -=
                        this.acceleration * 0.55 * delta;
                }
            }

            if (!throttle && !brake) {
                const deceleration =
                    this.drag * delta;

                if (this.forwardSpeed > 0) {
                    this.forwardSpeed = Math.max(
                        0,
                        this.forwardSpeed - deceleration
                    );
                } else {
                    this.forwardSpeed = Math.min(
                        0,
                        this.forwardSpeed + deceleration
                    );
                }
            }

            this.forwardSpeed = THREE.MathUtils.clamp(
                this.forwardSpeed,
                -this.reverseSpeed,
                this.maxSpeed
            );

            const speedFactor = Math.min(
                Math.abs(this.forwardSpeed) / 25,
                1
            );

            const steeringStrength =
                1.65 * speedFactor;

            this.steering = THREE.MathUtils.lerp(
                this.steering,
                steerInput,
                8 * delta
            );

            this.group.rotation.y +=
                this.steering *
                steeringStrength *
                delta *
                Math.sign(
                    this.forwardSpeed || 1
                );

            const lateralVelocity =
                this.velocity.dot(right);

            this.velocity.addScaledVector(
                right,
                -lateralVelocity * this.grip * delta
            );
        } else {
            this.group.rotation.y +=
                steerInput *
                this.airControl *
                delta;
        }

        const velocityDirection = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(this.group.quaternion);

        this.velocity.copy(
            velocityDirection.multiplyScalar(this.forwardSpeed)
        );

        if (!this.grounded) {
            this.verticalVelocity -=
                this.gravity * delta;

            this.group.position.y +=
                this.verticalVelocity * delta;
        }

        this.group.position.addScaledVector(
            this.velocity,
            delta
        );

        if (
            this.group.position.y < -25
        ) {
            this.reset();
        }

        if (currentPiece?.type === "boost") {
            this.forwardSpeed = Math.min(
                this.forwardSpeed + 18 * delta,
                this.maxSpeed
            );
        }
    }

    getSpeedKmh() {
        return Math.round(
            Math.abs(this.forwardSpeed) * 3.6
        );
    }
}