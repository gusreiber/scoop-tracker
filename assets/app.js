import ScoopAPI    from "./data/scoop-api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
    metaData: SCOOP.metaData,
  });
  console.log(SCOOP);
  await api.mountAllGrids(SCOOP.metaData);
});