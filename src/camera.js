import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class FollowCamera {
    constructor(camera) {
        this.camera = camera;

        this.lookTarget =
            new THREE.Vector3();

        this.initialized = false;
    }

    update(
        vehicle,
        delta
    ) {
        if (!vehicle) {
            return;
        }

        const forward =
            new THREE.Vector3(
                Math.sin(vehicle.yaw),
                0,
                Math.cos(vehicle.yaw)
            );

        const speed =
            Math.abs(
                vehicle.speed
            );

        const distance =
            15 +
            Math.min(
                speed * 0.1,
                9
            );

        const desired =
            vehicle.position.clone()
                .addScaledVector(
                    forward,
                    -distance
                );

        desired.y +=
            6.5 +
            Math.min(
                speed * 0.035,
                4
            );

        const smoothing =
            1 -
            Math.pow(
                0.0001,
                delta
            );

        if (
            !this.initialized
        ) {
            this.camera.position.copy(
                desired
            );

            this.lookTarget.copy(
                vehicle.position
            );

            this.initialized = true;
        } else {
            this.camera.position.lerp(
                desired,
                smoothing
            );

            const target =
                vehicle.position.clone();

            target.y += 1.4;

            this.lookTarget.lerp(
                target,
                smoothing
            );
        }

        const minimumHeight =
            vehicle.position.y + 2.5;

        if (
            this.camera.position.y <
            minimumHeight
        ) {
            this.camera.position.y =
                minimumHeight;
        }

        this.camera.lookAt(
            this.lookTarget
        );

        const targetFov =
            68 +
            Math.min(
                speed * 0.09,
                12
            );

        this.camera.fov =
            THREE.MathUtils.lerp(
                this.camera.fov,
                targetFov,
                1 -
                Math.pow(
                    0.001,
                    delta
                )
            );

        this.camera.updateProjectionMatrix();
    }

    reset() {
        this.initialized = false;
    }
}