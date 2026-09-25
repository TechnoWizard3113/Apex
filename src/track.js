import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export const TRACK_WIDTH = 18;
export const STRAIGHT_LENGTH = 30;
export const CURVE_RADIUS = 30;
export const CURVE_ANGLE = Math.PI / 2;
export const RAMP_LENGTH = 30;
export const RAMP_HEIGHT = 8;
export const BANK_ANGLE = THREE.MathUtils.degToRad(28);

function basisFromDirection(direction) {
    const forward = new THREE.Vector3(
        Math.sin(direction),
        0,
        Math.cos(direction)
    ).normalize();

    const right = new THREE.Vector3(
        Math.cos(direction),
        0,
        -Math.sin(direction)
    ).normalize();

    return { forward, right };
}

function createRoadMaterial(color = 0x3b4147) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.05
    });
}

function createRoadMesh(width, length, height = 0, color = 0x3b4147) {
    const geometry = new THREE.BoxGeometry(width, 0.5, length);
    const mesh = new THREE.Mesh(geometry, createRoadMaterial(color));

    mesh.position.y = height;
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    return mesh;
}

export class TrackPiece {
    constructor(type, startPosition, startDirection) {
        this.type = type;
        this.start = startPosition.clone();
        this.direction = startDirection;
        this.length = STRAIGHT_LENGTH;
        this.width = TRACK_WIDTH;
        this.height = 0;
        this.end = startPosition.clone();
        this.endDirection = startDirection;
        this.mesh = new THREE.Group();

        this.build();
    }

    build() {
        const { forward, right } = basisFromDirection(this.direction);

        if (
            this.type === "straight" ||
            this.type === "boost"
        ) {
            this.length = STRAIGHT_LENGTH;

            const center = this.start.clone()
                .addScaledVector(forward, this.length / 2);

            const road = createRoadMesh(
                this.width,
                this.length,
                0,
                this.type === "boost" ? 0x254e68 : 0x3b4147
            );

            road.position.copy(center);
            road.rotation.y = this.direction;
            this.mesh.add(road);

            if (this.type === "boost") {
                for (let i = 0; i < 5; i++) {
                    const stripeGeometry = new THREE.BoxGeometry(
                        this.width * 0.75,
                        0.08,
                        1.5
                    );

                    const stripe = new THREE.Mesh(
                        stripeGeometry,
                        new THREE.MeshStandardMaterial({
                            color: 0x8da8ba,
                            roughness: 0.6
                        })
                    );

                    stripe.position.copy(
                        this.start.clone().addScaledVector(
                            forward,
                            5 + i * 5
                        )
                    );

                    stripe.position.y = 0.3;
                    stripe.rotation.y = this.direction;
                    this.mesh.add(stripe);
                }
            }

            this.end = this.start.clone()
                .addScaledVector(forward, this.length);
            return;
        }

        if (this.type === "ramp") {
            this.length = RAMP_LENGTH;
            this.height = RAMP_HEIGHT;

            const slopeAngle = Math.atan2(
                RAMP_HEIGHT,
                RAMP_LENGTH
            );

            const center = this.start.clone()
                .addScaledVector(forward, this.length / 2);

            const slopeLength = Math.sqrt(
                RAMP_LENGTH * RAMP_LENGTH +
                RAMP_HEIGHT * RAMP_HEIGHT
            );

            const geometry = new THREE.BoxGeometry(
                this.width,
                0.5,
                slopeLength
            );

            const road = new THREE.Mesh(
                geometry,
                createRoadMaterial()
            );

            road.position.copy(center);
            road.position.y = RAMP_HEIGHT / 2;
            road.rotation.y = this.direction;
            road.rotation.x = -slopeAngle;

            this.mesh.add(road);

            this.end = this.start.clone()
                .addScaledVector(forward, this.length);

            return;
        }

        if (
            this.type === "curveLeft" ||
            this.type === "curveRight"
        ) {
            const sign = this.type === "curveLeft" ? 1 : -1;

            const center = this.start.clone()
                .addScaledVector(right, sign * CURVE_RADIUS);

            const curveGroup = new THREE.Group();

            const segments = 20;

            for (let i = 0; i < segments; i++) {
                const t0 = i / segments;
                const t1 = (i + 1) / segments;

                const a0 = this.direction - sign * Math.PI / 2 + sign * t0 * CURVE_ANGLE;
                const a1 = this.direction - sign * Math.PI / 2 + sign * t1 * CURVE_ANGLE;

                const p0 = center.clone().add(
                    new THREE.Vector3(
                        Math.cos(a0) * CURVE_RADIUS,
                        0,
                        Math.sin(a0) * CURVE_RADIUS
                    )
                );

                const p1 = center.clone().add(
                    new THREE.Vector3(
                        Math.cos(a1) * CURVE_RADIUS,
                        0,
                        Math.sin(a1) * CURVE_RADIUS
                    )
                );

                const midpoint = p0.clone().add(p1).multiplyScalar(0.5);
                const segmentLength = p0.distanceTo(p1);

                const road = createRoadMesh(
                    this.width,
                    segmentLength + 0.15,
                    0
                );

                road.position.copy(midpoint);
                road.rotation.y = Math.atan2(
                    p1.x - p0.x,
                    p1.z - p0.z
                );

                curveGroup.add(road);
            }

            this.mesh.add(curveGroup);

            const finalAngle =
                this.direction + sign * CURVE_ANGLE;

            const endForward = basisFromDirection(finalAngle).forward;

            this.end = center.clone()
                .add(
                    new THREE.Vector3(
                        Math.cos(
                            this.direction -
                            sign * Math.PI / 2 +
                            sign * CURVE_ANGLE
                        ) * CURVE_RADIUS,
                        0,
                        Math.sin(
                            this.direction -
                            sign * Math.PI / 2 +
                            sign * CURVE_ANGLE
                        ) * CURVE_RADIUS
                    )
                );

            this.endDirection = finalAngle;

            return;
        }

        if (
            this.type === "bankLeft" ||
            this.type === "bankRight"
        ) {
            const sign = this.type === "bankLeft" ? 1 : -1;

            this.length = STRAIGHT_LENGTH;

            const center = this.start.clone()
                .addScaledVector(forward, this.length / 2);

            const road = createRoadMesh(
                this.width,
                this.length,
                0
            );

            road.position.copy(center);
            road.rotation.y = this.direction;
            road.rotation.z = sign * BANK_ANGLE;

            this.mesh.add(road);

            this.end = this.start.clone()
                .addScaledVector(forward, this.length);

            return;
        }
    }

