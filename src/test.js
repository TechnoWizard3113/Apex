const playButton = document.getElementById("testButton");
const result = document.getElementById("result");

playButton.addEventListener("click", () => {
    result.textContent = "MAIN.JS STYLE TEST WORKS";
});

console.log("JavaScript module loaded successfully.");