import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class FollowCamera {
    constructor(camera, vehicle) {
        this.camera = camera;
        this.vehicle = vehicle;

        this.position = new THREE.Vector3();
        this.target = new THREE.Vector3();
    }

    update(delta) {
        const vehicleGroup =
            this.vehicle.getGroup();

        const speed =
            this.vehicle.getSpeed();

        const forward =
            new THREE.Vector3(
                0,
                0,
                -1
            ).applyQuaternion(
                vehicleGroup.quaternion
            );

        const distance =
            THREE.MathUtils.lerp(
                8,
                12,
                Math.min(speed / 55, 1)
            );

        const height =
            THREE.MathUtils.lerp(
                4.5,
                6.5,
                Math.min(speed / 55, 1)
            );

        const offset =
            new THREE.Vector3(
                0,
                height,
                distance
            );

        offset.applyQuaternion(
            vehicleGroup.quaternion
        );

        const desired =
            vehicleGroup.position
                .clone()
                .add(offset);

        const smoothing =
            1 -
            Math.pow(
                0.0001,
                delta
            );

        this.position.lerp(
            desired,
            smoothing
        );

        this.camera.position.copy(
            this.position
        );

        this.target.copy(
            vehicleGroup.position
        );

        this.target.y += 1;

        this.target.addScaledVector(
            forward,
            Math.min(speed * 0.15, 7)
        );

        this.camera.lookAt(
            this.target
        );

        const targetFov =
            THREE.MathUtils.lerp(
                68,
                82,
                Math.min(speed / 55, 1)
            );

        this.camera.fov +=
            (targetFov - this.camera.fov) *
            Math.min(delta * 4, 1);

        this.camera.updateProjectionMatrix();
    }
}