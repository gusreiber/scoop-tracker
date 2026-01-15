import Grid               from "../ui/grid.js";
import DomainCodec        from "./domain-codec.js";
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
  
  bundleSpecForGridTypes(types) {
    const need = new Set();

    if (types.has("Cabinet")) {
      need.add("cabinets"); need.add("slots"); need.add("flavors"); need.add("locations"); need.add("tubs");
    }
    if (types.has("FlavorTub")) {
      need.add("tubs"); need.add("flavors"); need.add("locations"); need.add("uses");
    }
    if (types.has("Batch")) {
      need.add("flavors"); need.add("locations"); 
    }
    if(types.has("Closeout")){
      need.add("flavors"); need.add("locations"); need.add("uses");
    }

    const spec = {};
    if (need.has("cabinets"))  spec.cabinets  = { url: "/wp-json/wp/v2/cabinet?_fields=id,title,slots,location", paged: true };
    if (need.has("flavors"))   spec.flavors   = { url: "/wp-json/wp/v2/flavor?_fields=id,title,tubs", paged: true };
    if (need.has("slots"))     spec.slots     = { url: "/wp-json/wp/v2/slot?_fields=id,title,current_flavor,immediate_flavor,next_flavor,location,cabinet", paged: true };
    if (need.has("locations")) spec.locations = { url: "/wp-json/wp/v2/location?_fields=id,title", paged: true };
    if (need.has("tubs"))      spec.tubs      = { url: "/wp-json/wp/v2/tub?_fields=id,title,use,amount,flavor,location,state,index,date", paged: true };
    if (need.has("uses"))      spec.uses      = { url: "/wp-json/wp/v2/use?_fields=id,title,order" };

    return spec;
  }

  getModelsBom(){
    return {
      "Cabinet"   : CabinetGridModel, 
      "FlavorTub" : FlavorTubGridModel,
      "Batch"     : BatchGridModel,
      "Closeout"  : CloseoutGridModel
    }
  }

  getModelCtrl(name, location = 0){
    return {
      type:name,
      location,
      load:async()=>{
        const raw = await this.singleFormJson(name);
        const D = DomainCodec.decode(raw);
        const ctrl = this.getModelsBom()[name];
        return new ctrl(name, D, {location});
      }
    }

  }

  async mountAllGrids({ root=document, domainCodec=DomainCodec, formCodec=FormCodec } = {}) {
    const hosts = this.findGridHosts(root);
    if (!hosts.length) return;

    const grids = hosts.map(dom => {
      const name = dom.dataset.gridType;
      const location = Number(dom.dataset.location || 0);
      const modelCtrl = this.getModelCtrl(name, location, { domainCodec });

      return new Grid(dom, name, { api:this, formCodec, domainCodec, modelCtrl });
    });

    const models = await Promise.all(grids.map(g => g.modelCtrl.load()));
    models.forEach((m, i) => grids[i].init(m));
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

  async getAllPages(url = this.baseUrl, { perPage = 100, maxPages = 1000 } = {}) {
    const all = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      if (page > maxPages) throw new Error(`Too many pages for ${url}`);

      const u = new URL(this._absUrl(url), window.location.origin);
      if (!u.searchParams.get("per_page")) u.searchParams.set("per_page", String(perPage));
      u.searchParams.set("page", String(page));

      const r = await this._fetch(u.toString(), { method: "GET" });

      if (!Array.isArray(r.data)) return r.data;

      all.push(...r.data);

      const tp = Number(r.res.headers.get("X-WP-TotalPages") || "1");
      totalPages = Number.isFinite(tp) && tp > 0 ? tp : 1;

      page++;
    }

    return all;
  }

  async postJson(payload, type = "", { useNonce = true } = {}) {
    const url = this.route(type);
    if (!url) throw new Error(`postJson: missing route for type="${type}"`);

    const bodyObj = { [type]: payload };   // <-- THE RULE

    console.log("postJson", url, bodyObj);

    const r = await this._fetch(url, {
      method: "POST",
      useNonce,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });

    return { ok: r.ok, status: r.status, data: r.data };
  }

  async getBundle(){
    const bURL = await this.routes.Batch;
    console.log(this.routes);
    const cfg = (typeof bURL === "string") ? { url: bURL } : (bURL ?? {});
    //const data = await this.getJson(cfg);
    console.log('??? this routes data',cfg);
  };

  async loadBundle(endpoints) {
    this.getBundle();
    const entries = Object.entries(endpoints ?? {});
    console.log(endpoints);
    const pairs = await Promise.all(entries.map(async ([key, spec]) => {
      console.log(spec);
      const cfg = (typeof spec === "string") ? { url: spec } : (spec ?? {});
      if (!cfg.url) throw new Error(`Missing url for endpoint "${key}"`);
      console.log(cfg.url);
      const data = cfg.paged
        ? await this.getAllPages(cfg.url, { perPage: cfg.perPage ?? 100, maxPages: cfg.maxPages ?? 1000 })
        : await this.getJson(cfg.url);

      return [key, data];
    }));

    return Object.fromEntries(pairs);
  }

  async singleFormJson(formName){
    const types = new Set( [formName] );
    console.log('single',formName);
    return await this.loadBundle(this.bundleSpecForGridTypes(types));
  }

  // Generic: post Cabinet to a provided endpoint
  route(name) {
    const u = this.routes?.[name];
    if (!u) throw new Error(`ScoopAPI.route("${name}") missing`);
    return u;
  }

}