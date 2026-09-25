import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { Track } from "./track.js";
import { Vehicle } from "./vehicle.js";
import { FollowCamera } from "./camera.js";

const canvas = document.getElementById("game");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151a);
scene.fog = new THREE.Fog(0x10151a, 180, 900);

const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    2500
);

const renderer = new THREE.WebGLRenderer({
    canvas,
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

const clock = new THREE.Clock();

const track = new Track(scene);
const vehicle = new Vehicle(scene);
const followCamera = new FollowCamera(camera);

let currentTrackId = 1;
let currentTrackName = "Mountain Run";

let gameState = "menu";
let raceRunning = false;
let raceFinished = false;

let countdown = 0;
let countdownTimer = 0;

let raceTime = 0;
let startTime = 0;

let selectedBuilderPiece = "straight";
let previewPiece = null;

const keys = {};

const LEADERBOARD_KEY = "apex-leaderboards";

const TRACKS = {
    1: {
        id: 1,
        name: "Mountain Run",
        build() {
            track.buildDefault();
        }
    },

    2: {
        id: 2,
        name: "Speed Circuit",
        build() {
            track.buildSpeedCircuit();
        }
    }
};

function $(id) {
    return document.getElementById(id);
}

function show(element, visible) {
    if (!element) {
        return;
    }

    element.style.display = visible ? "" : "none";
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}

function loadLeaderboards() {
    try {
        const raw =
            localStorage.getItem(LEADERBOARD_KEY);

        if (!raw) {
            return {};
        }

        const data = JSON.parse(raw);

        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return {};
        }

        return data;
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

function saveTime(trackId, time) {
    const leaderboards = loadLeaderboards();
    const id = String(trackId);

    if (!leaderboards[id]) {
        leaderboards[id] = [];
    }

    leaderboards[id].push({
        time,
        date: Date.now()
    });

    leaderboards[id].sort(
        (a, b) => a.time - b.time
    );

    leaderboards[id] =
        leaderboards[id].slice(0, 10);

    saveLeaderboards(leaderboards);
}

function getLeaderboard(trackId) {
    const leaderboards = loadLeaderboards();
    const id = String(trackId);

    return leaderboards[id] || [];
}

function getPersonalBest(trackId) {
    const leaderboard =
        getLeaderboard(trackId);

    if (leaderboard.length === 0) {
        return null;
    }

    return leaderboard[0].time;
}

function formatTime(seconds) {
    if (
        seconds === null ||
        seconds === undefined ||
        !Number.isFinite(seconds)
    ) {
        return "--:--.---";
    }

    const minutes =
        Math.floor(seconds / 60);

    const remaining =
        seconds - minutes * 60;

    const secondsText =
        remaining.toFixed(3).padStart(6, "0");

    return `${minutes}:${secondsText}`;
}

function updatePersonalBest() {
    const best =
        getPersonalBest(currentTrackId);

    setText(
        "personal-best",
        best === null
            ? "--:--.---"
            : formatTime(best)
    );
}

function updateLeaderboardScreen() {
    const list = $("leaderboard-list");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const leaderboard =
        getLeaderboard(currentTrackId);

    if (leaderboard.length === 0) {
        const empty = document.createElement("div");

        empty.className = "leaderboard-empty";
        empty.textContent =
            "No times recorded for this track.";

        list.appendChild(empty);
        return;
    }

    leaderboard.forEach((entry, index) => {
        const row =
            document.createElement("div");

        row.className = "leaderboard-row";

        const position =
            document.createElement("span");

        position.textContent =
            String(index + 1);

        const time =
            document.createElement("span");

        time.textContent =
            formatTime(entry.time);

        row.appendChild(position);
        row.appendChild(time);

        list.appendChild(row);
    });
}

function hideAllScreens() {
    show($("main-menu"), false);
    show($("track-select"), false);
    show($("leaderboard-screen"), false);
    show($("builder-screen"), false);
    show($("game-ui"), false);
}

function showMenu() {
    gameState = "menu";
    raceRunning = false;
    raceFinished = false;

    removePreview();

    hideAllScreens();
    show($("main-menu"), true);

    updatePersonalBest();

    if (track.environment) {
        track.environment.visible = false;
    }

    track.group.visible = false;
    track.startMarker.visible = false;
    track.endMarker.visible = false;

    vehicle.mesh.visible = false;
}

function showTrackSelect() {
    gameState = "track-select";

    hideAllScreens();
    show($("track-select"), true);

    if (track.environment) {
        track.environment.visible = false;
    }

    track.group.visible = false;
    track.startMarker.visible = false;
    track.endMarker.visible = false;

    vehicle.mesh.visible = false;
}

function showLeaderboard() {
    gameState = "leaderboard";

    hideAllScreens();
    show($("leaderboard-screen"), true);

    const title = $("leaderboard-title");

    if (title) {
        title.textContent =
            `${currentTrackName} Leaderboard`;
    }

    updateLeaderboardScreen();

    if (track.environment) {
        track.environment.visible = false;
    }

    track.group.visible = false;
    track.startMarker.visible = false;
    track.endMarker.visible = false;

    vehicle.mesh.visible = false;
}

function showBuilder() {
    gameState = "builder";

    raceRunning = false;
    raceFinished = false;

    hideAllScreens();

    show($("builder-screen"), true);
    show($("game-ui"), false);

    loadCurrentTrack();

    track.environment.visible = true;
    track.group.visible = true;
    track.startMarker.visible = true;
    track.endMarker.visible = true;

    vehicle.mesh.visible = false;

    createPreview();

    updateBuilderStatus();
}

function loadCurrentTrack() {
    const definition =
        TRACKS[currentTrackId];

    if (!definition) {
        return;
    }

    definition.build();
}

function startRace(trackId) {
    if (!TRACKS[trackId]) {
        return;
    }

    currentTrackId = Number(trackId);
    currentTrackName =
        TRACKS[currentTrackId].name;

    gameState = "race";

    raceRunning = false;
    raceFinished = false;

    raceTime = 0;
    startTime = 0;

    removePreview();

    loadCurrentTrack();

    track.environment.visible = true;
    track.group.visible = true;
    track.startMarker.visible = true;
    track.endMarker.visible = true;

    vehicle.mesh.visible = true;

    const spawn =
        track.getSpawn();

    vehicle.reset(
        spawn.position,
        spawn.yaw
    );

    followCamera.reset();

    countdown = 3;
    countdownTimer = 0;

    hideAllScreens();
    show($("game-ui"), true);

    setText("time", "0:00.000");
    setText(
        "best",
        getPersonalBest(currentTrackId) === null
            ? "--:--.---"
            : formatTime(
                getPersonalBest(currentTrackId)
            )
    );

    updateCountdownText();
}

function updateCountdownText() {
    const element = $("countdown");

    if (!element) {
        return;
    }

    if (countdown > 0) {
        element.textContent =
            String(countdown);
        element.style.display = "";
    } else if (countdown === 0) {
        element.textContent = "GO";
        element.style.display = "";
    } else {
        element.style.display = "none";
    }
}

function finishRace() {
    if (raceFinished) {
        return;
    }

    raceFinished = true;
    raceRunning = false;

    saveTime(
        currentTrackId,
        raceTime
    );

    updatePersonalBest();
    updateLeaderboardScreen();

    setText(
        "time",
        formatTime(raceTime)
    );

    const countdownElement =
        $("countdown");

    if (countdownElement) {
        countdownElement.textContent =
            formatTime(raceTime);

        countdownElement.style.display =
            "";
    }

    setTimeout(() => {
        if (gameState !== "race") {
            return;
        }

        showMenu();
    }, 2500);
}

function checkFinish() {
    if (
        !raceRunning ||
        raceFinished
    ) {
        return;
    }

    const finish =
        track.getFinish();

    const distance =
        vehicle.position.distanceTo(
            finish
        );

    if (distance < 8) {
        finishRace();
    }
}

function createPreview() {
    removePreview();

    if (gameState !== "builder") {
        return;
    }

    previewPiece =
        track.createPreview(
            selectedBuilderPiece
        );

    if (!previewPiece) {
        return;
    }

    previewPiece.mesh.userData.isPreview =
        true;

    track.group.add(
        previewPiece.mesh
    );
}

function removePreview() {
    if (!previewPiece) {
        return;
    }

    if (
        previewPiece.mesh.parent
    ) {
        previewPiece.mesh.parent.remove(
            previewPiece.mesh
        );
    }

    previewPiece = null;
}

function updatePreview() {
    if (
        gameState !== "builder"
    ) {
        return;
    }

    if (!previewPiece) {
        createPreview();
        return;
    }

    const connector =
        track.getCurrentConnector();

    const preview =
        new THREE.Vector3();

    preview.copy(
        connector.position
    );

    previewPiece.mesh.position.set(
        0,
        0,
        0
    );

    previewPiece.mesh.rotation.set(
        0,
        0,
        0
    );

    previewPiece.mesh.traverse(
        (object) => {
            if (!object.isMesh) {
                return;
            }

            object.material.opacity =
                0.35;
        }
    );
}

function addBuilderPiece(type) {
    if (gameState !== "builder") {
        return;
    }

    const piece =
        track.addPiece(type);

    if (!piece) {
        updateBuilderStatus(
            "Cannot place piece here."
        );

        return;
    }

    selectedBuilderPiece = type;

    createPreview();

    updateBuilderStatus();
}

function updateBuilderStatus(message = null) {
    const status =
        $("builder-status");

    if (!status) {
        return;
    }

    if (message) {
        status.textContent =
            message;

        return;
    }

    const connector =
        track.getCurrentConnector();

    status.textContent =
        `Pieces: ${track.pieces.length} | ` +
        `End: ${connector.position.x.toFixed(1)}, ` +
        `${connector.position.y.toFixed(1)}, ` +
        `${connector.position.z.toFixed(1)}`;
}

function clearBuilder() {
    if (gameState !== "builder") {
        return;
    }

    track.clear();

    createPreview();

    updateBuilderStatus();
}

function testBuilderTrack() {
    if (track.pieces.length === 0) {
        updateBuilderStatus(
            "Add at least one piece first."
        );

        return;
    }

    currentTrackName = "Custom Track";
    currentTrackId = 0;

    gameState = "race";

    raceRunning = false;
    raceFinished = false;

    raceTime = 0;

    removePreview();

    track.environment.visible = true;
    track.group.visible = true;
    track.startMarker.visible = true;
    track.endMarker.visible = true;

    vehicle.mesh.visible = true;

    const spawn =
        track.getSpawn();

    vehicle.reset(
        spawn.position,
        spawn.yaw
    );

    followCamera.reset();

    countdown = 3;
    countdownTimer = 0;

    hideAllScreens();
    show($("game-ui"), true);

    setText(
        "time",
        "0:00.000"
    );

    setText(
        "best",
        "--:--.---"
    );

    updateCountdownText();
}

function handleMenuButtons() {
    const playButton =
        $("play-button");

    if (playButton) {
        playButton.addEventListener(
            "click",
            showTrackSelect
        );
    }

    const buildButton =
        $("build-button");

    if (buildButton) {
        buildButton.addEventListener(
            "click",
            showBuilder
        );
    }

    const leaderboardButton =
        $("leaderboard-button");

    if (leaderboardButton) {
        leaderboardButton.addEventListener(
            "click",
            () => {
                updateLeaderboardScreen();
                showLeaderboard();
            }
        );
    }

    const menuButton =
        $("menu-button");

    if (menuButton) {
        menuButton.addEventListener(
            "click",
            showMenu
        );
    }

    const backButton =
        $("back-button");

    if (backButton) {
        backButton.addEventListener(
            "click",
            showMenu
        );
    }

    const tracksBackButton =
        $("tracks-back");

    if (tracksBackButton) {
        tracksBackButton.addEventListener(
            "click",
            showMenu
        );
    }

    const leaderboardBackButton =
        $("leaderboard-back");

    if (leaderboardBackButton) {
        leaderboardBackButton.addEventListener(
            "click",
            showMenu
        );
    }
}

function handleTrackButtons() {
    document
        .querySelectorAll(
            "[data-track-id]"
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

                    startRace(id);
                }
            );
        });
}

