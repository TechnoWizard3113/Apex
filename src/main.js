import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { Track } from "./track.js";
import { Vehicle } from "./vehicle.js";
import { FollowCamera } from "./camera.js";

const menu = document.getElementById("menu");
const trackSelect = document.getElementById("trackSelect");
const leaderboard = document.getElementById("leaderboard");
const builder = document.getElementById("builder");

const playButton = document.getElementById("playButton");
const buildButton = document.getElementById("buildButton");
const tracksButton = document.getElementById("tracksButton");
const leaderboardButton = document.getElementById("leaderboardButton");

const menuBest = document.getElementById("menuBest");

const trackBackButton = document.getElementById("trackBackButton");
const leaderboardBackButton = document.getElementById("leaderboardBackButton");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardTitle = document.getElementById("leaderboardTitle");

const testTrackButton = document.getElementById("testTrackButton");
const clearTrackButton = document.getElementById("clearTrackButton");
const builderBackButton = document.getElementById("builderBackButton");
const builderStatus = document.getElementById("builderStatus");

const game = document.getElementById("game");
const hud = document.getElementById("hud");
const timerElement = document.getElementById("timer");
const bestTimeElement = document.getElementById("bestTime");
const countdownElement = document.getElementById("countdown");
const speedElement = document.getElementById("speed");
const checkpointElement = document.getElementById("checkpoint");
const pauseButton = document.getElementById("pauseButton");

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

const LEADERBOARD_KEY = "apex-leaderboards";

let currentTrackId = 1;
let currentScreen = "menu";

let selectedPieceType = null;
let previewPiece = null;

let raceActive = false;
let countdownActive = false;
let raceStartTime = 0;
let elapsedTime = 0;
let raceFinished = false;

let lastFrameTime = performance.now();

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x101418);

scene.fog = new THREE.Fog(
    0x101418,
    180,
    900
);

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);

camera.position.set(
    0,
    12,
    -20
);

const renderer = new THREE.WebGLRenderer({
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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.domElement.style.position = "absolute";
renderer.domElement.style.left = "0";
renderer.domElement.style.top = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.zIndex = "0";

game.insertBefore(
    renderer.domElement,
    game.firstChild
);

hud.style.position = "relative";
hud.style.zIndex = "10";

pauseButton.style.position = "relative";
pauseButton.style.zIndex = "10";

const ambientLight = new THREE.HemisphereLight(
    0xbfd7ff,
    0x1b211e,
    1.8
);

scene.add(ambientLight);

const sun = new THREE.DirectionalLight(
    0xffffff,
    2.4
);

sun.position.set(
    100,
    180,
    80
);

sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;

scene.add(sun);

const track = new Track(scene);

const vehicle = new Vehicle(scene);

const followCamera = new FollowCamera(camera);

let currentTrackName = TRACKS[1].name;

function loadLeaderboards() {
    try {
        const stored = localStorage.getItem(
            LEADERBOARD_KEY
        );

        if (!stored) {
            return {};
        }

        const parsed = JSON.parse(stored);

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
    const data = loadLeaderboards();

    const entries = data[String(trackId)];

    if (!Array.isArray(entries)) {
        return [];
    }

    return entries
        .filter((entry) => {
            return (
                entry &&
                typeof entry.time === "number"
            );
        })
        .sort((a, b) => a.time - b.time);
}

function getPersonalBest(trackId) {
    const leaderboardEntries =
        getTrackLeaderboard(trackId);

    if (leaderboardEntries.length === 0) {
        return null;
    }

    return leaderboardEntries[0].time;
}

function recordTime(trackId, time) {
    if (trackId === 0) {
        return;
    }

    const data = loadLeaderboards();
    const key = String(trackId);

    if (!Array.isArray(data[key])) {
        data[key] = [];
    }

    data[key].push({
        time,
        date: new Date().toISOString()
    });

    data[key].sort(
        (a, b) => a.time - b.time
    );

    data[key] = data[key].slice(0, 100);

    saveLeaderboards(data);
}

function formatTime(milliseconds) {
    if (
        !Number.isFinite(milliseconds) ||
        milliseconds < 0
    ) {
        return "--:--.---";
    }

    const totalMilliseconds =
        Math.floor(milliseconds);

    const minutes =
        Math.floor(
            totalMilliseconds / 60000
        );

    const seconds =
        Math.floor(
            (totalMilliseconds % 60000) / 1000
        );

    const millis =
        totalMilliseconds % 1000;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(millis).padStart(3, "0")
    );
}

function updatePersonalBestDisplay() {
    const best =
        getPersonalBest(currentTrackId);

    const formatted =
        best === null
            ? "--:--.---"
            : formatTime(best);

    menuBest.textContent = formatted;
    bestTimeElement.textContent = formatted;
}

function updateLeaderboard() {
    const trackInfo =
        TRACKS[currentTrackId];

    if (trackInfo) {
        leaderboardTitle.textContent =
            `${trackInfo.name} LEADERBOARD`;
    } else {
        leaderboardTitle.textContent =
            "CUSTOM TRACK LEADERBOARD";
    }

    leaderboardList.innerHTML = "";

    const entries =
        getTrackLeaderboard(currentTrackId);

    if (entries.length === 0) {
        const empty = document.createElement("div");

        empty.className =
            "leaderboard-empty";

        empty.textContent =
            "NO TIMES RECORDED";

        leaderboardList.appendChild(empty);

        return;
    }

    entries.forEach((entry, index) => {
        const row =
            document.createElement("div");

        row.className =
            "leaderboard-row";

        const position =
            document.createElement("span");

        position.className =
            "leaderboard-position";

        position.textContent =
            `${index + 1}.`;

        const time =
            document.createElement("span");

        time.className =
            "leaderboard-time";

        time.textContent =
            formatTime(entry.time);

        row.appendChild(position);
        row.appendChild(time);

        leaderboardList.appendChild(row);
    });
}

function hideScreens() {
    menu.classList.add("hidden");
    trackSelect.classList.add("hidden");
    leaderboard.classList.add("hidden");
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

    updatePersonalBestDisplay();
}

function showTrackSelect() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    trackSelect.classList.remove("hidden");

    currentScreen = "trackSelect";
}

function showLeaderboard() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    leaderboard.classList.remove("hidden");

    currentScreen = "leaderboard";

    updateLeaderboard();
}

