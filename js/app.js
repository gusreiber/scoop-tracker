
////////////////////////////////////////
// GUI CONTROLS
/////////////////////////////
// TYPE TO COMPLETE ----------------
class FindIt{
  constructor(target, data = {id:0,display:'',type:'',options:[],badges:[]} ){
    this.target = target;
    this.data = data;
    console.log(data);
    this.name = data.type + '_' + data.colKey;
    this.currentValue = data;
    this.options = data.options || [];
    this.BASE = document.createElement('div');
    this.UL = document.createElement('ul');

    this.render();
  }
  
  render() {
    const el = (tag, {
      text,
      html,
      attrs = {},
      classes = [],
      on = {},
    } = {}) => {
      const n = document.createElement(tag);

      if (text != null) n.textContent = text;
      if (html != null) n.innerHTML = html;

      if (Array.isArray(classes) && classes.length) {
        n.classList.add(...classes);
      }

      for (const [k, v] of Object.entries(attrs)) {
        if (v != null) n.setAttribute(k, v);
      }

      for (const [evt, fn] of Object.entries(on)) {
        n.addEventListener(evt, fn);
      }

      return n;
    };
    
    this.BASE.classList.add('findIt',this.name);
    this.UL.classList.add('options');
    const BTN = el('button', { classes: ['clear'], text:'X'});
    const HDN = el('input',  { attrs: {type:'hidden', name:this.name+'_id'}});
    const INP = el('input',  { attrs: {
        type: 'text',
        name:this.name,
        value: this.currentValue.display,
        autocomplete: 'off'
      }
    });
    
    for (const op of this.options) {
      const A = el('a', {
        text: op.label,
        attrs: { 'data-key': op.key, tabindex: 0 }
      });

      const LI = el('li');
      LI.append(A);
      this.UL.append(LI);
    }

    this.BASE.append(HDN, INP, BTN, ((this.options.length > 0)?this.UL:null));
    this.target.append(this.BASE);

    this.bindEvents();
  }
  bindEvents(){
    const HDN = this.BASE.querySelector('input[type="hidden"]');
    const INP = this.BASE.querySelector('input[type="text"]');
    const UL  = this.BASE.querySelector('ul.options');
    const X   = this.BASE.querySelector('button.clear');
    
    INP.addEventListener("input", () => {
      this.filtered = this._matchOptions(INP.value);
      this.activeIndex = this.filtered.length ? 0 : -1;
      this._renderOptions();
    });

    INP.addEventListener("keydown", (e) => {
      if (!this.filtered?.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
        this._renderOptions();
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        this._renderOptions();
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const op = this.filtered[this.activeIndex];
        if (op) this._select(op);
      }

      if (e.key === "Escape") {
        e.preventDefault();
        this.activeIndex = -1;
        this._renderOptions();
      }
    });

    this.UL.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-key]");
      if (!a) return;
      e.preventDefault();
      const op = this.filtered.find(x => String(x.key) === a.dataset.key);
      if (op) this._select(op);
    });

    this.UL.addEventListener('click', (e)=>{
      const a = e.target.closest('a');
      if (!a || !this.UL.contains(a)) return;
      const label = a.textContent;
      const key   = a.dataset.key;

      INP.value = label;
    });

    X.addEventListener('click', (e)=>{
      INP.value = '';
    });

  }

  // ---- lost method (the important one)
  _select(key){
    const opt = this.options.find(o => String(o.key) === String(key));
    if (!opt) return;

    this.currentValue = opt.label ?? "";
    this.INP.value = this.currentValue;

    // optional: notify host
    this.onSelect?.(opt);

    this._close();
  }

  _norm(s){
    return (s ?? "")
      .toString()
      .trim()
      .toLowerCase();
  }


  _matchOptions(query){
    const q = this._norm(query);
    if (!q) return this.options;

    const scored = this.options.map(op => {
      const s = this._norm(op.label);
      if (s.startsWith(q)) return { op, score: 0 };
      const i = s.indexOf(q);
      if (i >= 0) return { op, score: 10 + i };
      return null;
    }).filter(Boolean);

    scored.sort((a,b) => a.score - b.score);
    return scored.map(x => x.op);
  }

  _renderOptions(){
    this.UL.replaceChildren();

    this.filtered.forEach((op, i) => {
      const A = document.createElement("a");
      A.href = "#";
      A.dataset.key = op.key;
      A.tabIndex = -1;                 // keep tab on the input; roving focus later
      A.textContent = op.label;
      if (i === this.activeIndex) A.classList.add("active");

      const LI = document.createElement("li");
      LI.append(A);
      this.UL.append(LI);
    });
  }

  
}

