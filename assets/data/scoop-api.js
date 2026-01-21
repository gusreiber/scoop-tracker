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
    this.gridTypes = new Set();
    this.typesKey = "";
    this.bundleUrl = new URL(this.baseUrl);

    this._hosts;
    this._domain;
    this._domainInflight;


    for (const [k, v] of Object.entries(routes)) {
      this.routes[k] = this._absUrl(v);
    }

    this.controller = new AbortController();

    // simple per-page cache (in-memory)
    this._bundleCache = new Map(); // key:string -> bundleJson
  }

  abort() { this.controller.abort(); }

  getTypesFromGridHosts(root = document) {
    this._hosts = [...root.querySelectorAll(".scoop-grid[data-grid-type]")];
    if(!this._hosts.length) return false;

    this.gridTypes = new Set();
    for (const node of this._hosts) {
      const t = node.dataset.gridType;
      if (t) this.gridTypes.add(t);
    }
    this._setPageTypes();

    return true;
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

  _absUrlWithBust(url) {
    const u = (url instanceof URL) ? new URL(url.toString()) : new URL(this._absUrl(url));
    u.searchParams.set("_ts", String(Date.now()));
    return u;
  }

  async _fetch(url, { method="GET", headers={}, body=null, useNonce=false } = {}) {
    const u0 = (url instanceof URL) ? url : this._absUrl(url);
    const u = (method === "GET") ? this._absUrlWithBust(u0) : ((u0 instanceof URL) ? u0 : this._absUrl(u0));

    const res = await fetch(u, {
      method,
      credentials: "include",
      signal: this.controller.signal,
      cache: (method === "GET") ? "no-store" : "default",
      headers: {
        Accept: "application/json",
        ...(method === "GET" ? { "Cache-Control": "no-cache" } : {}),
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

  _setPageTypes() {
    this.typesKey = this._typesKey(this.types);
    this.bundleUrl = this._bundleUrlForTypes(this.types); // URL object
  }


  _typesKey() {
    const arr = [...(this.gridTypes ?? [])].map(String).filter(Boolean);
    arr.sort();
    return arr.join(",");
  }

  _bundleUrlForTypes() {
    const base = new URL(this.route("Bundle").toString());
    const key = this._typesKey();
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

    // Minimal guards so models can safely assume arrays exist.
    const data = bundle?.data ?? {};
    bundle.data = {
      cabinets : Array.isArray(data.cabinets)  ? data.cabinets  : [],
      slots    : Array.isArray(data.slots)     ? data.slots     : [],
      tub     : Array.isArray(data.tub)      ? data.tub      : [],
      flavor  : Array.isArray(data.flavor)   ? data.flavor   : [],
      locations: Array.isArray(data.locations) ? data.locations : [],
      uses     : Array.isArray(data.uses)      ? data.uses      : [],
      // if these exist later, keep them without forcing structure:
      batch  : Array.isArray(data.batch)   ? data.batch   : (data.batch ?? []),
      closeout: Array.isArray(data.closeout) ? data.closeout : (data.closeout ?? []),
      ...data
    };

    if (cache) this._bundleCache.set(key, bundle);
    return bundle;
  }

  // The models expect "domain" = the data object with arrays:
  // { cabinets, slots, tub, flavor, locations, uses, ... }
  async refreshPageDomain({ force = false, toast = null, info = null } = {}) {

    if (!this.gridTypes) throw new Error("refreshPageDomain: page types not set");
    if (!force && this._domain) return this._domain;
    if (this._domainInflight) return this._domainInflight;
    if(toast) toast.update(toast, {title:"Data Saved..."});

    this._domainInflight = (async () => {
      // bypass in-memory bundle cache on force
      const bundle = await this.getBundleForTypes(this._pageTypes, { cache: !force });
      this._domain = bundle?.data ?? {};
      this._domainInflight = null;

      document.dispatchEvent(new CustomEvent("ts:domain:updated", {
        detail: { types: this._pageTypes, ts: Date.now() }
      }));
      if(toast) toast.update(toast, {
        title:"Data Reloaded", 
        message:(info)? 'Triggered by ' + info.name : ''
      });
      document.body.classList.remove('TS_GRID-UPDATING');

      return this._domain;
    })();

    return this._domainInflight;
  }

  getDomainSnapshot() {
    return this._domain ?? {};
  }

  // Controller factory that DOES NOT fetch; it uses a provided domain.
  getModelCtrl(name, location = 0) {
    const Ctor = this.getModelsBom()[name];
    if (!Ctor) throw new Error(`Missing model for grid type "${name}"`);

    return {
      type: name,
      location,
      load: async () => {
        const domain = this.getDomainSnapshot();
        return new Ctor(name, domain, { location, metaData: SCOOP.metaData[name]});
      }
    };
  }


  // --- MOUNTING ---

  async mountAllGrids({ root=document, formCodec=FormCodec } = {}) {
    if(!this.getTypesFromGridHosts(root)) return;
    
    // One request for all grids on the page.
    this._domain = await this.refreshPageDomain();

    // Build grids with modelCtrls that reuse the same domain.
    const grids = this._hosts.map(dom => {
      const name = dom.dataset.gridType;
      const location = Number(dom.dataset.location || 0);
      const modelCtrl = this.getModelCtrl(name, location );
      // Keep Grid constructor args stable; pass null/undefined for codecs if Grid accepts them.
      return new Grid(dom, name, { api: this, formCodec, modelCtrl });
    });

    const models = await Promise.all(grids.map(g => g.modelCtrl.load()));    
    models.forEach((m, i) => grids[i].init(m));
  }
}