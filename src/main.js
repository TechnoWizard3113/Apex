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

const undoButton =
    document.getElementById("undoButton");

const redoButton =
    document.getElementById("redoButton");

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

let currentMode = "menu";
let currentTrackId = 1;

let track = null;
let vehicle = null;
let followCamera = null;
let renderer = null;
let camera = null;
let scene = null;

let raceStarted = false;
let raceFinished = false;
let raceStartTime = 0;

let bestTime = null;
let checkpoint = 0;

let builderPieceType = null;
let builderRotation = 0;
let builderPreview = null;

let undoStack = [];
let redoStack = [];

let lastFrameTime = performance.now();

const controls = {
    throttle: false,
    brake: false,
    left: false,
    right: false
};

function showScreen(screen) {
    menu.classList.add("hidden");
    trackSelect.classList.add("hidden");
    builder.classList.add("hidden");

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
    if (!Number.isFinite(milliseconds)) {
        return "--:--.---";
    }

    const total =
        Math.max(
            0,
            Math.floor(milliseconds)
        );

    const minutes =
        Math.floor(
            total / 60000
        );

    const seconds =
        Math.floor(
            (total % 60000) / 1000
        );

    const millis =
        total % 1000;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(millis).padStart(3, "0")
    );
}

function loadBestTime() {
    const stored =
        localStorage.getItem(
            "apex-best-track-" +
            currentTrackId
        );

    bestTime =
        stored === null
            ? null
            : Number(stored);

    bestTimeElement.textContent =
        bestTime === null
            ? "--:--.---"
            : formatTime(bestTime);
}

function initializeGame() {
    if (renderer) {
        return;
    }

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x10151c
        );

    camera =
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

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.shadowMap.enabled =
        true;

    renderer.domElement.style.position =
        "absolute";

    renderer.domElement.style.inset =
        "0";

    renderer.domElement.style.pointerEvents =
        "none";

    game.appendChild(
        renderer.domElement
    );

    const ambient =
        new THREE.HemisphereLight(
            0xffffff,
            0x243020,
            1.6
        );

    scene.add(ambient);

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

    sun.shadow.mapSize.width =
        2048;

    sun.shadow.mapSize.height =
        2048;

    scene.add(sun);

    track =
        new Track(scene);

    vehicle =
        new Vehicle(scene);

    followCamera =
        new FollowCamera(camera);

    loadTrack(
        currentTrackId
    );

    requestAnimationFrame(
        animate
    );
}

function loadTrack(id) {
    if (!track) {
        return;
    }

    currentTrackId = id;

    if (id === 1) {
        track.buildDefault();
    } else {
        track.buildSpeedCircuit();
    }

    loadBestTime();

    resetRace();
}

function resetRace() {
    if (!track || !vehicle) {
        return;
    }

    const spawn =
        track.getSpawn();

    vehicle.reset(
        spawn.position,
        spawn.yaw
    );

    if (followCamera) {
        followCamera.reset();
    }

    raceStarted = false;
    raceFinished = false;
    raceStartTime = 0;
    checkpoint = 0;

    timerElement.textContent =
        "00:00.000";

    speedElement.textContent =
        "0 KM/H";

    checkpointElement.textContent =
        "CHECKPOINT 0/" +
        track.checkpoints.length;

    countdownElement.textContent =
        "";
}

function startRace() {
    initializeGame();

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
        setInterval(
            () => {
                index++;

                if (
                    index >=
                    values.length
                ) {
                    clearInterval(
                        interval
                    );

                    countdownElement.textContent =
                        "";

                    raceStarted = true;

                    raceStartTime =
                        performance.now();

                    return;
                }

                countdownElement.textContent =
                    values[index];
            },
            750
        );
}

function checkCheckpoints() {
    if (!track || !vehicle) {
        return;
    }

    if (
        checkpoint >=
        track.checkpoints.length
    ) {
        return;
    }

    const target =
        track.checkpoints[
            checkpoint
        ];

    const distance =
        vehicle.position.distanceTo(
            target
        );

    if (distance < 12) {
        checkpoint++;

        checkpointElement.textContent =
            "CHECKPOINT " +
            checkpoint +
            "/" +
            track.checkpoints.length;
    }
}