function handleBuilderButtons() {
    document
        .querySelectorAll(
            "[data-piece]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const type =
                        button.dataset.piece;

                    selectedBuilderPiece =
                        type;

                    createPreview();

                    updateBuilderStatus();
                }
            );
        });

    const testButton =
        $("test-track");

    if (testButton) {
        testButton.addEventListener(
            "click",
            testBuilderTrack
        );
    }

    const clearButton =
        $("clear-track");

    if (clearButton) {
        clearButton.addEventListener(
            "click",
            clearBuilder
        );
    }

    const builderBack =
        $("builder-back");

    if (builderBack) {
        builderBack.addEventListener(
            "click",
            showMenu
        );
    }
}

function setupInput() {
    window.addEventListener(
        "keydown",
        (event) => {
            keys[event.code] = true;

            if (
                [
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Space"
                ].includes(event.code)
            ) {
                event.preventDefault();
            }

            if (
                event.code === "KeyR" &&
                gameState === "race"
            ) {
                const spawn =
                    track.getSpawn();

                vehicle.reset(
                    spawn.position,
                    spawn.yaw
                );

                followCamera.reset();
            }
        }
    );

    window.addEventListener(
        "keyup",
        (event) => {
            keys[event.code] = false;
        }
    );
}

function getVehicleInput() {
    return {
        throttle:
            Boolean(
                keys.KeyW ||
                keys.ArrowUp
            ),

        brake:
            Boolean(
                keys.KeyS ||
                keys.ArrowDown
            ),

        left:
            Boolean(
                keys.KeyA ||
                keys.ArrowLeft
            ),

        right:
            Boolean(
                keys.KeyD ||
                keys.ArrowRight
            )
    };
}

