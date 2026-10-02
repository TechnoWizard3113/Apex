import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class Vehicle {
    constructor(scene) {
        this.scene = scene;

        this.group =
            new THREE.Group();

        this.position =
            new THREE.Vector3(
                0,
                2,
                0
            );

        this.velocity =
            new THREE.Vector3();

        this.yaw = 0;

        this.speed = 0;

        this.steering = 0;

        this.maxSpeed = 72;
        this.acceleration = 38;
        this.brakePower = 62;
        this.reverseAcceleration = 22;
        this.drag = 2.2;
        this.grip = 7.5;
        this.gravity = 32;

        this.grounded = true;
        this.boostTimer = 0;

        this.buildVehicle();

        scene.add(
            this.group
        );
    }

    buildVehicle() {
        const bodyMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xd52f35,
                roughness: 0.55,
                metalness: 0.15
            });

        const darkMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x15171a,
                roughness: 0.65
            });

        const glassMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x182936,
                roughness: 0.2,
                metalness: 0.25
            });

        const body =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    3.2,
                    0.9,
                    5.5
                ),
                bodyMaterial
            );

        body.position.y = 1.05;
        body.castShadow = true;

        this.group.add(body);

        const cabin =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    2.5,
                    0.75,
                    2.4
                ),
                glassMaterial
            );

        cabin.position.set(
            0,
            1.72,
            -0.25
        );

        cabin.castShadow = true;

        this.group.add(cabin);

        const wheelGeometry =
            new THREE.CylinderGeometry(
                0.65,
                0.65,
                0.5,
                12
            );

        const wheelPositions = [
            [-1.55, 0.65, 1.8],
            [1.55, 0.65, 1.8],
            [-1.55, 0.65, -1.8],
            [1.55, 0.65, -1.8]
        ];

        for (
            const [x, y, z]
            of wheelPositions
        ) {
            const wheel =
                new THREE.Mesh(
                    wheelGeometry,
                    darkMaterial
                );

            wheel.rotation.z =
                Math.PI / 2;

            wheel.position.set(
                x,
                y,
                z
            );

            wheel.castShadow = true;

            this.group.add(wheel);
        }
    }

    reset(position, yaw) {
        this.position.copy(position);

        this.velocity.set(
            0,
            0,
            0
        );

        this.speed = 0;
        this.yaw = yaw;
        this.steering = 0;
        this.grounded = true;
        this.boostTimer = 0;

        this.group.position.copy(
            this.position
        );

        this.group.rotation.set(
            0,
            this.yaw,
            0
        );
    }

    update(
        delta,
        controls,
        track
    ) {
        const forward =
            new THREE.Vector3(
                Math.sin(this.yaw),
                0,
                Math.cos(this.yaw)
            );

        const right =
            new THREE.Vector3(
                Math.cos(this.yaw),
                0,
                -Math.sin(this.yaw)
            );

        const forwardSpeed =
            this.velocity.dot(
                forward
            );

        const lateralSpeed =
            this.velocity.dot(
                right
            );

        const surface =
            track.getSurfaceInfo(
                this.position
            );

        if (
            surface.boost &&
            this.grounded
        ) {
            this.boostTimer = 0.35;
        }

        if (
            this.boostTimer > 0
        ) {
            this.boostTimer -= delta;

            this.velocity.addScaledVector(
                forward,
                32 * delta
            );
        }

        if (
            controls.throttle
        ) {
            if (
                forwardSpeed < 0
            ) {
                this.velocity.addScaledVector(
                    forward,
                    this.brakePower *
                    delta
                );
            } else {
                this.velocity.addScaledVector(
                    forward,
                    this.acceleration *
                    delta
                );
            }
        }

        if (
            controls.brake
        ) {
            if (
                forwardSpeed > 1
            ) {
                this.velocity.addScaledVector(
                    forward,
                    -this.brakePower *
                    delta
                );
            } else {
                this.velocity.addScaledVector(
                    forward,
                    -this.reverseAcceleration *
                    delta
                );
            }
        }

        if (
            !controls.throttle &&
            !controls.brake
        ) {
            const drag =
                Math.min(
                    Math.abs(
                        forwardSpeed
                    ),
                    this.drag *
                    7 *
                    delta
                );

            this.velocity.addScaledVector(
                forward,
                -Math.sign(
                    forwardSpeed
                ) *
                drag
            );
        }

        const steeringTarget =
            (
                controls.right
                    ? 1
                    : 0
            ) -
            (
                controls.left
                    ? 1
                    : 0
            );

        this.steering =
            THREE.MathUtils.lerp(
                this.steering,
                steeringTarget,
                Math.min(
                    delta * 9,
                    1
                )
            );

        const steeringFactor =
            THREE.MathUtils.clamp(
                Math.abs(
                    forwardSpeed
                ) / 12,
                0,
                1
            );

        const direction =
            forwardSpeed >= 0
                ? 1
                : -1;

        this.yaw +=
            this.steering *
            steeringFactor *
            2.35 *
            delta *
            direction;

        const grip =
            this.grounded
                ? this.grip
                : this.grip * 0.18;

        this.velocity.addScaledVector(
            right,
            -lateralSpeed *
            Math.min(
                grip * delta,
                1
            )
        );

        if (!this.grounded) {
            this.velocity.y -=
                this.gravity *
                delta;
        }

        const horizontal =
            new THREE.Vector3(
                this.velocity.x,
                0,
                this.velocity.z
            );

        const horizontalSpeed =
            horizontal.length();

        const currentMax =
            this.boostTimer > 0
                ? 105
                : this.maxSpeed;

        if (
            horizontalSpeed >
            currentMax
        ) {
            horizontal
                .normalize()
                .multiplyScalar(
                    currentMax
                );

            this.velocity.x =
                horizontal.x;

            this.velocity.z =
                horizontal.z;
        }

        this.position.addScaledVector(
            this.velocity,
            delta
        );

        this.applySurface(
            track,
            surface
        );

        this.speed =
            new THREE.Vector3(
                this.velocity.x,
                0,
                this.velocity.z
            ).length();

        this.group.position.copy(
            this.position
        );

        this.group.rotation.order =
            "YXZ";

        this.group.rotation.y =
            this.yaw;

        const visualSpeed =
            THREE.MathUtils.clamp(
                this.speed /
                this.maxSpeed,
                0,
                1
            );

        this.group.rotation.z =
            -this.steering *
            visualSpeed *
            0.08;

        if (
            this.grounded
        ) {
            this.group.rotation.x =
                -surface.pitch;
        }
    }

    applySurface(
        track,
        previousSurface
    ) {
        const surface =
            track.getSurfaceInfo(
                this.position
            );

        const groundHeight =
            surface.height + 1.2;

        if (
            this.position.y <=
            groundHeight + 0.35
        ) {
            this.position.y =
                groundHeight;

            if (
                this.velocity.y < 0
            ) {
                this.velocity.y = 0;
            }

            this.grounded = true;
        } else {
            this.grounded = false;
        }

        if (
            previousSurface &&
            previousSurface.height <
            surface.height - 4
        ) {
            this.grounded = false;
        }

        if (
            this.position.y <
            -40
        ) {
            const spawn =
                track.getSpawn();

            this.reset(
                spawn.position,
                spawn.yaw
            );
        }
    }
}