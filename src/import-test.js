import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const result = document.getElementById("result");
const button = document.getElementById("testButton");

result.textContent =
    "Three.js loaded: " +
    THREE.REVISION;

button.addEventListener("click", () => {
    result.textContent =
        "Three.js and JavaScript both work.";
});

console.log("Three.js revision:", THREE.REVISION);