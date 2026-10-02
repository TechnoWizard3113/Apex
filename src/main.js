import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { Track } from "./track.js";
import { Vehicle } from "./vehicle.js";
import { FollowCamera } from "./camera.js";

const menu = document.getElementById("menu");
const trackSelect = document.getElementById("trackSelect");
const builder = document.getElementById("builder");
const game = document.getElementById("game");

const playButton = document.getElementById("playButton");
const buildButton = document.getElementById("buildButton");
const tracksButton = document.getElementById("tracksButton");
const trackBackButton = document.getElementById("trackBackButton");

const testTrackButton =
    document.getElementById("testTrackButton");

const clearTrackButton =
    document.getElementById("clearTrackButton");

const builderBackButton =
    document.getElementById("builderBackButton");

const builderStatus =
    document.getElementById("builderStatus");

const pauseButton =
    document.getElementById("pauseButton");

const timerElement =
    document.getElementById("timer");

const bestTimeElement =
    document.getElementById("bestTime");

const speedElement =
    document.getElementById("speed");

const checkpointElement =
    document.getElementById("checkpoint");

const countdownElement =
    document.getElementById("countdown");

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.shadowMap.enabled = true;

renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.pointerEvents = "none";

game.appendChild(renderer.domElement);

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x10151c);

const camera =
    new THREE.PerspectiveCamera(
        68,
        window.innerWidth /
            window.innerHeight,
        0.1,
        5000
    );

camera.position.set(
    0,
    10,
    -20
);

const ambientLight =
    new THREE.HemisphereLight(
        0xffffff,
        0x243020,
        1.6
    );

scene.add(
    ambientLight
);

const sun =
    new THREE.DirectionalLight(
        0xffffff,
        2.2
    );

sun.position.set(
    100,
    150,
    80
);

sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

scene.add(sun);

const track =
    new Track(scene);

const vehicle =
    new Vehicle(scene);

const followCamera =
    new FollowCamera(camera);

const controls = {
    throttle: false,
    brake: false,
    left: false,
    right: false
};

let currentMode = "menu";

let currentTrackId = 1;

let raceStarted = false;
let raceFinished = false;
let raceStartTime = 0;
let finalRaceTime = 0;

let bestTime =
    Number(
        localStorage.getItem(
            "apex-best-track-" +
            currentTrackId
        )
    ) || null;

let checkpoint = 1;

let builderPieceType = null;
let builderPreview = null;
let builderPreviewRotation = 0;

let builderHistory = [];

let lastFrameTime =
    performance.now();

function showScreen(screen) {
    menu.classList.add("hidden");
    trackSelect.classList.add("hidden");
    builder.classList.add("hidden");
    game.classList.remove("active");

    if (screen === menu) {
        menu.classList.remove("hidden");
    }

    if (screen === trackSelect) {
        trackSelect.classList.remove("hidden");
    }

    if (screen === builder) {
        builder.classList.remove("hidden");
    }

    if (screen === game) {
        game.classList.add("active");
    }
}

function formatTime(milliseconds) {
    if (
        !Number.isFinite(milliseconds)
    ) {
        return "--:--.---";
    }

    const totalMilliseconds =
        Math.max(
            0,
            Math.floor(milliseconds)
        );

    const minutes =
        Math.floor(
            totalMilliseconds / 60000
        );

    const seconds =
        Math.floor(
            (
                totalMilliseconds %
                60000
            ) / 1000
        );

    const millis =
        totalMilliseconds %
        1000;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(millis).padStart(3, "0")
    );
}

function updateBestDisplay() {
    bestTimeElement.textContent =
        bestTime === null
            ? "--:--.---"
            : formatTime(bestTime);
}

function loadTrack(id) {
    currentTrackId = id;

    if (id === 1) {
        track.buildDefault();
    } else {
        track.buildSpeedCircuit();
    }

    bestTime =
        Number(
            localStorage.getItem(
                "apex-best-track-" +
                currentTrackId
            )
        ) || null;

    updateBestDisplay();

    resetRace();
}

function resetRace() {
    const spawn =
        track.getSpawn();

    vehicle.reset(
        spawn.position,
        spawn.yaw
    );

    followCamera.reset();

    raceStarted = false;
    raceFinished = false;
    raceStartTime = 0;
    finalRaceTime = 0;
    checkpoint = 1;

    timerElement.textContent =
        "00:00.000";

    speedElement.textContent =
        "0 KM/H";

    checkpointElement.textContent =
        "CHECKPOINT 1";

    countdownElement.textContent =
        "";
}

function startRace() {
    resetRace();

    currentMode = "race";

    showScreen(game);

    runCountdown();
}

