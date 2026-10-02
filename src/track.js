import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export const TRACK_WIDTH = 18;
export const PIECE_LENGTH = 30;
export const CURVE_RADIUS = 30;
export const CURVE_ANGLE = Math.PI / 2;
export const RAMP_HEIGHT = 11;
export const BANK_ANGLE = THREE.MathUtils.degToRad(28);

const ROAD_HEIGHT = 1.2;

const UP = new THREE.Vector3(0, 1, 0);

function roadMaterial(color = 0x343941) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.05
    });
}

function makeConnector(
    position,
    yaw = 0,
    pitch = 0,
    roll = 0
) {
    return {
        position: position.clone(),
        yaw,
        pitch,
        roll
    };
}

function cloneConnector(connector) {
    return makeConnector(
        connector.position,
        connector.yaw,
        connector.pitch,
        connector.roll
    );
}

function forwardFromConnector(connector) {
    return new THREE.Vector3(
        Math.sin(connector.yaw) *
            Math.cos(connector.pitch),
        Math.sin(connector.pitch),
        Math.cos(connector.yaw) *
            Math.cos(connector.pitch)
    ).normalize();
}

function makeRoad(length, width, material) {
    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                ROAD_HEIGHT,
                length
            ),
            material
        );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

export class TrackPiece {
    constructor(type, startConnector) {
        this.type = type;

        this.start =
            cloneConnector(startConnector);

        this.end =
            cloneConnector(startConnector);

        this.group =
            new THREE.Group();

        this.collisionRadius = 16;

        this.surface = {
            type,
            center:
                this.start.position.clone()
        };

        this.build();
    }

    build() {
        if (
            [
                "straight",
                "boost",
                "ramp",
                "bankLeft",
                "bankRight"
            ].includes(this.type)
        ) {
            this.buildLinear();
            return;
        }

        if (
            [
                "curveLeft",
                "curveRight"
            ].includes(this.type)
        ) {
            this.buildCurve();
        }
    }

    buildLinear() {
        let pitch = 0;
        let roll = 0;

        if (this.type === "ramp") {
            pitch =
                Math.atan2(
                    RAMP_HEIGHT,
                    PIECE_LENGTH
                );
        }

        if (this.type === "bankLeft") {
            roll = BANK_ANGLE;
        }

        if (this.type === "bankRight") {
            roll = -BANK_ANGLE;
        }

        const material =
            this.type === "boost"
                ? roadMaterial(0x1d67d5)
                : roadMaterial();

        const road =
            makeRoad(
                PIECE_LENGTH,
                TRACK_WIDTH,
                material
            );

        const direction =
            new THREE.Vector3(
                Math.sin(this.start.yaw) *
                    Math.cos(pitch),
                Math.sin(pitch),
                Math.cos(this.start.yaw) *
                    Math.cos(pitch)
            );

        const center =
            this.start.position.clone()
                .addScaledVector(
                    direction,
                    PIECE_LENGTH / 2
                );

        center.y -=
            ROAD_HEIGHT / 2;

        road.position.copy(center);

        road.rotation.order = "YXZ";
        road.rotation.y =
            this.start.yaw;
        road.rotation.x =
            -pitch;
        road.rotation.z =
            roll;

        this.group.add(road);

        if (this.type === "boost") {
            this.addBoostMarkers(
                direction
            );
        } else {
            this.addCenterStripe(
                direction
            );
        }

        const end =
            this.start.position.clone()
                .addScaledVector(
                    direction,
                    PIECE_LENGTH
                );

        this.end =
            makeConnector(
                end,
                this.start.yaw,
                pitch,
                roll
            );

        this.surface.center =
            center.clone();

        this.collisionRadius =
            Math.sqrt(
                (PIECE_LENGTH / 2) ** 2 +
                (TRACK_WIDTH / 2) ** 2
            );
    }

