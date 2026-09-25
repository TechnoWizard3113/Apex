import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { Track } from "./track.js";
import { Vehicle } from "./vehicle.js";
import { FollowCamera } from "./camera.js";

const menu = document.getElementById("menu");
const trackSelect = document.getElementById("trackSelect");
const builder = document.getElementById("builder");

const playButton = document.getElementById("playButton");
const buildButton = document.getElementById("buildButton");
const tracksButton = document.getElementById("tracksButton");

const trackBackButton =
    document.getElementById("trackBackButton");

const testTrackButton =
    document.getElementById("testTrackButton");

const clearTrackButton =
    document.getElementById("clearTrackButton");

const builderBackButton =
    document.getElementById("builderBackButton");

const builderStatus =
    document.getElementById("builderStatus");

const game =
    document.getElementById("game");

const hud =
    document.getElementById("hud");

const timerElement =
    document.getElementById("timer");

const bestTimeElement =
    document.getElementById("bestTime");

const countdownElement =
    document.getElementById("countdown");

const speedElement =
    document.getElementById("speed");

const checkpointElement =
    document.getElementById("checkpoint");

const pauseButton =
    document.getElementById("pauseButton");

const TRACKS = {
    1: {
        id: 1,
        name: "Mountain Run"
    },

    2: {
        id: 2,
        name: "Speed Circuit"
    }
};

const LEADERBOARD_KEY =
    "apex-leaderboards";

let currentTrackId = 1;
let currentScreen = "menu";

let selectedPieceType = null;
let previewPiece = null;

let raceActive = false;
let countdownActive = false;
let raceFinished = false;

let raceStartTime = 0;
let elapsedTime = 0;

let lastFrameTime =
    performance.now();

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x101418);

scene.fog =
    new THREE.Fog(
        0x101418,
        180,
        900
    );

const camera =
    new THREE.PerspectiveCamera(
        70,
        window.innerWidth /
            window.innerHeight,
        0.1,
        2000
    );

camera.position.set(
    0,
    12,
    -20
);

const renderer =
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

renderer.shadowMap.enabled = true;

renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

renderer.domElement.style.position =
    "absolute";

renderer.domElement.style.left =
    "0";

renderer.domElement.style.top =
    "0";

renderer.domElement.style.width =
    "100%";

renderer.domElement.style.height =
    "100%";

renderer.domElement.style.zIndex =
    "0";

renderer.domElement.style.pointerEvents =
    "none";

game.insertBefore(
    renderer.domElement,
    game.firstChild
);

const ambientLight =
    new THREE.HemisphereLight(
        0xbfd7ff,
        0x1b211e,
        1.8
    );

scene.add(ambientLight);

const sun =
    new THREE.DirectionalLight(
        0xffffff,
        2.4
    );

sun.position.set(
    100,
    180,
    80
);

sun.castShadow = true;

sun.shadow.mapSize.width =
    2048;

sun.shadow.mapSize.height =
    2048;

sun.shadow.camera.left =
    -300;

sun.shadow.camera.right =
    300;

sun.shadow.camera.top =
    300;

sun.shadow.camera.bottom =
    -300;

scene.add(sun);

const track =
    new Track(scene);

const vehicle =
    new Vehicle(scene);

const followCamera =
    new FollowCamera(camera);

function loadLeaderboards() {
    try {
        const stored =
            localStorage.getItem(
                LEADERBOARD_KEY
            );

        if (!stored) {
            return {};
        }

        const parsed =
            JSON.parse(stored);

        if (
            typeof parsed !== "object" ||
            parsed === null
        ) {
            return {};
        }

        return parsed;
    } catch {
        return {};
    }
}

function saveLeaderboards(data) {
    localStorage.setItem(
        LEADERBOARD_KEY,
        JSON.stringify(data)
    );
}

function getTrackLeaderboard(trackId) {
    const data =
        loadLeaderboards();

    const entries =
        data[String(trackId)];

    if (!Array.isArray(entries)) {
        return [];
    }

    return entries
        .filter(
            (entry) =>
                entry &&
                typeof entry.time ===
                    "number"
        )
        .sort(
            (a, b) =>
                a.time - b.time
        );
}

function getPersonalBest(trackId) {
    const entries =
        getTrackLeaderboard(
            trackId
        );

    if (entries.length === 0) {
        return null;
    }

    return entries[0].time;
}

function recordTime(
    trackId,
    time
) {
    if (trackId === 0) {
        return;
    }

    const data =
        loadLeaderboards();

    const key =
        String(trackId);

    if (!Array.isArray(data[key])) {
        data[key] = [];
    }

    data[key].push({
        time,
        date:
            new Date().toISOString()
    });

    data[key].sort(
        (a, b) =>
            a.time - b.time
    );

    data[key] =
        data[key].slice(0, 100);

    saveLeaderboards(data);
}

function formatTime(milliseconds) {
    if (
        !Number.isFinite(
            milliseconds
        )
    ) {
        return "--:--.---";
    }

    const total =
        Math.floor(milliseconds);

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
        String(minutes).padStart(
            2,
            "0"
        ) +
        ":" +
        String(seconds).padStart(
            2,
            "0"
        ) +
        "." +
        String(millis).padStart(
            3,
            "0"
        )
    );
}

