import Grid               from "../ui/grid.js";
import FormCodec          from "./form-codec.js";
import CabinetGridModel   from "../models/cabinet-grid-model.js";
import BatchGridModel     from "../models/batch-grid-model.js";
import CloseoutGridModel  from "../models/closeout-grid-model.js";
import FlavorTubGridModel from "../models/flavor-tub-grid-model.js";

export default class ScoopAPI {
  constructor({ nonce, base = "/", routes = {} } = {}) {
    this.nonce = nonce ?? null;
    this.baseUrl = this._absUrl(base);
    this.routes = {};

    for (const [k, v] of Object.entries(routes)) {
      this.routes[k] = this._absUrl(v);
    }

    this.controller = new AbortController();

    // simple per-page cache (in-memory)
    this._bundleCache = new Map(); // key:string -> bundleJson
  }

  abort() { this.controller.abort(); }

  findGridHosts(root = document) {
    return [...root.querySelectorAll(".scoop-grid[data-grid-type]")];
  }

  _absUrl(pathOrUrl) {
    if (pathOrUrl instanceof URL) return pathOrUrl;
    if (!pathOrUrl) return new URL(window.location.origin);
    try { return new URL(pathOrUrl); }
    catch { return new URL(pathOrUrl, window.location.origin); }
  }

  getModelsBom() {
    return {
      "Cabinet"   : CabinetGridModel,
      "FlavorTub" : FlavorTubGridModel,
      "Batch"     : BatchGridModel,
      "Closeout"  : CloseoutGridModel
    };
  }

  route(name) {
    const u = this.routes?.[name];
    if (!u) throw new Error(`ScoopAPI.route("${name}") missing`);
    return u;
  }

  async _fetch(url, { method="GET", headers={}, body=null, useNonce=false } = {}) {
    const u = (url instanceof URL) ? url : this._absUrl(url);
    const res = await fetch(u, {
      method,
      credentials: "include",
      signal: this.controller.signal,
      headers: {
        Accept: "application/json",
        ...headers,
        ...(useNonce && this.nonce ? { "X-WP-Nonce": this.nonce } : {}),
      },
      body,
    });

    const text = await res.text().catch(() => "");
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { ok: false, error: "Non-JSON response", raw: text }; }

    return { ok: res.ok, status: res.status, data, res };
  }

  async getJson(url = this.baseUrl) {
    const r = await this._fetch(url, { method: "GET" });
    return r.data;
  }

  // --- WRITES (unchanged) ---
  async postJson(payload, type = "", { useNonce = true } = {}) {
    const url = this.route(type);
    const bodyObj = { [type]: payload }; // <-- THE RULE

    const r = await this._fetch(url, {
      method: "POST",
      useNonce,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });

    return { ok: r.ok, status: r.status, data: r.data };
  }

  // --- BUNDLE LOADING ---

  _typesKey(types) {
    const arr = [...(types ?? [])].map(String).filter(Boolean);
    arr.sort();
    return arr.join(",");
  }

  _bundleUrlForTypes(types) {
    const base = new URL(this.route("Bundle").toString());
    const key = this._typesKey(types);
    base.searchParams.set("types", key);
    return base;
  }

  // Returns full bundle JSON: { ok, types, needs, data }
  async getBundleForTypes(types, { cache = true } = {}) {
    const key = this._typesKey(types);
    if (!key) throw new Error("getBundleForTypes: no types");

    if (cache && this._bundleCache.has(key)) return this._bundleCache.get(key);

    const url = this._bundleUrlForTypes(types);
    const bundle = await this.getJson(url);

    console.log('???bundle?.data', bundle?.data);
    // Minimal guards so models can safely assume arrays exist.
    const data = bundle?.data ?? {};
    bundle.data = {
      cabinets : Array.isArray(data.cabinets)  ? data.cabinets  : [],
      slots    : Array.isArray(data.slots)     ? data.slots     : [],
      tubs     : Array.isArray(data.tubs)      ? data.tubs      : [],
      flavors  : Array.isArray(data.flavors)   ? data.flavors   : [],
      locations: Array.isArray(data.locations) ? data.locations : [],
      uses     : Array.isArray(data.uses)      ? data.uses      : [],
      // if these exist later, keep them without forcing structure:
      batches  : Array.isArray(data.batches)   ? data.batches   : (data.batches ?? []),
      closeouts: Array.isArray(data.closeouts) ? data.closeouts : (data.closeouts ?? []),
      ...data
    };

    if (cache) this._bundleCache.set(key, bundle);
    return bundle;
  }

  // The models expect "domain" = the data object with arrays:
  // { cabinets, slots, tubs, flavors, locations, uses, ... }
  async getDomainForPage(types) {
    const bundle = await this.getBundleForTypes(types);
    return bundle?.data ?? {};
  }

  // Controller factory that DOES NOT fetch; it uses a provided domain.
  getModelCtrl(name, location = 0, domain = null) {
    const Ctor = this.getModelsBom()[name];
    if (!Ctor) throw new Error(`Missing model for grid type "${name}"`);

    return {
      type: name,
      location,
      load: async () => {
        if (!domain) throw new Error(`ModelCtrl.load("${name}") missing domain`);
        return new Ctor(name, domain, { location });
      }
    };
  }

  // --- MOUNTING ---

  async mountAllGrids({ root=document, formCodec=FormCodec } = {}) {
    const hosts = this.findGridHosts(root);
    if (!hosts.length) return;

    // Collect unique grid types on the page.
    const types = new Set();
    for (const dom of hosts) {
      const t = dom.dataset.gridType;
      if (t) types.add(t);
    }

    // One request for all grids on the page.
    const domain = await this.getDomainForPage(types);

    // Build grids with modelCtrls that reuse the same domain.
    const grids = hosts.map(dom => {
      const name = dom.dataset.gridType;
      const location = Number(dom.dataset.location || 0);
      const modelCtrl = this.getModelCtrl(name, location, domain);

      // Keep Grid constructor args stable; pass null/undefined for codecs if Grid accepts them.
      return new Grid(dom, name, { api: this, formCodec, modelCtrl });
    });

    const models = await Promise.all(grids.map(g => g.modelCtrl.load()));
    console.log('models',models);
    models.forEach((m, i) => grids[i].init(m));
  }
}