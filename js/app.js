
////////////////////////////////////////
// GUI CONTROLS
/////////////////////////////

// GRID ---------------------------
class Grid{
  constructor(target, state){
    this.target = target;
    
    this.state = state;
  }
  
  init() {


    this.render();
    this.bindEvents();
    
  }

  render() { 
    const groupByStart = new Map();
    for (const g of (this.state.rowGroups ?? [])) {
      groupByStart.set(g.startIndex, g);
    }

    const el = (tag, ...classes) => {
      const n = document.createElement(tag);
      if (classes.length) n.classList.add(...classes);
      return n;
    }

    const { columns, rows, minCount } = this.state;
    
    const TABLE = el('table', 'zGRID');
    const THEAD = el("thead");
    const TRH = el("tr");

    for (const col of columns) {
      const TH = el("th");
      TH.textContent = col.label ?? col.key;
      TRH.append(TH);
    }

    THEAD.append(TRH);
    TABLE.append(THEAD);

    let TBODY = el('tbody');
    const hasGroups = groupByStart.size > 0;
    if(hasGroups) TABLE.append(TBODY);

    for(let y = 0; y < rows.length; y++){
      const g = groupByStart.get(y);
      
      if (g) {
        TBODY = el("tbody", "groupBody");
        TABLE.append(TBODY);
        const GR = el("tr",    "group");
        const GD = el("td",    "groupCell");
        GD.colSpan = columns.length;

        
const label = el("span", "groupLabel");
label.textContent = g.label;
GD.append(label);

// badges (raw counts)
const badges = el("span", "groupBadges");
console.log('g.badges',g.badges);
for (const b of (g.badges ?? [])) {
  const B = el("span", "badge");
  B.textContent = b.text;      // e.g. "U:3"
  if (b.title) B.title = b.title;
  badges.append(B);
}
GD.append(badges);


        GR.append(GD);
        TBODY.append(GR);
      }
      
      const ROW = el('tr','row');
      for(let x = 0; x < columns.length; x++){
        const CELL = el('td','cell');
        const INP  = el('input');

        INP.value = rows[y]?.[columns[x].key] ?? "";
        
        CELL.append(INP);
        ROW.append(CELL);
      }

      TBODY.append(ROW);
    }
    
    this.target.append(TABLE);
    console.log(TABLE);

  }

  bindEvents() { 
    console.log(this.state);
   }

  destroy() {
    //TODO: this doesn't exist
    console.log("I am here to create not distroy");
  }

}

////////////////////////////////////////
// MODELS
/////////////////////////////

// GRID --------------------------
class BaseGridModel {
  
  constructor(domain, { location } = {}) {
    this.domain = domain;
    this.location = Number(location);

    // --- grid contract ---
    this.columns = [];
    this.rows = [];
    this.rowGroups = [];
    this.options = {};
    this.minCount = 0;

    this.badgeSpecs = [];
  }

  getIdsForLocation(list, { locationKey = "location", idKey = "id" } = {}) {
    const ids = new Set();
    for (const item of (Array.isArray(list) ? list : [])) {
      if (item?.[locationKey] === this.location) ids.add(item?.[idKey]);
    }
    return ids;
  }


  filterByLocation(list, { locationKey = "location" } = {}) {
    return (Array.isArray(list) ? list : []).filter(item =>
      item?.[locationKey] === this.location
    );
  }

  
  labelFromMap(objOrId, map, {
      fieldKey = null,
      fallbackNoun = "Item"
    } = {})
  {
    const id = fieldKey
      ? objOrId?.[fieldKey]
      : objOrId;

    if (!id) return null;

    const item = map?.get?.(id);
    return item?._title ?? `${fallbackNoun} ${id}`;

  }

  isValidId(itemId) {
    return Number(itemId) > 0;
  }

  badgesFrom(items, specs = []) {
    const arr = Array.isArray(items) ? items : [];
    console.log('badgesFrom:',items, specs);
    return specs
      .map(s => {
        const n = s.count(arr);
        if (s.hideZero && !n) return null;
        return { key: s.key, text: s.format(n), title: s.title ?? "" };
      })
      .filter(Boolean);
  }

