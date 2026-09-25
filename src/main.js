import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { Vehicle } from "./vehicle.js";
import { Track } from "./track.js";
import { FollowCamera } from "./camera.js";

const scene = new THREE.Scene();

scene.background =
    new THREE.Color(0x87a8c4);

scene.fog =
    new THREE.Fog(
        0x87a8c4,
        100,
        400
    );

const camera =
    new THREE.PerspectiveCamera(
        70,
        window.innerWidth /
            window.innerHeight,
        0.1,
        1000
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
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

document.body.appendChild(
    renderer.domElement
);

const hemisphere =
    new THREE.HemisphereLight(
        0xffffff,
        0x40543b,
        2.2
    );

scene.add(hemisphere);

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

sun.shadow.mapSize.width =
    2048;

sun.shadow.mapSize.height =
    2048;

scene.add(sun);

const ground =
    new THREE.Mesh(
        new THREE.PlaneGeometry(
            600,
            600
        ),
        new THREE.MeshStandardMaterial({
            color: 0x526b43,
            roughness: 1
        })
    );

ground.rotation.x =
    -Math.PI / 2;

ground.position.y =
    -100;

ground.receiveShadow = true;

scene.add(ground);

const track =
    new Track(scene);

const vehicle =
    new Vehicle(scene);

const followCamera =
    new FollowCamera(
        camera,
        vehicle
    );

const input = {
    throttle: false,
    brake: false,
    steering: 0
};

window.addEventListener(
    "keydown",
    (event) => {
        if (event.code === "KeyW") {
            input.throttle = true;
        }

        if (event.code === "KeyS") {
            input.brake = true;
        }

        if (event.code === "KeyA") {
            input.steering = -1;
        }

        if (event.code === "KeyD") {
            input.steering = 1;
        }

        if (event.code === "KeyR") {
            vehicle.reset();
        }
    }
);

window.addEventListener(
    "keyup",
    (event) => {
        if (event.code === "KeyW") {
            input.throttle = false;
        }

        if (event.code === "KeyS") {
            input.brake = false;
        }

        if (
            event.code === "KeyA" &&
            input.steering === -1
        ) {
            input.steering = 0;
        }

        if (
            event.code === "KeyD" &&
            input.steering === 1
        ) {
            input.steering = 0;
        }
    }
);

const speedElement =
    document.getElementById(
        "speed"
    );

const clock =
    new THREE.Clock();

function animate() {
    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );

    vehicle.update(
        delta,
        input,
        track
    );

    followCamera.update(
        delta
    );

    speedElement.textContent =
        `${Math.round(
            vehicle.getSpeed() * 3.6
        )} km/h`;

    renderer.render(
        scene,
        camera
    );
}

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

animate();