document.addEventListener("DOMContentLoaded", () => mountScoopGrids());

async function mountScoopGrids() {
  const nodes = [...document.querySelectorAll(".scoop-grid[data-grid-type]")];
  if (!nodes.length) return;

  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: { planning: SCOOP.restUrl },
  });

  // Which grid types are on this page?
  const types = new Set(nodes.map(n => n.dataset.gridType));

  // Load ONLY what we need for the present types (still one bundle load)
  const bundleSpec = getBundleSpecForTypes(types);
  const raw = await api.loadBundle(bundleSpec);
  const D = DomainCodec.decode(raw);

  // Mount each node
  for (const el of nodes) {
    const type = el.dataset.gridType;
    const location = Number(el.dataset.location || 0);

    const model = makeModel(type, D, { location });
    if (!model) {
      el.textContent = `Unknown grid type: ${type}`;
      continue;
    }

    const grid = new Grid(el, type, { api, formCodec: FormCodec, domainCodec: DomainCodec });

    // if planning needs a post route/url, keep it centralized
    if (type === "planning") {
      grid.postUrl = api.routes?.planning || SCOOP.restUrl; // whichever you standardize
    }

    grid.init(model);
  }
}

function makeModel(type, D, { location } = {}) {
  if (type === "planning") return new CabinetGridModel(D, { location });
  if (type === "tubs")     return new FlavorTubsGridModel(D, { location });
  if (type === "batchs")   return new BatchGridModel(D, { location });
  return null;
}

function getBundleSpecForTypes(types) {
  // Minimal base sets per view; expand as needed
  const need = new Set();

  if (types.has("planning")) {
    need.add("cabinets"); need.add("slots"); need.add("flavors"); need.add("locations"); need.add("tubs");
  }
  if (types.has("tubs")) {
    need.add("tubs"); need.add("flavors"); need.add("locations");
  }
  if (types.has("batchs")) {
    // adjust based on what BatchGridModel actually needs
    need.add("flavors"); need.add("locations");
  }

  const spec = {};
  if (need.has("cabinets"))  spec.cabinets  = { url: "/wp-json/wp/v2/cabinet?_fields=id,title,slots,location", paged: true };
  if (need.has("flavors"))   spec.flavors   = { url: "/wp-json/wp/v2/flavor?_fields=id,title,tubs", paged: true };
  if (need.has("slots"))     spec.slots     = { url: "/wp-json/wp/v2/slot?_fields=id,title,current_flavor,immediate_flavor,next_flavor,location,cabinet", paged: true };
  if (need.has("locations")) spec.locations = { url: "/wp-json/wp/v2/location?_fields=id,title", paged: true };
  if (need.has("tubs"))      spec.tubs      = { url: "/wp-json/wp/v2/tub?_fields=id,title,flavor,location,state,index,date", paged: true };

  return spec;
}