function checkFinish() {
    if (!track || !vehicle) {
        return;
    }

    if (
        checkpoint <
        track.checkpoints.length
    ) {
        return;
    }

    const finish =
        track.getFinish();

    const distance =
        vehicle.position.distanceTo(
            finish
        );

    if (
        distance < 12
    ) {
        finishRace();
    }
}

function finishRace() {
    if (
        raceFinished ||
        !raceStarted
    ) {
        return;
    }

    raceFinished = true;

    const time =
        performance.now() -
        raceStartTime;

    timerElement.textContent =
        formatTime(time);

    if (
        bestTime === null ||
        time < bestTime
    ) {
        bestTime = time;

        localStorage.setItem(
            "apex-best-track-" +
            currentTrackId,
            String(time)
        );

        bestTimeElement.textContent =
            formatTime(time);
    }
}

function updateRace(delta) {
    if (!vehicle || !track) {
        return;
    }

    vehicle.update(
        delta,
        controls,
        track
    );

    speedElement.textContent =
        Math.round(
            vehicle.speed * 3.6
        ) +
        " KM/H";

    if (
        raceStarted &&
        !raceFinished
    ) {
        const elapsed =
            performance.now() -
            raceStartTime;

        timerElement.textContent =
            formatTime(elapsed);

        checkCheckpoints();
        checkFinish();
    }

    followCamera.update(
        vehicle,
        delta
    );
}

function enterBuilder() {
    initializeGame();

    currentMode = "builder";

    showScreen(builder);

    track.clear();

    builderPieceType = null;
    builderRotation = 0;

    undoStack = [];
    redoStack = [];

    removeBuilderPreview();

    builderStatus.textContent =
        "Select a piece.";
}

function createBuilderPreview(
    type
) {
    if (!track) {
        return;
    }

    removeBuilderPreview();

    builderPieceType = type;
    builderRotation = 0;

    builderPreview =
        track.createPreview(
            type,
            builderRotation
        );

    scene.add(
        builderPreview.group
    );

    updateBuilderPreview();

    builderStatus.textContent =
        "Q/E rotate. ENTER place. ESC cancel.";
}

function removeBuilderPreview() {
    if (
        builderPreview &&
        builderPreview.group
    ) {
        scene.remove(
            builderPreview.group
        );
    }

    builderPreview = null;
}

function updateBuilderPreview() {
    if (
        !builderPreview ||
        !builderPieceType ||
        !track
    ) {
        return;
    }

    scene.remove(
        builderPreview.group
    );

    builderPreview =
        track.createPreview(
            builderPieceType,
            builderRotation
        );

    scene.add(
        builderPreview.group
    );

    const valid =
        track.canAdd(
            builderPieceType,
            builderRotation
        );

    builderPreview.group.traverse(
        object => {
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
                0.45;

            object.material.depthWrite =
                false;

            object.material.color.set(
                valid
                    ? 0x32d583
                    : 0xd83232
            );
        }
    );
}

function placeBuilderPiece() {
    if (
        !builderPieceType ||
        !track
    ) {
        return;
    }

    const valid =
        track.canAdd(
            builderPieceType,
            builderRotation
        );

    if (!valid) {
        builderStatus.textContent =
            "Invalid placement.";

        return;
    }

    const piece =
        track.addPiece(
            builderPieceType,
            builderRotation
        );

    if (!piece) {
        builderStatus.textContent =
            "Invalid placement.";

        return;
    }

    undoStack.push({
        type:
            builderPieceType,

        rotation:
            builderRotation
    });

    redoStack = [];

    builderStatus.textContent =
        "Piece placed.";

    createBuilderPreview(
        builderPieceType
    );
}

function rebuildFromHistory() {
    if (!track) {
        return;
    }

    track.clear();

    for (
        const entry
        of undoStack
    ) {
        track.addPiece(
            entry.type,
            entry.rotation
        );
    }

    updateBuilderPreview();
}

