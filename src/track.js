import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.sections = [];

        this.material = new THREE.MeshStandardMaterial({
            color: 0x3b3b3b,
            roughness: 0.9
        });

        this.sideMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x666666,
                roughness: 1
            });

        this.createTrack();
    }

    createTrack() {
        this.addStraight(
            0,
            0,
            0,
            18,
            70
        );

        this.addRamp(
            0,
            -55,
            18,
            25,
            10
        );

        this.addStraight(
            0,
            -82,
            10,
            18,
            35
        );

        this.addBankedSection(
            0,
            -112,
            0,
            18,
            35
        );

        this.addStraight(
            0,
            -147,
            0,
            18,
            50
        );
    }

    addStraight(
        x,
        z,
        rotation,
        width,
        length
    ) {
        const geometry =
            new THREE.BoxGeometry(
                width,
                0.5,
                length
            );

        const mesh =
            new THREE.Mesh(
                geometry,
                this.material
            );

        mesh.position.set(
            x,
            -0.25,
            z
        );

        mesh.rotation.y =
            rotation;

        mesh.receiveShadow = true;

        this.scene.add(mesh);

        this.sections.push({
            type: "flat",
            x,
            z,
            width,
            length,
            rotation
        });
    }

    addRamp(
        x,
        z,
        width,
        length,
        height
    ) {
        const geometry =
            new THREE.BoxGeometry(
                width,
                0.5,
                length
            );

        const mesh =
            new THREE.Mesh(
                geometry,
                this.material
            );

        mesh.position.set(
            x,
            height / 2 - 0.25,
            z
        );

        mesh.rotation.x =
            Math.atan2(
                height,
                length
            );

        mesh.receiveShadow = true;
        mesh.castShadow = true;

        this.scene.add(mesh);

        this.sections.push({
            type: "ramp",
            x,
            z,
            width,
            length,
            height
        });
    }

    addBankedSection(
        x,
        z,
        rotation,
        width,
        length
    ) {
        const geometry =
            new THREE.BoxGeometry(
                width,
                0.5,
                length
            );

        const mesh =
            new THREE.Mesh(
                geometry,
                this.material
            );

        mesh.position.set(
            x,
            0,
            z
        );

        mesh.rotation.set(
            0,
            rotation,
            -0.35
        );

        mesh.receiveShadow = true;

        this.scene.add(mesh);

        this.sections.push({
            type: "bank",
            x,
            z,
            width,
            length,
            rotation
        });
    }

    getHeightAt(x, z) {
        for (const section of this.sections) {
            const localX =
                x - section.x;

            const localZ =
                z - section.z;

            if (
                Math.abs(localX) >
                section.width / 2
            ) {
                continue;
            }

            if (
                Math.abs(localZ) >
                section.length / 2
            ) {
                continue;
            }

            if (section.type === "flat") {
                return 0;
            }

            if (section.type === "ramp") {
                const normalized =
                    (localZ +
                        section.length / 2) /
                    section.length;

                return (
                    normalized *
                    section.height
                );
            }

            if (section.type === "bank") {
                return (
                    -localX *
                    Math.sin(0.35)
                );
            }
        }

        return -100;
    }
}