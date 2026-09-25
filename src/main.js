import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import {
    Track
} from "./track.js";

import {
    Vehicle
} from "./vehicle.js";

import {
    FollowCamera
} from "./camera.js";

const menu = document.getElementById("menu");
const trackSelect = document.getElementById("trackSelect");
const leaderboard = document.getElementById("leaderboard");
const builder = document.getElementById("builder");
const game = document.getElementById("game");

const timerElement =
    document.getElementById("timer");

const bestElement =
    document.getElementById("bestTime");

const menuBestElement =
    document.getElementById("menuBest");

const speedElement =
    document.getElementById("speed");

const checkpointElement =
    document.getElementById("checkpoint");

const countdownElement =
    document.getElementById("countdown");

const leaderboardList =
    document.getElementById("leaderboardList");

const builderStatus =
    document.getElementById("builderStatus");

const scene = new THREE.Scene();

scene.background =
    new THREE.Color(0x9eb6c7);

scene.fog = new THREE.Fog(
    0x9eb6c7,
    150,
    650
);

const camera =
    new THREE.PerspectiveCamera(
        68,
        window.innerWidth / window.innerHeight,
        0.1,
        1200
    );

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;

document.body.appendChild(
    renderer.domElement
);

const ambient =
    new THREE.HemisphereLight(
        0xffffff,
        0x53606b,
        2
    );

scene.add(ambient);

const sun =
    new THREE.DirectionalLight(
        0xffffff,
        3
    );

sun.position.set(
    80,
    120,
    60
);

sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

scene.add(sun);

const ground =
    new THREE.Mesh(
        new THREE.PlaneGeometry(
            2000,
            2000
        ),
        new THREE.MeshStandardMaterial({
            color: 0x66735e,
            roughness: 1
        })
    );

ground.rotation.x =
    -Math.PI / 2;

ground.position.y = -0.3;

ground.receiveShadow = true;

scene.add(ground);

const track =
    new Track(scene);

const vehicle =
    new Vehicle(scene, track);

const followCamera =
    new FollowCamera(camera);

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

let racing = false;
let countdownRunning = false;
let raceStart = 0;
let finishTime = null;
let currentTrackName = "Mountain Run";

const leaderboardKey =
    "apex-leaderboard";

function getLeaderboard() {
    try {
        const data =
            JSON.parse(
                localStorage.getItem(
                    leaderboardKey
                )
            );

        if (Array.isArray(data)) {
            return data;
        }
    } catch {
    }

    return [];
}

function saveTime(time) {
    const data =
        getLeaderboard();

    data.push({
        track: currentTrackName,
        time
    });

    data.sort(
        (a, b) => a.time - b.time
    );

    localStorage.setItem(
        leaderboardKey,
        JSON.stringify(
            data.slice(0, 20)
        )
    );
}

function getBestTime() {
    const times =
        getLeaderboard()
            .filter(
                item =>
                    item.track ===
                    currentTrackName
            );

    if (times.length === 0) {
        return null;
    }

    return times[0].time;
}

function formatTime(milliseconds) {
    if (
        milliseconds === null ||
        !Number.isFinite(milliseconds)
    ) {
        return "--:---.---";
    }

    const totalSeconds =
        milliseconds / 1000;

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        seconds.toFixed(3).padStart(6, "0")
    );
}

function updateBestDisplay() {
    const best =
        getBestTime();

    const formatted =
        formatTime(best);

    bestElement.textContent =
        formatted;

    menuBestElement.textContent =
        formatted;
}

function showOnly(screen) {
    menu.classList.add("hidden");
    trackSelect.classList.add("hidden");
    leaderboard.classList.add("hidden");
    builder.classList.add("hidden");

    if (screen) {
        screen.classList.remove(
            "hidden"
        );
    }
}

function stopGame() {
    racing = false;
    countdownRunning = false;

    game.classList.remove(
        "active"
    );

    vehicle.reset();

    showOnly(menu);

    updateBestDisplay();
}

async function startRace() {
    showOnly(null);

    game.classList.add(
        "active"
    );

    track.clear();

    if (currentTrackName === "Mountain Run") {
        track.buildDefault();
    } else {
        track.addPiece("straight");
        track.addPiece("boost");
        track.addPiece("straight");
        track.addPiece("curveLeft");
        track.addPiece("straight");
        track.addPiece("ramp");
        track.addPiece("curveRight");
        track.addPiece("straight");
        track.addPiece("bankLeft");
        track.addPiece("straight");
    }

    vehicle.reset();

    camera.position.set(
        vehicle.group.position.x,
        vehicle.group.position.y + 7,
        vehicle.group.position.z - 13
    );

    countdownRunning = true;

    countdownElement.textContent =
        "3";

    await delay(700);

    countdownElement.textContent =
        "2";

    await delay(700);

    countdownElement.textContent =
        "1";

    await delay(700);

    countdownElement.textContent =
        "GO";

    raceStart =
        performance.now();

    racing = true;
    countdownRunning = false;

    await delay(500);

    countdownElement.textContent =
        "";
}

function delay(milliseconds) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}

function updateTimer() {
    if (!racing) {
        return;
    }

    const elapsed =
        performance.now() -
        raceStart;

    timerElement.textContent =
        formatTime(elapsed);

    const finishDistance =
        vehicle.group.position.distanceTo(
            track.finishPosition
        );

    if (
        finishDistance < 8 &&
        elapsed > 5000
    ) {
        finishRace(elapsed);
    }
}