function updateBestTime() {
    const best =
        getPersonalBest(
            currentTrackId
        );

    bestTimeElement.textContent =
        best === null
            ? "--:--.---"
            : formatTime(best);
}

function hideScreens() {
    menu.classList.add("hidden");
    trackSelect.classList.add("hidden");
    builder.classList.add("hidden");

    hud.classList.add("hidden");
    pauseButton.classList.add("hidden");
}

function showMenu() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    menu.classList.remove("hidden");

    currentScreen = "menu";
}

function showTrackSelect() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    trackSelect.classList.remove(
        "hidden"
    );

    currentScreen =
        "trackSelect";
}

function showBuilder() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    builder.classList.remove(
        "hidden"
    );

    currentScreen =
        "builder";

    track.clear();

    selectedPieceType = null;

    removePreview();

    builderStatus.textContent =
        "Select a piece.";
}

function loadTrack(trackId) {
    currentTrackId =
        Number(trackId);

    if (currentTrackId === 1) {
        track.buildDefault();
    }

    if (currentTrackId === 2) {
        track.buildSpeedCircuit();
    }

    removePreview();

    updateBestTime();
}

function resetVehicle() {
    const spawn =
        track.getSpawn();

    vehicle.reset(
        spawn.position,
        spawn.yaw
    );
}

function startRace() {
    if (
        track.pieces.length === 0
    ) {
        return;
    }

    hideScreens();

    hud.classList.remove(
        "hidden"
    );

    pauseButton.classList.remove(
        "hidden"
    );

    currentScreen =
        "game";

    resetVehicle();

    raceFinished = false;
    raceActive = false;
    countdownActive = true;

    elapsedTime = 0;

    timerElement.textContent =
        "00:00.000";

    updateBestTime();

    countdownElement.textContent =
        "3";

    let count = 3;

    const interval =
        setInterval(() => {
            count -= 1;

            if (count > 0) {
                countdownElement.textContent =
                    String(count);

                return;
            }

            countdownElement.textContent =
                "GO";

            raceStartTime =
                performance.now();

            raceActive = true;
            countdownActive = false;

            clearInterval(interval);

            setTimeout(() => {
                countdownElement.textContent =
                    "";
            }, 700);
        }, 800);
}

function finishRace() {
    if (
        raceFinished ||
        !raceActive
    ) {
        return;
    }

    raceFinished = true;
    raceActive = false;

    elapsedTime =
        performance.now() -
        raceStartTime;

    timerElement.textContent =
        formatTime(elapsedTime);

    recordTime(
        currentTrackId,
        elapsedTime
    );

    updateBestTime();

    countdownElement.textContent =
        "FINISH";

    setTimeout(() => {
        countdownElement.textContent =
            "";
    }, 1500);
}

function updateRace(delta) {
    if (!raceActive) {
        return;
    }

    elapsedTime =
        performance.now() -
        raceStartTime;

    timerElement.textContent =
        formatTime(elapsedTime);

    vehicle.update(
        delta,
        {
            throttle: keys.forward,
            brake: keys.backward,
            left: keys.left,
            right: keys.right
        },
        track
    );

    const speed =
        Math.abs(
            vehicle.speed || 0
        );

    speedElement.textContent =
        `${Math.round(
            speed * 3.6
        )} KM/H`;

    updateCheckpoint();

    const finish =
        track.getFinish();

    const distance =
        vehicle.position.distanceTo(
            finish
        );

    if (distance < 9) {
        finishRace();
    }
}

function updateCheckpoint() {
    if (
        track.pieces.length === 0
    ) {
        return;
    }

    let closestIndex = 0;
    let closestDistance =
        Infinity;

    for (
        let i = 0;
        i < track.pieces.length;
        i += 1
    ) {
        const piece =
            track.pieces[i];

        const distance =
            piece.start.position.distanceTo(
                vehicle.position
            );

        if (
            distance <
            closestDistance
        ) {
            closestDistance =
                distance;

            closestIndex =
                i;
        }
    }

    checkpointElement.textContent =
        `CHECKPOINT ${
            closestIndex + 1
        }/${track.pieces.length}`;
}

function selectBuilderPiece(type) {
    selectedPieceType = type;

    addSelectedPiece();
}

function addSelectedPiece() {
    if (!selectedPieceType) {
        return;
    }

    removePreview();

    const piece =
        track.addPiece(
            selectedPieceType
        );

    if (!piece) {
        builderStatus.textContent =
            "PIECE WOULD OVERLAP ANOTHER PIECE.";

        createPreview();

        return;
    }

    builderStatus.textContent =
        `${selectedPieceType.toUpperCase()} ADDED`;

    createPreview();
}

function createPreview() {
    removePreview();

    if (!selectedPieceType) {
        return;
    }

    previewPiece =
        track.createPreview(
            selectedPieceType
        );

    if (!previewPiece) {
        return;
    }

    track.group.add(
        previewPiece.mesh
    );
}

