import ScoopAPI    from "./data/scoop-api.js";
import DomainCodec from "./data/domain-codec.js";
import FormCodec   from "./data/form-codec.js";

document.addEventListener("DOMContentLoaded", () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
  });

  api.mountAllGrids({ domainCodec: DomainCodec, formCodec: FormCodec });
});