function undoBuilder() {
    if (
        undoStack.length === 0
    ) {
        builderStatus.textContent =
            "Nothing to undo.";

        return;
    }

    const removed =
        undoStack.pop();

    redoStack.push(
        removed
    );

    rebuildFromHistory();

    builderStatus.textContent =
        "Last piece removed.";
}

function redoBuilder() {
    if (
        redoStack.length === 0
    ) {
        builderStatus.textContent =
            "Nothing to redo.";

        return;
    }

    const entry =
        redoStack.pop();

    const valid =
        track.canAdd(
            entry.type,
            entry.rotation
        );

    if (!valid) {
        builderStatus.textContent =
            "Cannot redo this piece.";

        return;
    }

    undoStack.push(
        entry
    );

    rebuildFromHistory();

    builderStatus.textContent =
        "Piece restored.";
}

function clearBuilder() {
    if (!track) {
        return;
    }

    track.clear();

    undoStack = [];
    redoStack = [];

    removeBuilderPreview();

    builderPieceType = null;
    builderRotation = 0;

    builderStatus.textContent =
        "Track cleared. Select a piece.";
}

function testBuilderTrack() {
    if (!track) {
        return;
    }

    if (
        track.pieces.length < 2
    ) {
        builderStatus.textContent =
            "Add at least two pieces first.";

        return;
    }

    removeBuilderPreview();

    currentMode = "race";

    showScreen(game);

    resetRace();

    runCountdown();
}

function returnToMenu() {
    removeBuilderPreview();

    currentMode = "menu";

    showScreen(menu);
}

playButton.addEventListener(
    "click",
    () => {
        initializeGame();
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
        currentMode =
            "trackSelect";

        showScreen(
            trackSelect
        );
    }
);

trackBackButton.addEventListener(
    "click",
    () => {
        currentMode =
            "menu";

        showScreen(menu);
    }
);

document
    .querySelectorAll(
        ".track-option"
    )
    .forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        Number(
                            button.dataset.trackId
                        );

                    initializeGame();

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
        button => {
            button.addEventListener(
                "click",
                () => {
                    createBuilderPreview(
                        button.dataset.piece
                    );
                }
            );
        }
    );

testTrackButton.addEventListener(
    "click",
    testBuilderTrack
);

clearTrackButton.addEventListener(
    "click",
    clearBuilder
);

undoButton.addEventListener(
    "click",
    undoBuilder
);

redoButton.addEventListener(
    "click",
    redoBuilder
);

builderBackButton.addEventListener(
    "click",
    returnToMenu
);

pauseButton.addEventListener(
    "click",
    returnToMenu
);

window.addEventListener(
    "keydown",
    event => {
        const key =
            event.key.toLowerCase();

        if (
            currentMode ===
            "builder"
        ) {
            if (
                key === "q" &&
                builderPreview
            ) {
                event.preventDefault();

                builderRotation -=
                    Math.PI / 12;

                updateBuilderPreview();

                return;
            }

            if (
                key === "e" &&
                builderPreview
            ) {
                event.preventDefault();

                builderRotation +=
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
                event.key === "Escape"
            ) {
                event.preventDefault();

                removeBuilderPreview();

                builderPieceType = null;

                builderStatus.textContent =
                    "Preview cancelled.";

                return;
            }

            if (
                key === "z"
            ) {
                event.preventDefault();

                undoBuilder();

                return;
            }

            if (
                key === "y"
            ) {
                event.preventDefault();

                redoBuilder();

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
    event => {
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
        if (!camera || !renderer) {
            return;
        }

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
            (now - lastFrameTime) /
                1000,
            0.05
        );

    lastFrameTime = now;

    if (
        currentMode === "race"
    ) {
        updateRace(delta);
    }

    if (
        renderer &&
        scene &&
        camera
    ) {
        renderer.render(
            scene,
            camera
        );
    }
}

showScreen(menu);