function showBuilder() {
    raceActive = false;
    countdownActive = false;

    hideScreens();

    builder.classList.remove("hidden");

    currentScreen = "builder";

    track.clear();

    selectedPieceType = null;

    removePreview();

    builderStatus.textContent =
        "Select a piece.";

    updateBuilderMarkers();
}

function updateBuilderMarkers() {
    if (track.startMarker) {
        track.startMarker.visible = true;
    }

    if (track.endMarker) {
        track.endMarker.visible = true;
    }
}

function loadTrack(trackId) {
    currentTrackId = Number(trackId);

    const trackInfo =
        TRACKS[currentTrackId];

    if (!trackInfo) {
        return;
    }

    currentTrackName =
        trackInfo.name;

    if (currentTrackId === 1) {
        track.buildDefault();
    } else if (currentTrackId === 2) {
        track.buildSpeedCircuit();
    }

    removePreview();

    updatePersonalBestDisplay();
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
    if (track.pieces.length === 0) {
        builderStatus.textContent =
            "Add track pieces before testing.";

        return;
    }

    hideScreens();

    hud.classList.remove("hidden");
    pauseButton.classList.remove("hidden");

    currentScreen = "game";

    loadRaceTrackState();

    countdownActive = true;
    raceActive = false;
    raceFinished = false;

    countdownElement.textContent = "3";

    let count = 3;

    const interval =
        setInterval(() => {
            count -= 1;

            if (count > 0) {
                countdownElement.textContent =
                    String(count);

                return;
            }

            if (count === 0) {
                countdownElement.textContent =
                    "GO";

                raceStartTime =
                    performance.now();

                elapsedTime = 0;

                raceActive = true;
                countdownActive = false;

                setTimeout(() => {
                    countdownElement.textContent =
                        "";
                }, 700);

                clearInterval(interval);
            }
        }, 800);
}

function loadRaceTrackState() {
    resetVehicle();

    const best =
        getPersonalBest(currentTrackId);

    bestTimeElement.textContent =
        best === null
            ? "--:--.---"
            : formatTime(best);

    timerElement.textContent =
        "00:00.000";

    speedElement.textContent =
        "0 KM/H";

    checkpointElement.textContent =
        "CHECKPOINT 1";

    followCamera.reset();
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

    const best =
        getPersonalBest(currentTrackId);

    bestTimeElement.textContent =
        formatTime(best);

    updatePersonalBestDisplay();

    countdownElement.textContent =
        "FINISH";

    setTimeout(() => {
        countdownElement.textContent =
            "";
    }, 1500);
}