// GRID ---------------------------
class Grid{
  constructor(target, state, name = ""){
    this.target = target;
    this.state = state;
    this.name = name;
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

    const { columns, rows,  minCount } = this.state;
    
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

        // badges (from getGroupBadges)
        const BDGs = el("span", "badges");
        for (const b of (g.badges ?? [])) {
          const B = el("span", "badge");
          B.textContent = b.text;      // e.g. "U:3"
          if (b.title) B.title = b.title;
          BDGs.append(B);
        }
        GD.append(BDGs);
        GR.append(GD);
        TBODY.append(GR);
      }
      
      const ROW = el('tr','row');
      for(let x = 0; x < columns.length; x++){
        // badges (from fillRow -> rowOptions -> _cellBadges)
        const cBadges  = (rows[y]._cellBadges)? rows[y]._cellBadges[columns[x].key]:[];
        const cOptions = (rows[y]._options)?    rows[y]._options[columns[x].key]:[];
    
        const BDGs = el("span", "badges"); 
        if(cBadges) for(const b of cBadges){
          const B = el("span", "badge", (b?b.class:''));
          B.textContent = b.text;
          if (b.title) B.title = b.title;
          BDGs.append(B);
        }
        const CELL  = el('td','cell', columns[x].key);
        const data = rows[y]?.[columns[x].key] ?? "";
        const INP   = new FindIt(CELL, data);

        CELL.append(BDGs);
        ROW.append(CELL);
      }