    addCenterStripe(direction) {
        const stripe =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.4,
                    0.12,
                    PIECE_LENGTH - 4
                ),
                new THREE.MeshBasicMaterial({
                    color: 0xd8dce0
                })
            );

        stripe.position.copy(
            this.start.position
                .clone()
                .addScaledVector(
                    direction,
                    PIECE_LENGTH / 2
                )
        );

        stripe.position.y += 0.65;

        stripe.rotation.order = "YXZ";
        stripe.rotation.y =
            this.start.yaw;
        stripe.rotation.x =
            -this.start.pitch;
        stripe.rotation.z =
            this.start.roll;

        this.group.add(stripe);
    }

    addBoostMarkers(direction) {
        for (let i = -1; i <= 1; i++) {
            const marker =
                new THREE.Mesh(
                    new THREE.ConeGeometry(
                        1.2,
                        3.5,
                        4
                    ),
                    new THREE.MeshBasicMaterial({
                        color: 0xffffff
                    })
                );

            const position =
                this.start.position
                    .clone()
                    .addScaledVector(
                        direction,
                        PIECE_LENGTH / 2
                    );

            const side =
                new THREE.Vector3(
                    Math.cos(
                        this.start.yaw
                    ),
                    0,
                    -Math.sin(
                        this.start.yaw
                    )
                );

            position.addScaledVector(
                side,
                i * 5
            );

            position.y += 1;

            marker.position.copy(
                position
            );

            marker.rotation.order =
                "YXZ";

            marker.rotation.y =
                this.start.yaw;

            marker.rotation.x =
                Math.PI / 2 -
                this.start.pitch;

            this.group.add(marker);
        }
    }

    buildCurve() {
        const left =
            this.type === "curveLeft";

        const direction =
            left ? 1 : -1;

        const radius =
            CURVE_RADIUS;

        const start =
            this.start.position.clone();

        const yaw =
            this.start.yaw;

        const right =
            new THREE.Vector3(
                Math.cos(yaw),
                0,
                -Math.sin(yaw)
            );

        const center =
            start.clone()
                .addScaledVector(
                    right,
                    direction * radius
                );

        const radial =
            start.clone()
                .sub(center);

        const points = [];

        const segments = 32;

        for (
            let i = 0;
            i <= segments;
            i++
        ) {
            const t =
                i / segments;

            const angle =
                direction *
                CURVE_ANGLE *
                t;

            const point =
                radial.clone()
                    .applyAxisAngle(
                        UP,
                        angle
                    )
                    .add(center);

            points.push(point);
        }

        const inner = [];
        const outer = [];

        for (
            let i = 0;
            i < points.length;
            i++
        ) {
            const point =
                points[i];

            let tangent;

            if (i === 0) {
                tangent =
                    points[1]
                        .clone()
                        .sub(point)
                        .normalize();
            } else if (
                i === points.length - 1
            ) {
                tangent =
                    point.clone()
                        .sub(
                            points[i - 1]
                        )
                        .normalize();
            } else {
                tangent =
                    points[i + 1]
                        .clone()
                        .sub(
                            points[i - 1]
                        )
                        .normalize();
            }

            const side =
                new THREE.Vector3(
                    tangent.z,
                    0,
                    -tangent.x
                ).normalize();

            inner.push(
                point.clone()
                    .addScaledVector(
                        side,
                        -TRACK_WIDTH / 2
                    )
            );

            outer.push(
                point.clone()
                    .addScaledVector(
                        side,
                        TRACK_WIDTH / 2
                    )
            );
        }

        const positions = [];
        const indices = [];

        for (
            let i = 0;
            i < points.length;
            i++
        ) {
            positions.push(
                inner[i].x,
                inner[i].y,
                inner[i].z
            );

            positions.push(
                outer[i].x,
                outer[i].y,
                outer[i].z
            );
        }

        for (
            let i = 0;
            i < segments;
            i++
        ) {
            const a = i * 2;

            indices.push(
                a,
                a + 1,
                a + 2,

                a + 1,
                a + 3,
                a + 2
            );
        }

        const geometry =
            new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
                positions,
                3
            )
        );

        geometry.setIndex(indices);

        geometry.computeVertexNormals();

        const road =
            new THREE.Mesh(
                geometry,
                roadMaterial()
            );

        road.castShadow = true;
        road.receiveShadow = true;

        this.group.add(road);

        const endPoint =
            points[points.length - 1];

        const tangent =
            endPoint.clone()
                .sub(
                    points[
                        points.length - 2
                    ]
                )
                .normalize();

        const endYaw =
            Math.atan2(
                tangent.x,
                tangent.z
            );

        this.end =
            makeConnector(
                endPoint,
                endYaw,
                this.start.pitch,
                this.start.roll
            );

        this.surface.center =
            center.clone();

        this.collisionRadius =
            radius +
            TRACK_WIDTH;
    }

    getForward() {
        return forwardFromConnector(
            this.start
        );
    }

    getEndForward() {
        return forwardFromConnector(
            this.end
        );
    }
}