function runCountdown() {
    raceStarted = false;

    const values = [
        "3",
        "2",
        "1",
        "GO"
    ];

    let index = 0;

    countdownElement.textContent =
        values[index];

    const interval =
        setInterval(() => {
            index += 1;

            if (
                index >= values.length
            ) {
                clearInterval(interval);

                countdownElement.textContent =
                    "";

                raceStarted = true;
                raceStartTime =
                    performance.now();

                return;
            }

            countdownElement.textContent =
                values[index];
        }, 750);
}

function finishRace() {
    if (
        raceFinished ||
        !raceStarted
    ) {
        return;
    }

    raceFinished = true;

    finalRaceTime =
        performance.now() -
        raceStartTime;

    timerElement.textContent =
        formatTime(finalRaceTime);

    if (
        bestTime === null ||
        finalRaceTime < bestTime
    ) {
        bestTime =
            finalRaceTime;

        localStorage.setItem(
            "apex-best-track-" +
            currentTrackId,
            String(bestTime)
        );

        updateBestDisplay();
    }
}

function checkFinish() {
    const finish =
        track.getFinish();

    const distance =
        vehicle.position.distanceTo(
            finish
        );

    if (
        distance < 10
    ) {
        finishRace();
    }
}

function updateRace(delta) {
    vehicle.update(
        delta,
        controls,
        track
    );

    if (
        raceStarted &&
        !raceFinished
    ) {
        const elapsed =
            performance.now() -
            raceStartTime;

        timerElement.textContent =
            formatTime(elapsed);

        checkFinish();
    }

    speedElement.textContent =
        Math.round(
            vehicle.speed * 3.6
        ) +
        " KM/H";
}

function removePreview() {
    if (
        builderPreview
    ) {
        scene.remove(
            builderPreview.group
        );

        builderPreview = null;
    }

    builderPieceType = null;
    builderPreviewRotation = 0;
}

function setPreviewOpacity(
    valid
) {
    if (
        !builderPreview
    ) {
        return;
    }

    builderPreview.group.traverse(
        (object) => {
            if (
                !object.isMesh
            ) {
                return;
            }

            object.material =
                object.material.clone();

            object.material.transparent =
                true;

            object.material.opacity =
                valid
                    ? 0.45
                    : 0.22;

            object.material.depthWrite =
                false;

            if (
                object.material.color
            ) {
                object.material.color.set(
                    valid
                        ? 0x35c77a
                        : 0xd83232
                );
            }
        }
    );
}

function createBuilderPreview(
    type
) {
    removePreview();

    builderPieceType = type;

    builderPreviewRotation = 0;

    builderPreview =
        track.createPreview(
            type
        );

    scene.add(
        builderPreview.group
    );

    updateBuilderPreview();

    builderStatus.textContent =
        "Q/E rotate. ENTER place. ESC cancel.";
}

function updateBuilderPreview() {
    if (
        !builderPreview
    ) {
        return;
    }

    const connector =
        track.getCurrentConnector();

    const original =
        builderPreview;

    const oldGroup =
        original.group;

    scene.remove(
        oldGroup
    );

    const newPreview =
        track.createPreview(
            builderPieceType
        );

    const yaw =
        connector.yaw +
        builderPreviewRotation;

    newPreview.start.yaw =
        yaw;

    newPreview.end.yaw =
        yaw;

    newPreview.group.rotation.y =
        builderPreviewRotation;

    scene.add(
        newPreview.group
    );

    builderPreview =
        newPreview;

    const valid =
        isPreviewValid(
            builderPreview
        );

    setPreviewOpacity(
        valid
    );
}

function isPreviewValid(
    preview
) {
    if (
        !preview
    ) {
        return false;
    }

    const testPiece =
        preview;

    for (
        const existing
        of track.pieces
    ) {
        const a =
            track.pieceBounds(
                existing
            );

        const b =
            track.pieceBounds(
                testPiece
            );

        const distance =
            a.center.distanceTo(
                b.center
            );

        if (
            distance <
            a.radius +
            b.radius -
            8
        ) {
            return false;
        }
    }

    return true;
}

function placeBuilderPiece() {
    if (
        !builderPreview ||
        !builderPieceType
    ) {
        return;
    }

    if (
        !isPreviewValid(
            builderPreview
        )
    ) {
        builderStatus.textContent =
            "Invalid placement.";

        return;
    }

    const piece =
        track.addPiece(
            builderPieceType
        );

    if (
        !piece
    ) {
        builderStatus.textContent =
            "Invalid placement.";

        return;
    }

    builderHistory.push(
        piece
    );

    builderStatus.textContent =
        "Piece placed.";

    createBuilderPreview(
        builderPieceType
    );
}

