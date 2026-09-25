import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class FollowCamera {
    constructor(camera) {
        this.camera = camera;

        this.positionOffset = new THREE.Vector3(
            0,
            7,
            -13
        );

        this.lookOffset = new THREE.Vector3(
            0,
            1.2,
            8
        );

        this.currentPosition =
            new THREE.Vector3();

        this.targetPosition =
            new THREE.Vector3();

        this.targetLook =
            new THREE.Vector3();
    }

    update(vehicle, delta) {
        const speed =
            Math.abs(vehicle.forwardSpeed);

        const speedFactor =
            THREE.MathUtils.clamp(
                speed / 60,
                0,
                1
            );

        const desiredOffset =
            this.positionOffset.clone();

        desiredOffset.z -=
            speedFactor * 4;

        desiredOffset.y +=
            speedFactor * 2;

        desiredOffset.applyQuaternion(
            vehicle.group.quaternion
        );

        this.targetPosition.copy(
            vehicle.group.position
        ).add(desiredOffset);

        const smoothing =
            1 - Math.exp(-6 * delta);

        this.currentPosition.lerp(
            this.targetPosition,
            smoothing
        );

        this.camera.position.copy(
            this.currentPosition
        );

        this.targetLook.copy(
            vehicle.group.position
        );

        this.lookOffset.applyQuaternion(
            vehicle.group.quaternion
        );

        this.targetLook.add(
            this.lookOffset
        );

        this.camera.lookAt(
            this.targetLook
        );

        this.camera.fov =
            THREE.MathUtils.lerp(
                68,
                78,
                speedFactor
            );

        this.camera.updateProjectionMatrix();
    }
}