      TBODY.append(ROW);
    }
    
    this.target.append(TABLE);

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
class Flavor {
  constructor({ flavorsById, tubs, location }) {
    this.flavorsById = flavorsById;
    this.location = location;

    const isAvail = t => t.state !== "Opened" && t.state !== "Emptied";

    const allAvail = (tubs ?? []).filter(isAvail);
    const locAvail = allAvail.filter(t => t.location === location);
    const rmtAvail = allAvail.filter(t => t.location !== location);

    this.availAll = DataLoader.groupBy(allAvail, t => t.flavor);
    this.availLoc = DataLoader.groupBy(locAvail, t => t.flavor);
    this.availRmt = DataLoader.groupBy(rmtAvail, t => t.flavor);

    this.optionsAll = [...flavorsById.entries()]
      .map(([id, f]) => ({ key: id, label: f._title }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  
  badges(id, specs) {
    if (!id) return [];
    return (specs ?? [])
      .map(s => {
        const n = s.count(id, this);
        if (s.hideZero && !n) return null;
        return { key: s.key, text: s.format(n), title: s.title ?? "" };
      })
      .filter(Boolean);
  }


  getFlavorBadgeSpecs() {
    return [
      { key:"loc", title:"Available here", hideZero:true,
        count:(flavorId, m) => m.availLoc.get(flavorId)?.length ?? 0,
        format:n => `L:${n}` },

      { key:"rmt", title:"Available elsewhere", hideZero:true,
        count:(flavorId, m) => m.availRmt.get(flavorId)?.length ?? 0,
        format:n => `R:${n}` },
    ];
  }
}

class BaseGridModel {
  
  constructor(domain, { location } = {}) {
    this.domain = domain;
    this.location = Number(location);

    // --- grid contract ---
    this.columns = [];
    this.rows = [];
    this.rowGroups = [];
    this.minCount = 0;

    // --- derived indexes (convenience, not exposed to Grid) ---
    this._tubsById         = DataLoader.byId(domain.tubs.filter(t => t.state !== 'emptied'));
    this._flavorsById      = DataLoader.byId(domain.flavors);
    this._availByFlavor    = DataLoader.groupBy(
                              domain.tubs.filter( t => t.state !== "Emptied"),
                              t => t.flavor
                            );

    this.flavorMeta = new Flavor({
      flavorsById: this._flavorsById,
      tubs: domain.tubs,
      location: this.location
    });

    this.fBadgeSpecs = this.flavorMeta.getFlavorBadgeSpecs();
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
  
  labelFromMap(objOrId, map, {fieldKey = null, fallbackNoun = "Item"} = {}){
    const id = fieldKey
      ? objOrId?.[fieldKey]
      : objOrId;

    if (!id) return null;

    const item = map?.get?.(id);
    return item?._title ?? `${fallbackNoun} ${id}`;

  }

  build() {
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
    getGroupBadges,       // optional callback to get meta info on groups
    getCellBadges,        // optional callback to get meta info on cells
    makeRowId,            // (item) => any
    fillRow,              // (row, item) => void
    groupIdKey = "groupId"// key name stored in rowGroups entries
  }) {
    this.rows = [];
    this.rowGroups = [];
    let i = 0;
    for (const [groupId, items] of (groupsMap ?? new Map()).entries()) {
      if (includeGroupId && !includeGroupId(groupId)) continue;

      const badges = getGroupBadges ? (getGroupBadges(items, groupId) ?? []) : [];

      this.rowGroups.push({
        index       : i,
        startIndex  : this.rows.length,
        label       : getGroupLabel ? getGroupLabel(groupId) : String(groupId),
        [groupIdKey]: groupId,
        badges
      });

      for (const item of (items ?? [])) {
        const row = { id: makeRowId ? makeRowId(item) : item?.id };
        if (fillRow) fillRow(row, item, i++);
        this.rows.push(row);
      }
    }

    return this.rows;

  }
  

  getBadges( type, fieldName, id){
    // TODO: Badges could differ by type or field name, but at the moment
    // I only have flavor bages and they are all tub counts of that ID.
    return this.flavorMeta.badges(id, this.fBadgeSpecs);
  }

  getOptions( type, fieldName, id){
    return this.flavorMeta.optionsAll;
  }

  fillRowFromColumns(
    row, // The row so far...
    obj, // THE RAW DATA for the item that is the basis for the row
    i,   // a simple 
  ) 
  {
    for (const col of this.columns) {
      const key = col?.key;
      if (!key) continue;
      console.log('col',col);
    
      if(col.type && Number.isInteger(obj?.[key] ?? null)){
        if(col.type === 'flavor'){
          row[key] = {
            id      : obj[key],
            rowId   : obj['id'] || i,
            display : DoNorm?._titleOf(this._flavorsById.get(obj[key]) ?? obj[key] ),
            type    : col.type,
            colKey  : col.key,
            options : this.getOptions( col.type, col.key, row[key] ),
            badges  : this.getBadges( col.type, col.key, row[key] ),
          }
        } 
        else row[key] = { 
          id      : obj[key],
          rowId   : obj['id'] || i,
          display : DoNorm._titleOf(this._flavorsById.get(obj[key])),
          type    : col.type,
          colKey  : col.key,
          options : this.getOptions(row[key], col.type),
          badges  : this.getBadges(row[key], col.type),
        };
      }
      else row[key] = { rowId: obj['id'] || i, display: obj?.[key] ?? null, type: col.type, colKey: col.key}

    }
  }


}

class CabinetGridModel extends BaseGridModel{
  constructor(domain, { location = 935 } = {}) {
    super(domain, { location });

    this._cabinetsById = DataLoader.byId(domain.cabinets);
    this._flavorsById  = DataLoader.byId(domain.flavors);

    this._slotsByCabinetId = DataLoader.groupBy(domain.slots, s => s.cabinet);



    this.build();
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'current_flavor',  label:'Current Flavor',   type:"flavor"},
      {key:'immediate_flavor',label:'Immediate Flavor', type:"flavor"},
      {key:'next_flavor',     label:'Planned Flavor',   type:"flavor"}
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
      getCellBadges : (items) => this.badgesFrom(items, this.cellBadgeSpecs),
      fillRow       : (row, item, i) => { this.fillRowFromColumns(row, item, i); }
    });
  }

}

class FlavorTubsGridModel extends BaseGridModel{
  constructor(domain, {location = 935} = {} ){
    super(domain, { location });

    
    
    this.build();
    console.log(this);
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'state',           label:'state'},
      {key:'flavor',          label:'flavor',  type:"flavor"},
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
      includeGroupId: (id)   => Number(id) > 0,
      getGroupLabel : (id)   => this.labelFromMap(id, this._flavorsById),
      makeRowId     : (item) => item.id,
      getGroupBadges: (items, flavorId) => this.flavorMeta.badges(flavorId, this.fBadgeSpecs), // optional hide-zero
      fillRow       : (row, items, i) => { this.fillRowFromColumns(row, items, i); }
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

  const grid = new Grid(document.body, CGM, 'planning' );
  await grid.init();

  const tub = new Grid(document.body, FTM, 'tubs' );
  await tub.init();
  
});