    getHeightAt(position) {
        const local = position.clone().sub(this.start);

        const { forward, right } = basisFromDirection(this.direction);

        const forwardDistance = local.dot(forward);

        if (this.type === "ramp") {
            const t = THREE.MathUtils.clamp(
                forwardDistance / this.length,
                0,
                1
            );

            return RAMP_HEIGHT * t;
        }

        return 0;
    }

    contains(position) {
        const local = position.clone().sub(this.start);
        const { forward, right } = basisFromDirection(this.direction);

        const forwardDistance = local.dot(forward);
        const sideDistance = Math.abs(local.dot(right));

        return (
            forwardDistance >= -1 &&
            forwardDistance <= this.length + 1 &&
            sideDistance <= this.width / 2
        );
    }
}

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.pieces = [];
        this.startPosition = new THREE.Vector3(0, 0, 0);
        this.startDirection = 0;

        this.finishPosition = new THREE.Vector3();
        this.finishDirection = 0;

        this.buildDefault();
    }

    clear() {
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }

        this.pieces = [];
    }

    addPiece(type) {
        let start;
        let direction;

        if (this.pieces.length === 0) {
            start = this.startPosition.clone();
            direction = this.startDirection;
        } else {
            const previous = this.pieces[this.pieces.length - 1];

            start = previous.end.clone();
            direction = previous.endDirection;
        }

        const piece = new TrackPiece(
            type,
            start,
            direction
        );

        if (this.intersectsExisting(piece)) {
            return false;
        }

        this.pieces.push(piece);
        this.group.add(piece.mesh);

        this.updateFinish();

        return true;
    }

    intersectsExisting(newPiece) {
        const newCenter = newPiece.start.clone()
            .add(newPiece.end)
            .multiplyScalar(0.5);

        const newRadius =
            newPiece.start.distanceTo(newPiece.end) / 2 +
            TRACK_WIDTH;

        for (const piece of this.pieces) {
            const center = piece.start.clone()
                .add(piece.end)
                .multiplyScalar(0.5);

            const radius =
                piece.start.distanceTo(piece.end) / 2 +
                TRACK_WIDTH;

            if (
                newCenter.distanceTo(center) <
                newRadius + radius - TRACK_WIDTH
            ) {
                if (newPiece.type.includes("curve") && piece.type.includes("curve")) {
                    continue;
                }

                return true;
            }
        }

        return false;
    }

    updateFinish() {
        if (this.pieces.length === 0) {
            return;
        }

        const last = this.pieces[this.pieces.length - 1];

        this.finishPosition = last.end.clone();
        this.finishDirection = last.endDirection;
    }

    getHeightAt(position) {
        for (const piece of this.pieces) {
            if (piece.contains(position)) {
                return piece.getHeightAt(position);
            }
        }

        return null;
    }

    getPieceAt(position) {
        for (const piece of this.pieces) {
            if (piece.contains(position)) {
                return piece;
            }
        }

        return null;
    }

    getSpawn() {
        if (this.pieces.length === 0) {
            return {
                position: this.startPosition.clone(),
                direction: this.startDirection
            };
        }

        const first = this.pieces[0];

        const { forward } = basisFromDirection(first.direction);

        return {
            position: first.start.clone()
                .addScaledVector(forward, 4)
                .add(new THREE.Vector3(0, 1, 0)),
            direction: first.direction
        };
    }

    buildDefault() {
        this.clear();

        this.addPiece("straight");
        this.addPiece("straight");
        this.addPiece("ramp");
        this.addPiece("straight");
        this.addPiece("curveLeft");
        this.addPiece("straight");
        this.addPiece("bankRight");
        this.addPiece("boost");
        this.addPiece("curveRight");
        this.addPiece("straight");
    }
}