function finishRace(time) {
    if (!racing) {
        return;
    }

    racing = false;
    finishTime = time;

    saveTime(time);

    timerElement.textContent =
        formatTime(time);

    updateBestDisplay();

    setTimeout(() => {
        stopGame();
    }, 1500);
}

function renderLeaderboard() {
    const data =
        getLeaderboard()
            .filter(
                item =>
                    item.track ===
                    currentTrackName
            )
            .slice(0, 10);

    leaderboardList.innerHTML = "";

    if (data.length === 0) {
        leaderboardList.innerHTML =
            "<div>No times recorded yet.</div>";

        return;
    }

    data.forEach(
        (entry, index) => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "leader-row";

            row.innerHTML =
                `
                <span class="leader-position">
                    ${index + 1}
                </span>
                <span class="leader-name">
                    PLAYER
                </span>
                <span class="leader-time">
                    ${formatTime(entry.time)}
                </span>
                `;

            leaderboardList.appendChild(
                row
            );
        }
    );
}

function setupBuilder() {
    track.clear();

    track.addPiece(
        "straight"
    );

    builderStatus.textContent =
        "Start piece placed. Select another piece to continue.";
}

document
    .getElementById("playButton")
    .addEventListener(
        "click",
        () => {
            showOnly(trackSelect);
        }
    );

document
    .getElementById("buildButton")
    .addEventListener(
        "click",
        () => {
            showOnly(builder);
            setupBuilder();
        }
    );

document
    .getElementById("tracksButton")
    .addEventListener(
        "click",
        () => {
            showOnly(trackSelect);
        }
    );

document
    .getElementById("leaderboardButton")
    .addEventListener(
        "click",
        () => {
            renderLeaderboard();
            showOnly(leaderboard);
        }
    );

document
    .getElementById("trackBackButton")
    .addEventListener(
        "click",
        () => {
            showOnly(menu);
        }
    );

document
    .getElementById("leaderboardBackButton")
    .addEventListener(
        "click",
        () => {
            showOnly(menu);
        }
    );

document
    .getElementById("pauseButton")
    .addEventListener(
        "click",
        () => {
            stopGame();
        }
    );

document
    .getElementById("builderBackButton")
    .addEventListener(
        "click",
        () => {
            showOnly(menu);
        }
    );

document
    .getElementById("clearTrackButton")
    .addEventListener(
        "click",
        () => {
            setupBuilder();
        }
    );

document
    .getElementById("testTrackButton")
    .addEventListener(
        "click",
        () => {
            currentTrackName =
                "Custom Track";

            startRace();
        }
    );

document
    .querySelectorAll(
        ".track-option"
    )
    .forEach(button => {
        button.addEventListener(
            "click",
            () => {
                currentTrackName =
                    button.dataset.track ===
                    "mountain"
                        ? "Mountain Run"
                        : "Speed Circuit";

                startRace();
            }
        );
    });

document
    .querySelectorAll(
        "[data-piece]"
    )
    .forEach(button => {
        button.addEventListener(
            "click",
            () => {
                const type =
                    button.dataset.piece;

                const added =
                    track.addPiece(type);

                if (added) {
                    builderStatus.textContent =
                        `${type} added to the end of the track.`;
                } else {
                    builderStatus.textContent =
                        "Piece rejected because it would overlap an existing piece.";
                }
            }
        );
    });

window.addEventListener(
    "keydown",
    event => {
        if (
            event.code === "KeyW" ||
            event.code === "ArrowUp"
        ) {
            keys.forward = true;
        }

        if (
            event.code === "KeyS" ||
            event.code === "ArrowDown"
        ) {
            keys.backward = true;
        }

        if (
            event.code === "KeyA" ||
            event.code === "ArrowLeft"
        ) {
            keys.left = true;
        }

        if (
            event.code === "KeyD" ||
            event.code === "ArrowRight"
        ) {
            keys.right = true;
        }

        if (
            event.code === "KeyR" &&
            game.classList.contains("active")
        ) {
            vehicle.reset();
        }
    }
);

window.addEventListener(
    "keyup",
    event => {
        if (
            event.code === "KeyW" ||
            event.code === "ArrowUp"
        ) {
            keys.forward = false;
        }

        if (
            event.code === "KeyS" ||
            event.code === "ArrowDown"
        ) {
            keys.backward = false;
        }

        if (
            event.code === "KeyA" ||
            event.code === "ArrowLeft"
        ) {
            keys.left = false;
        }

        if (
            event.code === "KeyD" ||
            event.code === "ArrowRight"
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

let previousTime =
    performance.now();

function animate() {
    requestAnimationFrame(
        animate
    );

    const now =
        performance.now();

    const delta =
        Math.min(
            (now - previousTime) / 1000,
            0.05
        );

    previousTime = now;

    if (
        game.classList.contains(
            "active"
        ) &&
        !countdownRunning
    ) {
        vehicle.update(
            delta,
            keys
        );

        followCamera.update(
            vehicle,
            delta
        );

        speedElement.textContent =
            `${vehicle.getSpeedKmh()} KM/H`;

        updateTimer();
    }

    renderer.render(
        scene,
        camera
    );
}

updateBestDisplay();

animate();