export class Track {
    constructor(scene) {
        this.scene = scene;

        this.group =
            new THREE.Group();

        this.environment =
            new THREE.Group();

        scene.add(this.environment);
        scene.add(this.group);

        this.pieces = [];

        this.checkpoints = [];

        this.startConnector =
            makeConnector(
                new THREE.Vector3(
                    0,
                    0,
                    0
                ),
                0,
                0,
                0
            );

        this.createEnvironment();
        this.createMarkers();
    }

    createEnvironment() {
        const ground =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    3000,
                    3000
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x17201b,
                    roughness: 1
                })
            );

        ground.rotation.x =
            -Math.PI / 2;

        ground.position.y = -3;

        ground.receiveShadow = true;

        this.environment.add(ground);

        const grid =
            new THREE.GridHelper(
                1000,
                100,
                0x3b4740,
                0x252d29
            );

        grid.position.y = -2.95;

        this.environment.add(grid);
    }

    createMarkers() {
        this.startMarker =
            this.createMarker(
                0x32d583
            );

        this.endMarker =
            this.createMarker(
                0xffbd32
            );

        this.scene.add(
            this.startMarker
        );

        this.scene.add(
            this.endMarker
        );

        this.updateMarkers();
    }

    createMarker(color) {
        const group =
            new THREE.Group();

        const ring =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    5,
                    0.35,
                    8,
                    32
                ),
                new THREE.MeshBasicMaterial({
                    color
                })
            );

        ring.rotation.x =
            Math.PI / 2;

        group.add(ring);

        const arrow =
            new THREE.Mesh(
                new THREE.ConeGeometry(
                    1.2,
                    3,
                    6
                ),
                new THREE.MeshBasicMaterial({
                    color
                })
            );

        arrow.position.y = 1.5;

        group.add(arrow);

        return group;
    }

    updateMarkers() {
        this.startMarker.position.copy(
            this.startConnector.position
        );

        this.startMarker.position.y += 0.25;

        const end =
            this.pieces.length
                ? this.pieces[
                    this.pieces.length - 1
                ].end
                : this.startConnector;

        this.endMarker.position.copy(
            end.position
        );

        this.endMarker.position.y += 0.25;

        this.endMarker.rotation.y =
            end.yaw;

        this.rebuildCheckpoints();
    }

    rebuildCheckpoints() {
        this.checkpoints = [];

        for (
            let i = 3;
            i < this.pieces.length;
            i += 4
        ) {
            this.checkpoints.push(
                this.pieces[i].start.position.clone()
            );
        }
    }

    clear() {
        while (
            this.group.children.length
        ) {
            const child =
                this.group.children.pop();

            child.traverse(
                object => {
                    if (
                        object.isMesh
                    ) {
                        object.geometry?.dispose();

                        if (
                            Array.isArray(
                                object.material
                            )
                        ) {
                            object.material.forEach(
                                material =>
                                    material.dispose()
                            );
                        } else {
                            object.material?.dispose();
                        }
                    }
                }
            );
        }

        this.pieces = [];
        this.checkpoints = [];

        this.updateMarkers();
    }

    getCurrentConnector() {
        if (
            this.pieces.length === 0
        ) {
            return this.startConnector;
        }

        return this.pieces[
            this.pieces.length - 1
        ].end;
    }

    createPreview(type, rotation = 0) {
        const connector =
            this.getCurrentConnector();

        const rotatedConnector =
            makeConnector(
                connector.position,
                connector.yaw + rotation,
                connector.pitch,
                connector.roll
            );

        const piece =
            new TrackPiece(
                type,
                rotatedConnector
            );

        piece.mesh =
            piece.group;

        piece.group.traverse(
            object => {
                if (
                    object.isMesh
                ) {
                    object.material =
                        object.material.clone();

                    object.material.transparent =
                        true;

                    object.material.opacity =
                        0.42;

                    object.material.depthWrite =
                        false;
                }
            }
        );

        return piece;
    }

    pieceBounds(piece) {
        const center =
            piece.start.position
                .clone()
                .add(
                    piece.end.position
                )
                .multiplyScalar(0.5);

        return {
            center,
            radius:
                piece.collisionRadius
        };
    }

    piecesOverlap(a, b) {
        const A =
            this.pieceBounds(a);

        const B =
            this.pieceBounds(b);

        const distance =
            A.center.distanceTo(
                B.center
            );

        return (
            distance <
            A.radius +
            B.radius -
            8
        );
    }

    canAdd(type, rotation = 0) {
        const preview =
            this.createPreview(
                type,
                rotation
            );

        for (
            const existing
            of this.pieces
        ) {
            if (
                this.piecesOverlap(
                    existing,
                    preview
                )
            ) {
                return false;
            }
        }

        return true;
    }

    addPiece(type, rotation = 0) {
        const connector =
            this.getCurrentConnector();

        const rotatedConnector =
            makeConnector(
                connector.position,
                connector.yaw + rotation,
                connector.pitch,
                connector.roll
            );

        const piece =
            new TrackPiece(
                type,
                rotatedConnector
            );

        for (
            const existing
            of this.pieces
        ) {
            if (
                this.piecesOverlap(
                    existing,
                    piece
                )
            ) {
                return null;
            }
        }

        this.pieces.push(piece);

        this.group.add(
            piece.group
        );

        this.updateMarkers();

        return piece;
    }

    buildDefault() {
        this.clear();

        const sequence = [
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
            "straight",
            "curveLeft",
            "straight"
        ];

        for (
            const type
            of sequence
        ) {
            this.addPiece(type);
        }
    }

    buildSpeedCircuit() {
        this.clear();

        const sequence = [
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

        for (
            const type
            of sequence
        ) {
            this.addPiece(type);
        }
    }

    getSpawn() {
        const forward =
            this.getCurrentConnector();

        return {
            position:
                forward.position
                    .clone()
                    .add(
                        new THREE.Vector3(
                            0,
                            2.2,
                            0
                        )
                    ),

            yaw:
                forward.yaw
        };
    }

    getFinish() {
        if (
            this.pieces.length === 0
        ) {
            return this.startConnector.position.clone();
        }

        return this.pieces[
            this.pieces.length - 1
        ].end.position.clone();
    }

    getHeightAt(position) {
        if (
            this.pieces.length === 0
        ) {
            return 0;
        }

        let closest =
            this.pieces[0];

        let closestDistance =
            Infinity;

        for (
            const piece
            of this.pieces
        ) {
            const distance =
                piece.surface.center
                    .distanceTo(
                        position
                    );

            if (
                distance <
                closestDistance
            ) {
                closestDistance =
                    distance;

                closest =
                    piece;
            }
        }

        if (
            closest.type === "ramp"
        ) {
            const forward =
                closest.getForward();

            const offset =
                position.clone()
                    .sub(
                        closest.start.position
                    );

            const distance =
                offset.dot(forward);

            const amount =
                THREE.MathUtils.clamp(
                    distance /
                    PIECE_LENGTH,
                    0,
                    1
                );

            return (
                closest.start.position.y +
                RAMP_HEIGHT * amount
            );
        }

        return closest.start.position.y;
    }

    getSurfaceInfo(position) {
        let closest = null;
        let closestDistance = Infinity;

        for (
            const piece
            of this.pieces
        ) {
            const distance =
                piece.surface.center
                    .distanceTo(
                        position
                    );

            if (
                distance <
                closestDistance
            ) {
                closestDistance =
                    distance;

                closest =
                    piece;
            }
        }

        if (!closest) {
            return {
                height: 0,
                boost: false,
                pitch: 0,
                roll: 0
            };
        }

        return {
            height:
                this.getHeightAt(
                    position
                ),

            boost:
                closest.type ===
                "boost",

            pitch:
                closest.end.pitch,

            roll:
                closest.end.roll
        };
    }
}