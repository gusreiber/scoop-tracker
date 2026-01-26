import ScoopAPI    from "./data/scoop-api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
    metaData: SCOOP.metaData,
  });
  await api.mountAllGrids(SCOOP.metaData);
});