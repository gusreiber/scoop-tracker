import ScoopAPI    from "./data/scoop-api.js";

document.addEventListener("DOMContentLoaded", () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
  });
  console.log(SCOOP);
  api.mountAllGrids();
});