  build() {
    console.log('BaseGridModel builds:', this);
    this.buildCols();
    this.builRows();
  }

  buildCols(){
    throw new Error("buildCols() must be implemented by subclass");
  }

  builRows(){
    throw new Error("builRows() must be implemented by subclass");
  }

  buildGroupedRows({
    groupsMap,            // Map<groupId, item[]>
    includeGroupId,       // (groupId) => boolean
    getGroupLabel,        // (groupId) => string
    getGroupBadges,       // optional callback to get meta info
    makeRowId,            // (item) => any
    fillRow,              // (row, item) => void
    groupIdKey = "groupId"// key name stored in rowGroups entries
  }) {
    this.rows = [];
    this.rowGroups = [];

    for (const [groupId, items] of (groupsMap ?? new Map()).entries()) {
      if (includeGroupId && !includeGroupId(groupId)) continue;

      const badges = getGroupBadges ? (getGroupBadges(items, groupId) ?? []) : [];

      this.rowGroups.push({
        startIndex  : this.rows.length,
        label       : getGroupLabel ? getGroupLabel(groupId) : String(groupId),
        [groupIdKey]: groupId,
        badges
      });

      for (const item of (items ?? [])) {
        const row = { id: makeRowId ? makeRowId(item) : item?.id };
        if (fillRow) fillRow(row, item);
        this.rows.push(row);
      }
    }

    return this.rows;

  }

  fillRowFromColumns(
    row, obj, 
    {
    idKey = "id",
    resolveTitleKeys = new Map(), // key -> map (e.g. "flavor" -> this._flavorsById)
    } = {}) 
  {
    for (const col of this.columns) {
      const key = col?.key;
      if (!key || key === idKey) continue;

      const map = resolveTitleKeys.get(key);
      if (map) {
        row[key] = this.labelFromMap(obj, map, { fieldKey: key, fallbackNoun: col.label ?? key });
      } else {
        row[key] = obj?.[key] ?? null;
      }
    }
  }


}

class CabinetGridModel extends BaseGridModel{
  constructor(domain, { location = 935 } = {}) {
    super(domain, { location });

    this._cabinetsById     = DataLoader.byId(domain.cabinets);
    this._flavorsById      = DataLoader.byId(domain.flavors);
    this._slotsByCabinetId = DataLoader.groupBy(
      domain.slots,
      s => s.cabinet

    );

    this.build();
  }



  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'current_flavor',  label:'Current Flavor'},
      {key:'immediate_flavor',label:'Immediate Flavor'},
      {key:'next_flavor',     label:'Planned Flavor'}
    ]

    return this.columns;
  }

  builRows() {
    const cabinetIds = this.getIdsForLocation(this.domain.cabinets);

    return this.buildGroupedRows({
      groupsMap     : this._slotsByCabinetId,
      groupIdKey    : "cabinetId",
      includeGroupId: (id) => cabinetIds.has(Number(id)),      
      getGroupLabel : (id) => this.labelFromMap(id, this._cabinetsById),
      getGroupBadges: (items) => this.badgesFrom(items, this.badgeSpecs),
      fillRow       : (row, item) => {
                      this.fillRowFromColumns(row, item, {
                        resolveTitleKeys: new Map([
                          ["current_flavor", this._flavorsById],
                          ["immediate_flavor", this._flavorsById],
                          ["next_flavor", this._flavorsById],
                         ]),
                      });
                    }
    });
  }

}

