const btn = document.getElementById("testBtn");
const output = document.getElementById("output");

btn.addEventListener("click", () => {
  output.textContent = "Button clicked. Renderer is working.";
});
