import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class FollowCamera {
    constructor(camera) {
        this.camera = camera;

        this.position = new THREE.Vector3();
        this.lookTarget = new THREE.Vector3();

        this.initialized = false;
    }

    update(vehicle, delta) {
        if (!vehicle) {
            return;
        }

        const forward = new THREE.Vector3(
            Math.sin(vehicle.yaw),
            0,
            Math.cos(vehicle.yaw)
        );

        const desiredPosition =
            vehicle.position.clone()
                .addScaledVector(forward, -13);

        desiredPosition.y += 7;

        const minimumHeight =
            vehicle.position.y + 2.2;

        if (desiredPosition.y < minimumHeight) {
            desiredPosition.y = minimumHeight;
        }

        if (!this.initialized) {
            this.camera.position.copy(
                desiredPosition
            );

            this.initialized = true;
        }

        const smoothing =
            1 - Math.pow(0.0005, delta);

        this.camera.position.lerp(
            desiredPosition,
            smoothing
        );

        const target =
            vehicle.position.clone();

        target.y += 2.2;

        this.lookTarget.lerp(
            target,
            smoothing
        );

        this.camera.lookAt(
            this.lookTarget
        );

        const speed =
            Math.abs(vehicle.speed || 0);

        this.camera.fov =
            THREE.MathUtils.lerp(
                this.camera.fov,
                65 + Math.min(speed * 0.08, 8),
                1 - Math.pow(0.001, delta)
            );

        this.camera.updateProjectionMatrix();
    }

    reset() {
        this.initialized = false;
    }
}