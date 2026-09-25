import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export const TRACK_WIDTH = 18;
export const STRAIGHT_LENGTH = 30;
export const CURVE_RADIUS = 30;
export const CURVE_ANGLE = Math.PI / 2;
export const RAMP_HEIGHT = 8;
export const BANK_ANGLE = THREE.MathUtils.degToRad(28);

const PIECE_HEIGHT = 1.2;

function createMaterial(color, transparent = false) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.05,
        transparent,
        opacity: transparent ? 0.42 : 1
    });
}

function makeBox(length, width, height, material) {
    const geometry = new THREE.BoxGeometry(width, height, length);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = -height / 2;
    return mesh;
}

function forwardVector(yaw, pitch = 0) {
    return new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
}

function connector(position, yaw, pitch = 0, roll = 0) {
    return {
        position: position.clone(),
        yaw,
        pitch,
        roll
    };
}

function transformPoint(origin, yaw, local) {
    const result = local.clone();
    result.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return origin.clone().add(result);
}

export class TrackPiece {
    constructor(type, startConnector) {
        this.type = type;
        this.start = connector(
            startConnector.position,
            startConnector.yaw,
            startConnector.pitch,
            startConnector.roll
        );

        this.length = STRAIGHT_LENGTH;
        this.width = TRACK_WIDTH;
        this.height = PIECE_HEIGHT;

        this.end = null;
        this.endDirection = null;
        this.mesh = new THREE.Group();

        this.build();
    }