function removePreview() {
    if (!previewPiece) {
        return;
    }

    track.group.remove(
        previewPiece.mesh
    );

    previewPiece.mesh.traverse(
        (object) => {
            if (
                object.isMesh &&
                object.geometry
            ) {
                object.geometry.dispose();
            }

            if (
                object.isMesh &&
                object.material
            ) {
                if (
                    Array.isArray(
                        object.material
                    )
                ) {
                    object.material.forEach(
                        (material) =>
                            material.dispose()
                    );
                } else {
                    object.material.dispose();
                }
            }
        }
    );

    previewPiece = null;
}

function clearBuilder() {
    removePreview();

    track.clear();

    selectedPieceType = null;

    builderStatus.textContent =
        "Track cleared. Select a piece.";
}

playButton.addEventListener(
    "click",
    () => {
        showTrackSelect();
    }
);

buildButton.addEventListener(
    "click",
    () => {
        showBuilder();
    }
);

tracksButton.addEventListener(
    "click",
    () => {
        showTrackSelect();
    }
);

trackBackButton.addEventListener(
    "click",
    () => {
        showMenu();
    }
);

builderBackButton.addEventListener(
    "click",
    () => {
        showMenu();
    }
);

clearTrackButton.addEventListener(
    "click",
    () => {
        clearBuilder();
    }
);

testTrackButton.addEventListener(
    "click",
    () => {
        if (
            track.pieces.length === 0
        ) {
            builderStatus.textContent =
                "Add at least one piece first.";

            return;
        }

        currentTrackId = 0;

        startRace();
    }
);

pauseButton.addEventListener(
    "click",
    () => {
        showMenu();
    }
);

document
    .querySelectorAll(
        ".track-option"
    )
    .forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                const id =
                    Number(
                        button.dataset.trackId
                    );

                if (
                    !TRACKS[id]
                ) {
                    return;
                }

                loadTrack(id);
                startRace();
            }
        );
    });

document
    .querySelectorAll(
        ".piece-buttons button"
    )
    .forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                selectBuilderPiece(
                    button.dataset.piece
                );
            }
        );
    });

window.addEventListener(
    "keydown",
    (event) => {
        if (
            event.code === "ArrowUp" ||
            event.code === "KeyW"
        ) {
            keys.forward = true;
        }

        if (
            event.code === "ArrowDown" ||
            event.code === "KeyS"
        ) {
            keys.backward = true;
        }

        if (
            event.code === "ArrowLeft" ||
            event.code === "KeyA"
        ) {
            keys.left = true;
        }

        if (
            event.code === "ArrowRight" ||
            event.code === "KeyD"
        ) {
            keys.right = true;
        }

        if (
            event.code === "Escape"
        ) {
            showMenu();
        }
    }
);

window.addEventListener(
    "keyup",
    (event) => {
        if (
            event.code === "ArrowUp" ||
            event.code === "KeyW"
        ) {
            keys.forward = false;
        }

        if (
            event.code === "ArrowDown" ||
            event.code === "KeyS"
        ) {
            keys.backward = false;
        }

        if (
            event.code === "ArrowLeft" ||
            event.code === "KeyA"
        ) {
            keys.left = false;
        }

        if (
            event.code === "ArrowRight" ||
            event.code === "KeyD"
        ) {
            keys.right = false;
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

function clampCameraHeight() {
    const trackHeight =
        track.getHeightAt(
            camera.position
        );

    if (
        Number.isFinite(
            trackHeight
        )
    ) {
        const minimumHeight =
            trackHeight + 3;

        if (
            camera.position.y <
            minimumHeight
        ) {
            camera.position.y =
                minimumHeight;
        }
    }

    if (
        camera.position.y < 1
    ) {
        camera.position.y = 1;
    }
}

function updateBuilderCamera(delta) {
    const target =
        track.pieces.length > 0
            ? track.pieces[
                track.pieces.length - 1
            ].end.position
            : track.startConnector.position;

    const desiredPosition =
        target.clone();

    desiredPosition.y += 55;
    desiredPosition.x += 45;
    desiredPosition.z += 45;

    const smoothing =
        1 -
        Math.pow(
            0.0001,
            delta
        );

    camera.position.lerp(
        desiredPosition,
        smoothing
    );

    const lookTarget =
        target.clone();

    lookTarget.y += 0.5;

    camera.lookAt(
        lookTarget
    );
}

function animate(currentTime) {
    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(
            (currentTime -
                lastFrameTime) /
                1000,
            0.05
        );

    lastFrameTime =
        currentTime;

    if (
        raceActive &&
        !countdownActive
    ) {
        updateRace(delta);
    }

    if (
        currentScreen === "game"
    ) {
        followCamera.update(
            vehicle,
            delta
        );

        clampCameraHeight();
    }

    if (
        currentScreen === "builder"
    ) {
        updateBuilderCamera(
            delta
        );
    }

    renderer.render(
        scene,
        camera
    );
}

track.buildDefault();

showMenu();

requestAnimationFrame(
    animate
);