function updateRace(delta) {
    if (!raceRunning) {
        return;
    }

    raceTime =
        (performance.now() -
            startTime) /
        1000;

    setText(
        "time",
        formatTime(raceTime)
    );

    const input =
        getVehicleInput();

    vehicle.update(
        input,
        delta,
        track
    );

    checkFinish();
}

function updateCountdown(delta) {
    if (
        gameState !== "race" ||
        raceRunning
    ) {
        return;
    }

    countdownTimer += delta;

    if (
        countdownTimer >= 1
    ) {
        countdownTimer -= 1;

        countdown -= 1;

        updateCountdownText();

        if (countdown < 0) {
            raceRunning = true;
            raceFinished = false;

            startTime =
                performance.now();

            countdown = -1;

            updateCountdownText();
        }
    }
}

function updateGame(delta) {
    if (
        gameState !== "race"
    ) {
        return;
    }

    updateCountdown(delta);

    if (raceRunning) {
        updateRace(delta);
    }

    followCamera.update(
        vehicle,
        delta
    );

    const speed =
        Math.abs(
            vehicle.speed || 0
        );

    setText(
        "speed",
        `${Math.round(speed * 3.6)} km/h`
    );
}

function resize() {
    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

function animate() {
    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );

    updateGame(delta);
    updatePreview();

    renderer.render(
        scene,
        camera
    );
}

function setupScene() {
    const ambient =
        new THREE.HemisphereLight(
            0xb8c7d8,
            0x20251f,
            1.7
        );

    scene.add(ambient);

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2.2
        );

    sun.position.set(
        150,
        250,
        100
    );

    sun.castShadow = true;

    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;

    sun.shadow.camera.left = -250;
    sun.shadow.camera.right = 250;
    sun.shadow.camera.top = 250;
    sun.shadow.camera.bottom = -250;

    scene.add(sun);

    camera.position.set(
        0,
        12,
        -20
    );
}

function initialize() {
    setupScene();
    setupInput();
    handleMenuButtons();
    handleTrackButtons();
    handleBuilderButtons();

    track.environment.visible = false;
    track.group.visible = false;
    track.startMarker.visible = false;
    track.endMarker.visible = false;

    vehicle.mesh.visible = false;

    updatePersonalBest();

    showMenu();

    window.addEventListener(
        "resize",
        resize
    );

    animate();
}

initialize();