    build() {
        const roadMaterial = createMaterial(0x343941);
        const stripeMaterial = createMaterial(0xd7dbe0);

        if (
            this.type === "straight" ||
            this.type === "boost" ||
            this.type === "ramp" ||
            this.type === "bankLeft" ||
            this.type === "bankRight"
        ) {
            let pitch = this.start.pitch;
            let roll = this.start.roll;

            if (this.type === "ramp") {
                pitch = Math.atan2(RAMP_HEIGHT, STRAIGHT_LENGTH);
            }

            if (this.type === "bankLeft") {
                roll = BANK_ANGLE;
            }

            if (this.type === "bankRight") {
                roll = -BANK_ANGLE;
            }

            const road = makeBox(
                this.length,
                this.width,
                this.height,
                this.type === "boost"
                    ? createMaterial(0x2368d1)
                    : roadMaterial
            );

            road.rotation.y = this.start.yaw;
            road.rotation.x = -pitch;
            road.rotation.z = roll;

            const center = transformPoint(
                this.start.position,
                this.start.yaw,
                new THREE.Vector3(0, 0, this.length / 2)
            );

            center.y += Math.sin(pitch) * this.length / 2;
            road.position.copy(center);
            road.position.y -= Math.cos(pitch) * this.height / 2;

            this.mesh.add(road);

            if (this.type === "boost") {
                for (let i = -1; i <= 1; i++) {
                    const arrowGeometry = new THREE.ConeGeometry(1.2, 4, 4);
                    const arrow = new THREE.Mesh(
                        arrowGeometry,
                        createMaterial(0xffffff)
                    );

                    arrow.rotation.x = Math.PI / 2;
                    arrow.rotation.y = this.start.yaw;

                    const local = new THREE.Vector3(
                        i * 5,
                        0.9,
                        this.length / 2
                    );

                    arrow.position.copy(
                        transformPoint(
                            this.start.position,
                            this.start.yaw,
                            local
                        )
                    );

                    arrow.position.y += Math.sin(pitch) * this.length / 2;
                    this.mesh.add(arrow);
                }
            }

            const stripeGeometry = new THREE.BoxGeometry(
                0.5,
                0.12,
                this.length - 4
            );

            const stripe = new THREE.Mesh(
                stripeGeometry,
                stripeMaterial
            );

            stripe.rotation.y = this.start.yaw;
            stripe.rotation.x = -pitch;
            stripe.rotation.z = roll;

            stripe.position.copy(
                transformPoint(
                    this.start.position,
                    this.start.yaw,
                    new THREE.Vector3(0, 0.68, this.length / 2)
                )
            );

            stripe.position.y += Math.sin(pitch) * this.length / 2;

            this.mesh.add(stripe);

            const endPosition = transformPoint(
                this.start.position,
                this.start.yaw,
                new THREE.Vector3(0, 0, this.length)
            );

            endPosition.y += Math.sin(pitch) * this.length;

            this.end = connector(
                endPosition,
                this.start.yaw,
                pitch,
                roll
            );

            return;
        }

        if (
            this.type === "curveLeft" ||
            this.type === "curveRight"
        ) {
            const direction =
                this.type === "curveLeft" ? 1 : -1;

            const radius = CURVE_RADIUS;
            const angle = CURVE_ANGLE;

            const centerOffset = new THREE.Vector3(
                direction * radius,
                0,
                0
            );

            const center = transformPoint(
                this.start.position,
                this.start.yaw,
                centerOffset
            );

            const startAngle =
                this.start.yaw +
                (direction > 0 ? Math.PI : 0);

            const segments = 24;

            const shape = new THREE.Shape();

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const a = startAngle + direction * angle * t;

                const x = Math.sin(a) * radius;
                const z = Math.cos(a) * radius;

                const world = transformPoint(
                    center,
                    0,
                    new THREE.Vector3(x, 0, z)
                );

                const localX = world.x - this.start.position.x;
                const localZ = world.z - this.start.position.z;

                if (i === 0) {
                    shape.moveTo(localX, localZ);
                } else {
                    shape.lineTo(localX, localZ);
                }
            }

            const geometry = new THREE.ExtrudeGeometry(
                shape,
                {
                    depth: this.width,
                    bevelEnabled: false,
                    steps: 1
                }
            );

            geometry.rotateX(Math.PI / 2);

            const road = new THREE.Mesh(
                geometry,
                roadMaterial
            );

            road.castShadow = true;
            road.receiveShadow = true;

            this.mesh.add(road);

            const endYaw =
                this.start.yaw +
                direction * angle;

            const endPosition = center.clone();

            endPosition.x =
                center.x +
                Math.sin(startAngle + direction * angle) *
                radius;

            endPosition.z =
                center.z +
                Math.cos(startAngle + direction * angle) *
                radius;

            this.end = connector(
                endPosition,
                endYaw,
                this.start.pitch,
                this.start.roll
            );

            return;
        }
    }

    getForward() {
        return forwardVector(
            this.start.yaw,
            this.start.pitch
        );
    }

    getEndForward() {
        return forwardVector(
            this.end.yaw,
            this.end.pitch
        );
    }

    getBoundsRadius() {
        if (
            this.type === "curveLeft" ||
            this.type === "curveRight"
        ) {
            return CURVE_RADIUS + this.width;
        }

        return Math.sqrt(
            (this.length / 2) ** 2 +
            (this.width / 2) ** 2
        );
    }
}

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.pieces = [];
        this.startConnector = connector(
            new THREE.Vector3(0, 0, 0),
            0,
            0,
            0
        );

        this.startMarker = null;
        this.endMarker = null;
        this.environment = new THREE.Group();

        this.scene.add(this.environment);

        this.buildEnvironment();
        this.createMarkers();
    }

    clear() {
        while (this.group.children.length) {
            this.group.remove(this.group.children[0]);
        }

        this.pieces = [];

        this.startConnector = connector(
            new THREE.Vector3(0, 0, 0),
            0,
            0,
            0
        );

        this.updateMarkers();
    }

    buildEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(
            2500,
            2500
        );

        const groundMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x1a211d,
                roughness: 1
            });

        const ground = new THREE.Mesh(
            groundGeometry,
            groundMaterial
        );

        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;

        this.environment.add(ground);

        const grid = new THREE.GridHelper(
            1000,
            100,
            0x36413b,
            0x252d29
        );

        grid.position.y = -1.95;

        this.environment.add(grid);
    }

    createMarkers() {
        this.startMarker = this.createMarker(
            0x32d583,
            "START"
        );

        this.endMarker = this.createMarker(
            0xffbd32,
            "END"
        );

        this.scene.add(this.startMarker);
        this.scene.add(this.endMarker);

        this.updateMarkers();
    }

    createMarker(color, label) {
        const group = new THREE.Group();

        const ringGeometry =
            new THREE.TorusGeometry(5, 0.35, 8, 32);

        const ring = new THREE.Mesh(
            ringGeometry,
            new THREE.MeshBasicMaterial({
                color
            })
        );

        ring.rotation.x = Math.PI / 2;

        group.add(ring);

        const arrowGeometry =
            new THREE.ConeGeometry(1.1, 3, 6);

        const arrow = new THREE.Mesh(
            arrowGeometry,
            new THREE.MeshBasicMaterial({
                color
            })
        );

        arrow.position.y = 1.5;

        group.add(arrow);

        group.userData.label = label;

        return group;
    }

    updateMarkers() {
        const start = this.startConnector;

        this.startMarker.position.copy(start.position);
        this.startMarker.position.y += 0.15;
        this.startMarker.rotation.y = start.yaw;

        const end =
            this.pieces.length > 0
                ? this.pieces[this.pieces.length - 1].end
                : this.startConnector;

        this.endMarker.position.copy(end.position);
        this.endMarker.position.y += 0.15;
        this.endMarker.rotation.y = end.yaw;
    }

    getCurrentConnector() {
        if (this.pieces.length === 0) {
            return this.startConnector;
        }

        return this.pieces[this.pieces.length - 1].end;
    }

    createPreview(type) {
        const piece = new TrackPiece(
            type,
            this.getCurrentConnector()
        );

        piece.mesh.traverse((object) => {
            if (object.isMesh) {
                object.material = object.material.clone();
                object.material.transparent = true;
                object.material.opacity = 0.35;
                object.material.depthWrite = false;
            }
        });

        return piece;
    }

    intersectsExisting(piece) {
        for (const existing of this.pieces) {
            const distance =
                existing.end.position.distanceTo(
                    piece.start.position
                );

            if (distance < 0.5) {
                continue;
            }

            const centers = [
                existing.start.position,
                existing.end.position,
                piece.start.position,
                piece.end.position
            ];

            for (const a of centers) {
                for (const b of centers) {
                    if (
                        a !== b &&
                        a.distanceTo(b) < 4
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    canAdd(type) {
        const preview = this.createPreview(type);

        if (this.intersectsExisting(preview)) {
            return false;
        }

        return true;
    }

    addPiece(type) {
        const piece = new TrackPiece(
            type,
            this.getCurrentConnector()
        );

        if (this.intersectsExisting(piece)) {
            return null;
        }

        this.pieces.push(piece);
        this.group.add(piece.mesh);

        this.updateMarkers();

        return piece;
    }

    buildDefault() {
        this.clear();

        const pieces = [
            "straight",
            "straight",
            "curveLeft",
            "straight",
            "ramp",
            "straight",
            "bankRight",
            "straight",
            "curveRight",
            "straight",
            "boost",
            "straight",
            "curveRight",
            "straight",
            "ramp",
            "straight",
            "bankLeft",
            "straight",
            "curveLeft",
            "straight",
            "boost",
            "straight"
        ];

        for (const type of pieces) {
            this.addPiece(type);
        }
    }

    buildSpeedCircuit() {
        this.clear();

        const pieces = [
            "straight",
            "boost",
            "straight",
            "curveRight",
            "straight",
            "curveRight",
            "straight",
            "ramp",
            "straight",
            "bankLeft",
            "straight",
            "curveLeft",
            "straight",
            "boost",
            "straight",
            "curveLeft",
            "straight",
            "curveLeft",
            "straight",
            "ramp",
            "straight",
            "bankRight",
            "straight",
            "curveRight",
            "straight"
        ];

        for (const type of pieces) {
            this.addPiece(type);
        }
    }

    getSpawn() {
        const position =
            this.startConnector.position.clone();

        position.y += 2;

        return {
            position,
            yaw: this.startConnector.yaw
        };
    }

    getFinish() {
        return this.pieces.length
            ? this.pieces[this.pieces.length - 1].end.position.clone()
            : this.startConnector.position.clone();
    }

    getHeightAt(position) {
        let best = null;
        let bestDistance = Infinity;

        for (const piece of this.pieces) {
            const distance =
                piece.start.position.distanceTo(
                    position
                );

            if (distance < bestDistance) {
                bestDistance = distance;
                best = piece;
            }
        }

        if (!best) {
            return 0;
        }

        return best.start.position.y;
    }
}