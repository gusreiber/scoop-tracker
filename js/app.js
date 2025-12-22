import {
  extractPlanningChangesFromForm,
  validatePlanningChanges
} from "./slotChecker.js";

////////////////////////////////////////
// GUI CONTROLS
/////////////////////////////
// TYPE TO COMPLETE ----------------
class FindIt{
  constructor(
    target,
    data = { id: 0, rowId: 0, colKey: "", display: "", type: "", options: [], badges: [] },
    formKey = ''
    //{ formKey = "grid", includeDisplayName = false } = {}
  ) {
    this.target = target;
    this.data   = data ?? {};
    this.formKey = formKey;

    // Authoritative value + options
    this.value   = this.data.id ?? 0;
    this.display = this.data.display ?? "";
    this.options = Array.isArray(this.data.options) ? this.data.options : [];
    this.showAll = false;

    // Required for stable field names
    this.rowId  = this.data.rowId ?? this.data.id ?? 0;
    this.colKey = this.data.colKey ?? "";
    this.type   = this.data.type ?? "";

    // Name for the hidden input only (visible input can be nameless)
    // Example: planning[cells][1181][current_flavor]
    this.fieldName = `${this.formKey}[cells][${this.rowId}][${this.colKey}]`;

    /* Optional: keep a display field in POST if you ever want it
    this.displayName = includeDisplayName
      ? `${this.formKey}[display][${this.rowId}][${this.colKey}]`
      : null;
    */
    // Root elements
    this.BASE = document.createElement("div");
    this.UL   = document.createElement("ul");

    this.render();
  }

  // --- HELPERS ---
  _el(tag, { text, html, attrs = {}, classes = [], on = {} } = {}) {
    const n = document.createElement(tag);

    if (text != null) n.textContent = text;
    if (html != null) n.innerHTML = html;
    if (classes?.length) n.classList.add(...classes);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    for (const [evt, fn] of Object.entries(on)) n.addEventListener(evt, fn);

    return n;
  }

  _showAllOptions() {
    this.showAll = true;
    this.filtered = this.options;           // all options
    this.activeIndex = this.filtered.length ? 0 : -1;
    this._renderOptions();
  }

  _open() {
    if (this.isOpen) return;

    // Nothing to show — never attach UL
    if (!this.options || this.options.length === 0) return;

    this.isOpen = true;

    if (!this.BASE.contains(this.UL)) this.BASE.append(this.UL);

    this.filtered = this._matchOptions(this.INP.value);
    this.activeIndex = this.filtered.length ? 0 : -1;
    this._renderOptions();
  }


  _close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.activeIndex = -1;