function undoBuilderPiece() {
    if (
        builderHistory.length === 0
    ) {
        builderStatus.textContent =
            "Nothing to undo.";

        return;
    }

    const piece =
        builderHistory.pop();

    const index =
        track.pieces.indexOf(
            piece
        );

    if (
        index !== -1
    ) {
        track.pieces.splice(
            index,
            1
        );

        track.group.remove(
            piece.group
        );
    }

    track.updateMarkers();

    if (
        builderPieceType
    ) {
        createBuilderPreview(
            builderPieceType
        );
    }

    builderStatus.textContent =
        "Last piece removed.";
}

function clearBuilder() {
    removePreview();

    track.clear();

    builderHistory = [];

    builderStatus.textContent =
        "Track cleared. Select a piece.";
}

function enterBuilder() {
    currentMode = "builder";

    showScreen(builder);

    clearBuilder();
}

function testBuilderTrack() {
    removePreview();

    currentMode = "race";

    showScreen(game);

    resetRace();

    runCountdown();
}

function returnToMenu() {
    removePreview();

    currentMode = "menu";

    showScreen(menu);
}

playButton.addEventListener(
    "click",
    () => {
        loadTrack(1);
        startRace();
    }
);

buildButton.addEventListener(
    "click",
    () => {
        enterBuilder();
    }
);

tracksButton.addEventListener(
    "click",
    () => {
        currentMode = "trackSelect";
        showScreen(trackSelect);
    }
);

trackBackButton.addEventListener(
    "click",
    () => {
        currentMode = "menu";
        showScreen(menu);
    }
);

document
    .querySelectorAll(
        ".track-option"
    )
    .forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        Number(
                            button.dataset.trackId
                        );

                    loadTrack(id);

                    startRace();
                }
            );
        }
    );

document
    .querySelectorAll(
        ".piece-buttons button"
    )
    .forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    const type =
                        button.dataset.piece;

                    createBuilderPreview(
                        type
                    );
                }
            );
        }
    );

testTrackButton.addEventListener(
    "click",
    () => {
        testBuilderTrack();
    }
);

clearTrackButton.addEventListener(
    "click",
    () => {
        clearBuilder();
    }
);

builderBackButton.addEventListener(
    "click",
    () => {
        returnToMenu();
    }
);

pauseButton.addEventListener(
    "click",
    () => {
        returnToMenu();
    }
);

window.addEventListener(
    "keydown",
    (event) => {
        const key =
            event.key.toLowerCase();

        if (
            currentMode === "builder"
        ) {
            if (
                key === "q"
            ) {
                event.preventDefault();

                builderPreviewRotation -=
                    Math.PI / 12;

                updateBuilderPreview();

                return;
            }

            if (
                key === "e"
            ) {
                event.preventDefault();

                builderPreviewRotation +=
                    Math.PI / 12;

                updateBuilderPreview();

                return;
            }

            if (
                event.key === "Enter"
            ) {
                event.preventDefault();

                placeBuilderPiece();

                return;
            }

            if (
                key === "z"
            ) {
                event.preventDefault();

                undoBuilderPiece();

                return;
            }

            if (
                key === "x"
            ) {
                event.preventDefault();

                removePreview();

                builderStatus.textContent =
                    "Preview deleted.";

                return;
            }

            if (
                event.key === "Escape"
            ) {
                event.preventDefault();

                removePreview();

                builderStatus.textContent =
                    "Preview cancelled.";

                return;
            }
        }

        if (
            event.key === "ArrowUp" ||
            key === "w"
        ) {
            controls.throttle = true;
        }

        if (
            event.key === "ArrowDown" ||
            key === "s"
        ) {
            controls.brake = true;
        }

        if (
            event.key === "ArrowLeft" ||
            key === "a"
        ) {
            controls.left = true;
        }

        if (
            event.key === "ArrowRight" ||
            key === "d"
        ) {
            controls.right = true;
        }
    }
);

window.addEventListener(
    "keyup",
    (event) => {
        const key =
            event.key.toLowerCase();

        if (
            event.key === "ArrowUp" ||
            key === "w"
        ) {
            controls.throttle = false;
        }

        if (
            event.key === "ArrowDown" ||
            key === "s"
        ) {
            controls.brake = false;
        }

        if (
            event.key === "ArrowLeft" ||
            key === "a"
        ) {
            controls.left = false;
        }

        if (
            event.key === "ArrowRight" ||
            key === "d"
        ) {
            controls.right = false;
        }
    }
);

window.addEventListener(
    "resize",
    () => {
        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);

function animate() {
    requestAnimationFrame(
        animate
    );

    const now =
        performance.now();

    const delta =
        Math.min(
            (now -
                lastFrameTime) /
                1000,
            0.05
        );

    lastFrameTime =
        now;

    if (
        currentMode === "race"
    ) {
        updateRace(delta);

        followCamera.update(
            vehicle,
            delta
        );
    }

    renderer.render(
        scene,
        camera
    );
}

loadTrack(1);

showScreen(menu);

animate();