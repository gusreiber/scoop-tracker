document.addEventListener("DOMContentLoaded",  () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
  });

  api.mountAllGrids({ domainCodec: DomainCodec, formCodec: FormCodec });
});