    if (this.BASE.contains(this.UL)) this.UL.remove();
  }

  _commitActive() {
    const op = this.filtered?.[this.activeIndex];
    if (!op) return false;
    this._select(op);      // must accept option object
    return true;
  }

  _clear() {
    this.HDN.value = "";
    this.INP.value = "";
    this.value = 0;
    this.display = "";
    this.filtered = this._matchOptions("");
    this.activeIndex = this.filtered.length ? 0 : -1;
    if (this.isOpen) this._renderOptions();
  }

  _select(op) {
    // authoritative value
    this.value = op?.key ?? 0;
    this.display = op?.label ?? "";

    this.HDN.value = String(this.value || "");
    this.INP.value = this.display;

    this.onSelect?.(op);

    this._close();
  }

  _norm(s) {
    return (s ?? "").toString().trim().toLowerCase();
  }

  _matchOptions(query) {
    const q = this._norm(query);
    const opts = Array.isArray(this.options) ? this.options : [];
    if (!q) return opts;

    const scored = [];
    for (const op of opts) {
      const label = this._norm(op.label);
      if (!label) continue;

      if (label.startsWith(q)) scored.push({ op, score: 0 });
      else {
        const i = label.indexOf(q);
        if (i >= 0) scored.push({ op, score: 10 + i });
      }
    }

    scored.sort((a, b) => a.score - b.score);
    return scored.map(x => x.op);
  }

  _renderOptions() {
    const el = this._el.bind(this);

    this.UL.replaceChildren();

    const list = this.filtered ?? [];
    for (let i = 0; i < list.length; i++) {
      const op = list[i];

      const A = el("a", {
        text: op?.label ?? "",
        attrs: {
          href: "#",
          "data-key": String(op?.key ?? ""),
          tabindex: "-1",
        }
      });

      const LI = el("li",{
        classes: (i === this.activeIndex) ? ["active"] : []
      });
      LI.append(A);
      this.UL.append(LI);
    }
}

  // --- RENDER ---
  render() {
    const el = this._el.bind(this);

    // Root
    this.BASE.className = ""; // in case render() is ever re-called
    this.BASE.classList.add("findIt");
    if (this.type) this.BASE.classList.add(`type-${this.type}`);
    if (this.colKey) this.BASE.classList.add(`col-${this.colKey}`);

    // Hidden authoritative value
    const HDN = el("input", {
      attrs: { type: "hidden", name: this.fieldName, value: String(this.value ?? "") }
    });

    // Visible input is UI-only (no name by default)
    const inpAttrs = {
      type: "text",
      value: this.display ?? "",
      autocomplete: "off",
      "data-field": this.fieldName
    };
    if (this.displayName) inpAttrs.name = this.displayName;

    const INP = el("input", { attrs: inpAttrs });

    // Clear button should not submit the parent form
    const BTN = el("button", {
      classes: ["clear"],
      text: "X",
      attrs: { type: "button" }
    });
    this.BTN = BTN;

    // Options list (leave in place for now; you can lazy-fill later)
    this.UL.className = "";
    this.UL.classList.add("options");
    this.UL.replaceChildren();

    /*
    for (const op of this.options) {
      const A = el("a", {
        text: op.label ?? "",
        attrs: {
          href: "#",
          "data-key": op.key,
          tabindex: -1
        }
      });

      const LI = el("li");
      LI.append(A);
      this.UL.append(LI);
    }
    */
    // Compose
    this.BASE.replaceChildren();
    this.BASE.append(HDN, INP, BTN);
    if (this.options.length) this.BASE.append(this.UL);

    this.target.append(this.BASE);

    // Cache references for other methods (bindEvents/_select/etc.)
    this.HDN = HDN;
    this.INP = INP;

    this.bindEvents();
  }

  // --- bindEvents refactored to use the helpers ---
  bindEvents() {
    this.filtered = [];
    this.activeIndex = -1;
    this.isOpen = false;

    // open on focus
    this.INP.addEventListener("focus", () => this._open());

    // filter on input
    this.INP.addEventListener("input", () => {
      if (!this.isOpen) this._open();
      this.showAll = false;                   // typing means filter mode
      this.filtered = this._matchOptions(this.INP.value);
      this.activeIndex = this.filtered.length ? 0 : -1;
      this._renderOptions();
    });

    // keyboard navigation + commit
    this.INP.addEventListener("keydown", (e) => {
      const k = e.key;

      if (k === "Escape") {
        e.preventDefault();
        this._clear();   // your requested behavior: ESC clears
        this._close();
        return;
      }

      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();

        if (!this.isOpen) this._open();
        if (!this.filtered?.length) return;
        const dir = (k === "ArrowDown") ? 1 : -1;
        const n = this.filtered.length;

        if (this.activeIndex < 0) this.activeIndex = 0;
        else this.activeIndex = (this.activeIndex + dir + n) % n;

        this._renderOptions();

        // keep highlighted option visible
        const activeEl = this.UL.querySelector(".active");
        activeEl?.scrollIntoView({ block: "nearest" });

        return;
      }



      if (!this.isOpen) return;


      if (k === "ArrowUp") {
        e.preventDefault();
        if (!this.filtered.length) return;
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        this._renderOptions();
        return;
      }

      if (k === "Enter" || k === " ") {
        if (!this.isOpen) return;              // allow normal typing behavior when closed
        e.preventDefault();
        this._commitActive();
        return;
      }


    });

    // click selection
    this.UL.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-key]");
      if (!a) return;
      e.preventDefault();
      const op = this.filtered?.find(x => String(x.key) === String(a.dataset.key));
      if (op) this._select(op);
    });

    // click-outside closes
    document.addEventListener("mousedown", (e) => {
      if (!this.isOpen) return;
      if (this.BASE.contains(e.target)) return;
      this._close();
    });

    // clear button
    this.BTN.addEventListener("click", (e) => {
      e.preventDefault();
      this._clear();
      this.INP.focus();
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
    
    const FORM   = el('form', 'zGRID-form');
    const SUBMIT = el('button');
    const TABLE  = el('table', 'zGRID');
    const THEAD  = el("thead");
    const TRH    = el("tr");

    this.FORM = FORM;

    SUBMIT.setAttribute('type','submit');
    SUBMIT.append('Submit');

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
        const col = this.state.columns[x];
        const BDGs = el("span", "badges"); 
 
        const CELL = el('td','cell', columns[x].key);
        const data = rows[y]?.[columns[x].key] ?? "";
        if(col.write) new FindIt(CELL, data, this.name);
        else{
          CELL.append(data.display);
          CELL.classList.add('read-only');
        }
        
        CELL.append(BDGs);
        ROW.append(CELL);
      }

      TBODY.append(ROW);
    }
    
    FORM.append(TABLE);
    FORM.append(SUBMIT);
    this.target.append(FORM);

  }

  bindEvents() {
    console.log('Grid EVENTS', this.FORM);
    if (!this.FORM) return;

    // Only validate the planning grid posts
    if (this.name !== "planning") return;

    this.FORM.addEventListener("submit", (e) => {
      e.preventDefault();
      alert('?');

      // 1) extract "planning[cells][slotId][colKey]" from the form
      const { changes } = extractPlanningChangesFromForm(this.FORM, this.name);

      // 2) validate against your current domain model
      // IMPORTANT: your BaseGridModel holds `domain` as `this.state.domain`
      const domain = this.state.domain;
      const location = this.state.location;

      const result = validatePlanningChanges(changes, domain, { location });

      // 3) act like a REST response
      if (!result.ok) {
        console.log("VALIDATION FAILED", result);
        // TODO: show inline errors next to cells
        return;
      }

      // You may still want to show warnings but proceed
      if (result.warnings.length || Object.keys(result.fieldWarnings).length) {
        console.log("VALIDATION WARNINGS", result.warnings, result.fieldWarnings);
      }

      // 4) "pretend POST" (this is your mock endpoint)
      // The important artifact is `result.normalized`
      console.log("MOCK POST OK. Normalized payload:", result.normalized);

      // Optional: mark form clean / disable submit / etc.
    });
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
      {key:'current_flavor',  label:'Current Flavor',   type:"flavor",   write:true},
      {key:'immediate_flavor',label:'Immediate Flavor', type:"flavor",   write:true},
      {key:'next_flavor',     label:'Planned Flavor',   type:"flavor",   write:true}
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