class FlavorTubsGridModel extends BaseGridModel{
  constructor(domain, {location = 935} = {} ){
    super(domain, { location });

    // --- derived indexes (convenience, not exposed to Grid) ---
    this._tubsById         = DataLoader.byId(domain.tubs);
    this._flavorsById      = DataLoader.byId(domain.flavors);
    
    this.badgeSpecs = [
      { key: "unopened", title: "Unopened", hideZero: true,
        count: tubs => tubs.length,
        format: n => `U:${n}` },
      { key: "serving", title: "Serving", hideZero: true,
        count: tubs => tubs.filter(t => t.state === "Serving").length,
        format: n => `S:${n}` },
    ];

    this.build();
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'state',           label:'state'},
      {key:'flavor',          label:'flavor'},
      {key:'date',            label:'date'},
      {key:'index',           label:'index'},
    ]

    return this.columns;
  }

  builRows(){
    const locationTubIds = this.filterByLocation(this.domain.tubs);
    const tubsByFlavorId = DataLoader.groupBy(locationTubIds, t => t.flavor);
                   
    return this.buildGroupedRows({
      groupsMap     : tubsByFlavorId,
      groupIdKey    : "flavor",
      includeGroupId: (id)    => this.isValidId(id),
      getGroupLabel : (id)    => this.labelFromMap(id, this._flavorsById),
      getGroupBadges: (item) => this.badgesFrom(item, this.badgeSpecs),
      makeRowId     : (item) => item.id,
      fillRow       : (row, items) => { 
                      this.fillRowFromColumns(row, items, {
                        resolveTitleKeys: new Map([
                          ["flavor", this._flavorsById],
                        ]),
                      });
                    }
    });
  }

}

////////////////////////////////////////
// DATA tools
//////////////////////////////

// WP / PODs cleaner-upper...
class DoNorm{

  static normalize(D) {
    if (!D || typeof D !== "object") return D;

    // Shallow clone so we don't mutate the loader result accidentally
    const nD = { ...D };

    // Normalize top-level collections (only if present)
    if (Array.isArray(nD.tubs))      nD.tubs      = DoNorm.nTubs(nD.tubs);
    if (Array.isArray(nD.slots))     nD.slots     = DoNorm.nSlots(nD.slots);
    if (Array.isArray(nD.cabinets))  nD.cabinets  = DoNorm.nCabinets(nD.cabinets);
    if (Array.isArray(nD.flavors))   nD.flavors   = DoNorm.nFlavors(nD.flavors);
    if (Array.isArray(nD.locations)) nD.locations = DoNorm.nLocations
      ? DoNorm.nLocations(nD.locations)
      : nD.locations;

    // Singular location endpoint (if you keep it)
    if (nD.location && typeof nD.location === "object") {
      nD.location = DoNorm.nLocations
        ? DoNorm.nLocations([nD.location])[0]
        : nD.location;
    }

    return nD;
  }


  static nTubs(tubs = []) {
    if (!Array.isArray(tubs)) return [];

    return tubs.map(t => {
      // Preserve non-objects as-is (defensive)
      if (!t || typeof t !== "object") return t;

      // --- canonical id/title ---
      if (t.id == null || t.id === 0) t.id = DoNorm._idOf(t.id ?? t.ID);
      t._title = DoNorm._titleOf(t);

      // --- scalar overwrites ---
      t.state     = DoNorm._titleOf(t.state);   // ["Freezing"] -> "Freezing"; "Freezing" -> "Freezing"
      t.flavor    = DoNorm._idOf(t.flavor);      // [ {ID:...} ] or 1783 -> 1783
      t.location  = DoNorm._idOf(t.location);    // [ {ID:...} ] or 935  -> 935
      t.batch     = DoNorm._idOf(t.batch);       // [ {ID:...} ] or 1782 -> 1782
      t.cabinet   = DoNorm._idOf(t.cabinet);     // false -> 0, id/object/array -> id

      return t;
    });
  }

  static nSlots(slots = []) {
    if (!Array.isArray(slots)) return [];

    return slots.map(s => {
      if (!s || typeof s !== "object") return s;

      // --- canonical id / title ---
      if (s.id == null || s.id === 0) s.id = DoNorm._idOf(s.id ?? s.ID);
      s._title = DoNorm._titleOf(s);

      // --- scalar relationships ---
      s.cabinet           = DoNorm._idOf(s.cabinet);
      s.current_flavor    = DoNorm._idOf(s.current_flavor);
      s.immediate_flavor  = DoNorm._idOf(s.immediate_flavor);
      s.next_flavor       = DoNorm._idOf(s.next_flavor);

      return s;
    });
  }