function getVehicleDistanceToFinish() {
    const finish =
        track.getFinish();

    if (!finish) {
        return Infinity;
    }

    return vehicle.position.distanceTo(
        finish
    );
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

    updateVehicle(delta);

    const distance =
        getVehicleDistanceToFinish();

    if (distance < 9) {
        finishRace();
    }
}

function updateVehicle(delta) {
    const controls = {
        throttle: keys.forward,
        brake: keys.backward,
        left: keys.left,
        right: keys.right
    };

    vehicle.update(
        delta,
        controls,
        track
    );

    const speed =
        Math.abs(vehicle.speed || 0);

    speedElement.textContent =
        `${Math.round(speed * 3.6)} KM/H`;

    updateCheckpoint();
}

function updateCheckpoint() {
    const pieceCount =
        track.pieces.length;

    if (pieceCount === 0) {
        checkpointElement.textContent =
            "CHECKPOINT 1";

        return;
    }

    let closestIndex = 0;
    let closestDistance = Infinity;

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

        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
    }

    checkpointElement.textContent =
        `CHECKPOINT ${closestIndex + 1}/${pieceCount}`;
}

function selectBuilderPiece(type) {
    selectedPieceType = type;

    createPreview();

    builderStatus.textContent =
        `${type.toUpperCase()} SELECTED`;
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

    builderStatus.textContent =
        `${selectedPieceType.toUpperCase()} READY TO PLACE`;
}

function addSelectedPiece() {
    if (!selectedPieceType) {
        builderStatus.textContent =
            "Select a piece first.";

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

function clearBuilder() {
    track.clear();

    selectedPieceType = null;

    removePreview();

    builderStatus.textContent =
        "Track cleared. Select a piece.";

    updateBuilderMarkers();
}

function handleTrackSelection(button) {
    const rawId =
        button.dataset.trackId;

    const trackId =
        Number(rawId);

    if (!Number.isInteger(trackId)) {
        return;
    }

    if (!TRACKS[trackId]) {
        return;
    }

    currentTrackId = trackId;

    loadTrack(trackId);

    startRace();
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

leaderboardButton.addEventListener(
    "click",
    () => {
        showLeaderboard();
    }
);

trackBackButton.addEventListener(
    "click",
    () => {
        showMenu();
    }
);

leaderboardBackButton.addEventListener(
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

testTrackButton.addEventListener(
    "click",
    () => {
        if (track.pieces.length === 0) {
            builderStatus.textContent =
                "Add at least one piece first.";

            return;
        }

        currentTrackId = 0;
        currentTrackName =
            "Custom Track";

        startRace();
    }
);

clearTrackButton.addEventListener(
    "click",
    () => {
        clearBuilder();
    }
);

pauseButton.addEventListener(
    "click",
    () => {
        showMenu();
    }
);

document
    .querySelectorAll(".track-option")
    .forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                handleTrackSelection(button);
            }
        );
    });

document
    .querySelectorAll(".piece-buttons button")
    .forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                selectBuilderPiece(
                    button.dataset.piece
                );

                addSelectedPiece();
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
            event.code === "Escape" &&
            currentScreen !== "menu"
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

    const minimumHeight =
        trackHeight + 3;

    if (
        Number.isFinite(minimumHeight) &&
        camera.position.y <
            minimumHeight
    ) {
        camera.position.y =
            minimumHeight;
    }

    if (camera.position.y < 1) {
        camera.position.y = 1;
    }
}

function animate(currentTime) {
    requestAnimationFrame(animate);

    const delta =
        Math.min(
            (currentTime - lastFrameTime) / 1000,
            0.05
        );

    lastFrameTime = currentTime;

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
    } else if (
        currentScreen === "builder"
    ) {
        updateBuilderCamera(delta);
    }

    renderer.render(
        scene,
        camera
    );
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
        1 - Math.pow(0.0001, delta);

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

track.buildDefault();

updatePersonalBestDisplay();

showMenu();

requestAnimationFrame(
    animate
);