  static nCabinets(cabinets = []) {
    if (!Array.isArray(cabinets)) return [];

    return cabinets.map(c => {
      if (!c || typeof c !== "object") return c;

      // --- canonical id / title ---
      if (c.id == null || c.id === 0) c.id = DoNorm._idOf(c.id ?? c.ID);
      c._title = DoNorm._titleOf(c);

      // --- scalar relationship aliases ---
      c.location = DoNorm._idOf(c.location);

      // --- numeric coercions (safe, mechanical) ---
      if (c.max_tubs != null) {
        const n = Number(c.max_tubs);
        c.max_tubs = Number.isFinite(n) ? n : 0;
      }

      return c;
    });
  }

  static nFlavors(flavors = []) {
    if (!Array.isArray(flavors)) return [];

    return flavors.map(f => {
      if (!f || typeof f !== "object") return f;

      // --- canonical id / title ---
      if (f.id == null || f.id === 0) f.id = DoNorm._idOf(f.id ?? f.ID);
      f._title = DoNorm._titleOf(f);

      // --- normalize embedded tubs ---
      if (Array.isArray(f.tubs)) {
        f.tubs = DoNorm.nTubs(f.tubs);
      }

      return f;
    });
  }

  static _first(v){ 
    if (v == null) return null;
    return Array.isArray(v) ? (v.length ? v[0] : null) : v;
  }
  static _idOf(v){
      const x = DoNorm._first(v);
      if (x == null || x === false ) return 0;
      if (typeof x === "object")  
        return DoNorm._idOf(x.id ?? x.ID ?? x.value);
      
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
  }
  static _titleOf(v){ 
    const x = DoNorm._first(v);
    if (x == null || x === false) return "";
    if (typeof x === 'string') return x;
    if (typeof x === "object"){
      const t = x.title;
      if (t && typeof t === "string") return t;
      if (t && typeof t === "object" && typeof t.rendered === "string") return t.rendered;
      
      if (typeof x.post_title === "string") return x.post_title;
      if (typeof x.name === "string") return x.name;
      if (typeof x.slug === "string") return x.slug;
      if (typeof x.rendered === "string") return x.rendered;
    }

    return '';
  }

}

// DataLoader
class DataLoader {
  constructor(endpoints) {
    this.endpoints = endpoints; // { cells, meta, options, ... }
    this.controller = new AbortController();
  }

  async fetchJSON(url) {
    const res = await fetch(url, {
      signal: this.controller.signal,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return res.json();
  }

  static byId(list, key = "id") {
    const map = new Map();
    for (const item of (list ?? [])) {
      const id = item?.[key];
      if (id != null) map.set(id, item);
    }
    return map;
  }

  static groupBy(list, keyFn) {
    const m = new Map();

    if(!Array.isArray(list)){
      console.log("Missing data to group by. Did the data need to be loaded?");
      throw new TypeError(
        `DataLoader.groupBy expected an array, got ${Object.prototype.toString.call(list)}`
      );
    }

    for (const item of list) {
      const k = keyFn(item);
      const arr = m.get(k) ?? [];
      arr.push(item);
      m.set(k, arr);
    }
    return m;
  }

  async load() {
    const entries = Object.entries(this.endpoints);

    const results = await Promise.all(
      entries.map(([_, url]) => this.fetchJSON(url))
    );

    // Rebuild object with same keys
    return Object.fromEntries(
      entries.map(([key], i) => [key, results[i]])
    );
  }

  abort() {
    this.controller.abort();
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  // Safe to query and manipulate DOM elements

  const loader = new DataLoader({
    cabinets: "/wp-json/wp/v2/cabinets.json",
    flavors:  "/wp-json/wp/v2/flavors.json",
    slots:    "/wp-json/wp/v2/slots.json",
    location: "/wp-json/wp/v2/location.json",
    locations:"/wp-json/wp/v2/locations.json",
    tubs:     "/wp-json/wp/v2/tubs.json"
  });

  const raw = await loader.load();
  const D   = DoNorm.normalize(raw);


  const CGM = new CabinetGridModel(D);
  const FTM = new FlavorTubsGridModel(D);

  const grid = new Grid(document.body, CGM );
  await grid.init();

  const tub = new Grid(document.body, FTM );
  await tub.init();
  
});
