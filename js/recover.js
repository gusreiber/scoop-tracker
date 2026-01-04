////////////////////////////////////////
// GUI CONTROLS
/////////////////////////////
class Toast {
  static _el(tag, text='', ...classes) {
    const n = document.createElement(tag);
    if (classes.length) n.classList.add(...classes);
    if(text.length > 0) n.append(text);
    return n;
  }
  static _ensureHost(){
    let TOASTER = document.querySelector('body > .TOASTER'); 
    if(TOASTER) return TOASTER;

    TOASTER = Toast._el('div', '', 'TOASTER');
    document.body.append(TOASTER);
    return TOASTER;
  }

  static addMessage({title='title', message='This event happened', state='OK'}){
    const date    = Date.now();
    const TOASTER = Toast._ensureHost();
    const TOAST   = Toast._el('div', '', 'TOAST', state, 't'+date);
    const H3      = Toast._el('h3', title);
    const P       = Toast._el('p', message);
    const DATE    = Toast._el('spen', new Date(date).toLocaleString(), 'date' );
    const CLOSE   = Toast._el('button', 'x', 'close');

    CLOSE.addEventListener('click', (e)=>{
      e.target.closest('.TOAST').remove();
      Toast.hide();
    });

    TOAST.append(DATE);
    TOAST.append(H3);
    TOAST.append(P);
    TOAST.append(CLOSE);

    TOASTER.append(TOAST);
    TOASTER.classList.add('show');
  }
  static hide(){
    Toast._ensureHost().classList.remove('show');
  }
  static show(){
    Toast._ensureHost().classList.add('show');
  }
  static empty(){
    Toast._ensureHost().replaceChildren();
  }

}

// Simple text input
class TextIt {
  constructor(target, data, formKey = "") {
    this.target = target;
    this.data = data ?? {};
    this.formKey = formKey;

    this.value = this.data.value ?? this.data.display ?? "";
    this.rowId  = this.data.rowId ?? this.data.id ?? 0;
    this.colKey = this.data.colKey ?? "";
    this.type   = this.data.type ?? "text"; // "number" or "text"

    this.fieldName = `${this.formKey}[cells][${this.rowId}][${this.colKey}]`;

    this.render();
  }

  render() {
    this.target.classList.add('textIt-box');
    const HDN = document.createElement("input");
    HDN.type = "hidden";
    HDN.name = this.fieldName;
    HDN.value = String(this.value ?? "");

    const INP = document.createElement("input");
    INP.type = (this.type === "number") ? "number" : "text";
    INP.value = String(this.value ?? "");
    INP.autocomplete = "off";

    // Keep hidden input authoritative
    INP.addEventListener("input", () => {
      HDN.value = INP.value;
      HDN.dispatchEvent(new Event("fi_change", { bubbles: true }));
    });

    const BTN = document.createElement("button");
    BTN.type = "button";
    BTN.classList.add("clear");
    BTN.textContent = "X";
    BTN.addEventListener("click", (e) => {
      e.preventDefault();
      INP.value = "";
      HDN.value = "";
      INP.focus();
      HDN.dispatchEvent(new Event("fi_change", { bubbles: true }));
    });

    const BASE = document.createElement("div");
    BASE.classList.add("textIt",'cell', `col-${this.colKey}`);

    BASE.append(HDN, INP, BTN);
    this.target.append(BASE);

    this.HDN = HDN;
    this.INP = INP;
  }
}


// TYPE TO COMPLETE ----------------
class Find{
   
  static norm(s) {
    return (s ?? "").toString().trim().toLowerCase();
  }

  /**
   * Match items against a query.
   * items: array of objects
   * getText: fn(item) => string
   */
  static match(query, items, getText) {
    const q = Find.norm(query);
    if (!q) return items;

    const scored = [];

    for (const item of items) {
      const text = Find.norm(getText(item));
      if (!text) continue;

      if (text.startsWith(q)) {
        scored.push({ item, score: 0 });
      } else {
        const i = text.indexOf(q);
        if (i >= 0) scored.push({ item, score: 10 + i });
      }
    }

    scored.sort((a, b) => a.score - b.score);
    return scored.map(x => x.item);
  }

}

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
    
    this.HDN.dispatchEvent(new Event("fi_change", { bubbles: true }));

    this._close();
  }

  _matchOptions(query) {
    return Find.match(
      query,
      this.options ?? [],
      op => op.label
    );
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

    
    // Listen on the closest form (scoped) or fall back to document (global)
    const root = this.BASE.closest("form") ?? document;

    root.addEventListener("grid:close-findits", () => {
      this._close();
    });


    // open on focus
    this.INP.addEventListener("focus", () => this._open());

    // filter on input
    this.INP.addEventListener("input", () => {
      if (!this.isOpen) this._open();                 // typing means filter mode
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

    // clear button
    this.BTN.addEventListener("click", (e) => {
      e.preventDefault();
      this._clear();
      this.INP.focus();
    });
  }


  
} 

// GRID ---------------------------
class Grid {
  constructor(target, name="", {
                api = {baseUrl:'/'},
                formCodec = FormCodec,
                domainCodec = DomainCodec,
              } = {}) 
  {
    this.target = target;
    this.api = api;
    this.formCodec = formCodec;
    this.domainCodec = domainCodec;

    this.state = null;
    this.name = name;
    this.FORM = this._el('form', 'zGRID-form');
    this.postUrl = api.baseUrl;
    
    this.baseline = new Map();   // key -> value
    this.dirtySet = new Set();   // key
    
    const { flat } = this.formCodec.extractGridChanges(this.FORM, this.name);
    for (const f of flat) {
      const k = `${f.rowId}|${f.colKey}`;
      this.baseline.set(k, f.value);
    }

  }
  
  init(state = this.state) {
    this.state = state;
    this.render();
    this.bindEvents();
  }

  _buildDirtyPayload() {
    const changes = { cells: {} };

    for (const k of this.dirtySet) {
      const [rowIdStr, colKey] = k.split("|");
      const rowId = Number(rowIdStr);

      const input = this.FORM.querySelector(
        `input[type="hidden"][name="${this.name}[cells][${rowId}][${colKey}]"]`
      );
      if (!input) continue;

      const value = this.formCodec.normalizeScalar(input.value ?? "");
      if (!changes.cells[rowId]) changes.cells[rowId] = {};
      changes.cells[rowId][colKey] = value;
    }

    return changes;
  }
  
  _captureBaseline() {
    const { flat } = this.formCodec.extractGridChanges(this.FORM, this.name);

    this.baseline = new Map();
    this.dirtySet = new Set();

    for (const f of flat) {
      const k = `${f.rowId}|${f.colKey}`;
      this.baseline.set(k, f.value);
    }

    this._updateDirtyIndicator(0);
  }

  _updateDirtyIndicator(n) {
    if (!this.DIRTY_IND) return;
    this.DIRTY_IND.textContent = `${n} change${n === 1 ? "" : "s"}`;
  }

  _commitPosted(changes) {
    for (const [rowId, row] of Object.entries(changes.cells ?? {})) {
      for (const [colKey, val] of Object.entries(row ?? {})) {
        const k = `${rowId}|${colKey}`;
        this.baseline.set(k, val);
        this.dirtySet.delete(k);
      }
    }
    this._updateDirtyIndicator(this.dirtySet.size);
  }
  
  _commitPosted(changes) {
    for (const [rowId, row] of Object.entries(changes.cells ?? {})) {
      for (const [colKey, val] of Object.entries(row ?? {})) {
        const k = `${rowId}|${colKey}`;
        this.baseline.set(k, val);
        this.dirtySet.delete(k);
      }
    }
    this._updateDirtyIndicator(this.dirtySet.size);
  }
  
  _el(tag, ...classes){
    const n = document.createElement(tag);
    if (classes.length) n.classList.add(...classes);
    return n;      
  }

  render() { 
    const groupByStart = new Map();
    for (const g of (this.state.rowGroups ?? [])) {
      groupByStart.set(g.startIndex, g);
    }

    const el = this._el;

    const { columns, rows,  minCount } = this.state;
    
    const FORM   = this.FORM;
    const SUBMIT = el('button', 'save');
    const TABLE  = el('table', 'zGRID');
    const THEAD  = el("thead");
    const TRH    = el("tr");
    
    SUBMIT.setAttribute('type','submit');
    SUBMIT.append('Submit');

    for (const col of columns) {
      const TH = el("th", col.key, col.type);
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
        TBODY = el("tbody", "groupBody", (g.collapsible?'collapsible':'static'), (g.collapsed?'closed':'opened') );
        TABLE.append(TBODY);
        const GR = el("tr",    "group");
        const GD = el("td",    "groupCell");
        const SP = el("b");
        const OC = (g.collapsible)? el('button', "oc"):null;
        GD.colSpan = columns.length;
        GR.dataset.rowId = g.groupId;
        GR.dataset.groupType = g.groupType;
        GR.dataset.groupLabel = g.label;
        TBODY.dataset.rowType = g.rowType;
        const LB = el("span", "groupLabel");
        LB.textContent = g.label;
        if(g.collapsible) {
            OC.append('!!!');
            SP.append(OC);
        }
        SP.append(LB);
        
        
        // badges (from getGroupBadges)
        const BDGs = el("span", "badges");
        for (const b of (g.badges ?? [])) {
          const B = el("span", "badge", b.key);
          B.textContent = b.text;      // e.g. "U:3"
          if (b.title) B.title = b.title;
          BDGs.append(B);
        }
        SP.append(BDGs);
        GD.append(SP);
        GR.append(GD);
        TBODY.append(GR);
      }
      
      const ROW = el('tr','row');
      ROW.dataset.rowId = rows[y].id.rowId;
      //ROW.dataset.rowLabel = rows[y].flavor.display;
      for(let x = 0; x < columns.length; x++){
        const col = this.state.columns[x];
        const data = rows[y]?.[columns[x].key] ?? "";
        const BDGs = el("span", "badges"); 
        for(const b of data?.badges ?? []){
          const B = el('span', 'badge', b.key);
          B.append(b.text);
          BDGs.append(B);
        }

        const CELL = el('td','cell', columns[x].key, columns[x].type);
        
        if(col.write){
          
          if(col.control === "text"){
            new TextIt(CELL, data, this.name);
          }
          else new FindIt(CELL, data, this.name);
        }else{
          CELL.append('' + (data.display || ''));
          CELL.classList.add('read-only');
        }
        
        CELL.append(BDGs);
        ROW.append(CELL);
        
      }

      TBODY.append(ROW);
    }
    if( !TABLE.contains(TBODY) ) TABLE.append(TBODY); 
    FORM.append(TABLE);
    FORM.append(SUBMIT);
    this.target.append(FORM);
    
  }

  bindEvents() {
    if (!this.FORM) return;
    
    this.FORM.addEventListener("fi_change", (e) => {
      const h = e.target.closest('input[type="hidden"][name]');
      if (!h) return;
    
      const parsed = this.formCodec.parseBracketName(h.name);
      if (!parsed || parsed.length < 4) return;
      if (parsed[0] !== this.name || parsed[1] !== "cells") return;
    
      const rowId = Number(parsed[2]);
      const colKey = parsed[3];
      const k = `${rowId}|${colKey}`;
    
      const v = this.formCodec.normalizeScalar(h.value ?? "");
      const before = this.baseline.get(k);
    
      if (before === v) this.dirtySet.delete(k);
      else this.dirtySet.add(k);
    
      // Display count wherever you want
      this._updateDirtyIndicator(this.dirtySet.size);
    });

    this.FORM.addEventListener("mousedown", (e) => {
        if(e.target.closest(".oc")){
            const TB = e.target.closest("TBODY");
            TB.classList.toggle('opened');
            TB.classList.toggle('closed');
        }
        
        if (e.target.closest(".findIt")) return;
        this.FORM.dispatchEvent(new Event("grid:close-findits"));
      },
      true // capture
    );

    // Only validate the planning grid posts
    //if (this.name !== "planning") return;

    this.FORM.addEventListener("submit", async (e) => {
      
      e.preventDefault();
      if(e.submitter.classList.contains('oc')) return false;
      console.log('FORM POST URL',this.postUrl);

      if (!this.api) throw new Error('Grid submit: missing this.api');
      if (!this.postUrl) throw new Error('Grid submit: missing this.postUrl');

      const submitBtn = this.FORM.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const changes = this._buildDirtyPayload();
        console.log("try changes", changes);
        // OPTIONAL: no-op submit guard
        if (!Object.keys(changes.cells).length) {
          console.log("No changes to submit.", changes);
          
          console.log("No Object to submit.", Object);
          return;
        }
        
        const r = await this.api.postJson(changes, this.name);

        if (!r.ok) {
          Toast.addMessage({title:'no POST', message:`HTTP ${r.status}`});
          return;
        }

        if (!r.data?.ok) {
          // app error payload from your endpoint
          // TODO: use r.data.errors to mark cells invalid
          Toast.addMessage({title:'bad post', message:JSON.stringify(r.data, null)});
          return;
        }
        if (r.ok && r.data?.ok) {
          console.log("COMMIT! result:", r);
        
          this._commitPosted(changes);
          Toast.addMessage({title:'Update saved', message:r.data.updated});
        }
        // TODO: mark successful cells as clean (e.g., store baseline values)
        
        
      } catch (err) {
        console.error("POST exception:", err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
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

    this.availAll = Indexer.groupBy(allAvail, t => t.flavor);
    this.availLoc = Indexer.groupBy(locAvail, t => t.flavor);
    this.availRmt = Indexer.groupBy(rmtAvail, t => t.flavor);

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
        format:n => `${n}` },

      { key:"rmt", title:"Available elsewhere", hideZero:true,
        count:(flavorId, m) => m.availRmt.get(flavorId)?.length ?? 0,
        format:n => `${n}` },
    ];
  }
}

class BaseGridModel {
  
  constructor(domain, { location } = {}) {
    this.domain = domain;
    this.location = Number(location);
    this.modelType = "base";

    // --- grid contract ---
    this.columns = [];
    this.rows = [];
    this.rowGroups = [];
    this.minCount = 0;

    // --- derived indexes (convenience, not exposed to Grid) ---
    this._tubsById         = Indexer.byId(domain.tubs.filter(t => t.state !== 'Emptied'));
    this._flavorsById      = Indexer.byId(domain.flavors);
    this._availByFlavor    = Indexer.groupBy(
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

  getById(map, id) {
    if (!id) return null;
    return map.get(Number(id)) ?? null;
  }

  titleById(map, id, fallback = "") {
    if(typeof map === 'undefined') return fallback || id;
    if (!id) return "";
    return map.get(Number(id))?._title ?? fallback;
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
    makeRowId,            // (item) => any
    fillRow,              // (row, item) => void
    groupType  = 'na',    // flavor, location, 
    rowType    = 'na',
    rowLabel   = 'na',
    collapsible= true, 
    collapsed  = false,
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
        groupType,
        rowType,
        rowLabel,
        badges,
        collapsible,
        collapsed
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
    // TODO: This is just a brute force return of the Flavors list
    // TODO: This should all go in the appropriate models, not options in the parent model
    // key and label are the properties the listed objects need
    if(type === 'flavor') return this.flavorMeta.optionsAll;
    if(type === 'state') return [
        {key:'__override__', label:'__override__'},
        {key:'Hardening',    label:'Hardening'},
        {key:'Freezing',     label:'Freezing'},
        {key:'Tempering',    label:'Tempering'},
        {key:'Opened',       label:'Opened'},
        {key:'Emptied',      label:'Emptied'}
    ];
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
      const id = Number(obj?.[key] ?? 0);
      if(typeof col.type === 'undefined') col.type = key; 

      if(col.write || (col.type && Number.isInteger(obj?.[key] ?? null) )){
        row[key] = { 
          id      : obj[key],
          rowId   : obj['id'] || i,
          display : this.titleById(this[('_'+ col.type +'sById')], obj[key], obj[key]),
          type    : col.type,
          colKey  : col.key,
          options : this.getOptions( col.type, col.key, id ),
          badges  : this.getBadges( col.type, col.key, id ),
        };
      }
      else{ 
          row[key] = { rowId: obj['id'] || i, display: obj?.[key] ?? null, type: col.type, colKey: col.key}
      }
    }
  }


}

class BatchGridModel extends BaseGridModel{

  constructor(domain, { location = 935, type = 'base' } = {} ) 
  {
    super(domain, { location });
      this._flavorsById  = Indexer.byId(domain.flavors) || {};
      this.modelType = { type };
      this.build();
  }

  buildCols() {
    this.columns = [
      { key: "count", label: "count", write: true, control: "text", type: "number" },
      { key: "flavor", label: "flavor", write: true, type: "flavor" }
    ];
    return this.columns;
  }
  
  builRows() {
    // single row
    const rowId = 0;
    
    this.rows = [
      {
        id: rowId,

        // count cell (TextIt expects value/display + rowId/colKey/type)
        count: { 
          rowId,
          colKey: "count",
          type: "number",
          value: ""          // default blank
        },

        // flavor cell (FindIt expects id/display/options/etc.)
        flavor: {
          id: 0,
          rowId,
          colKey: "flavor",
          type: "flavor",
          display: "",
          options: this.getOptions("flavor", "flavor", 0),
          badges: []
        }
      }
    ];

    return this.rows;
  } 

}

class FlavorTubsGridModel extends BaseGridModel{
  constructor(domain, {location = 935, type = 'na'} = {} ){
    super(domain, { location });
    this.modelType = { type };
    this.build();
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'state',           label:'state',   write:true},
      {key:'flavor',          label:'flavor',  type:"flavor"},
      {key:'date',            label:'date'},
      {key:'index',           label:'index'},
    ]

    return this.columns;
  }

  builRows(){
    const locationTubIds = this.filterByLocation(this.domain.tubs);
    const tubsByFlavorId = Indexer.groupBy(locationTubIds, t => t.flavor);
                   
    return this.buildGroupedRows({
      groupsMap     : tubsByFlavorId,
      includeGroupId: (id)   => Number(id) > 0,
      getGroupLabel : (id)   => this.labelFromMap(id, this._flavorsById),
      makeRowId     : (item) => item.id,
      getGroupBadges: (items, flavorId) => this.flavorMeta.badges(flavorId, this.fBadgeSpecs), // optional hide-zero
      fillRow       : (row, items, i) => { this.fillRowFromColumns(row, items, i); },
      collapsed     : true,
      groupType     :'flavor',
      rowType       :'tub',
      rowLabel      :'tub',
    });
  }

}

class CabinetGridModel extends BaseGridModel{
  constructor(domain, { location = 935, type = 'na' } = {} ) 
  {
    super( domain, { location } );
    this.modelType = { type };
    this._cabinetsById = Indexer.byId(domain.cabinets);
    this._slotsByCabinetId = Indexer.groupBy(domain.slots, s => s.cabinet);

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
      includeGroupId: (id) => cabinetIds.has(Number(id)),      
      getGroupLabel : (id) => this.labelFromMap(id, this._cabinetsById),
      fillRow       : (row, item, i) => { this.fillRowFromColumns(row, item, i); },
      groupType     : 'cabinet',
      rowType       : 'slot'
    });
  }

}

////////////////////////////////////////
// DATA tools
//////////////////////////////

class ScoopAPI {
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

    if (types.has("planning")) {
      need.add("cabinets"); need.add("slots"); need.add("flavors"); need.add("locations"); need.add("tubs");
    }
    if (types.has("tubs")) {
      need.add("tubs"); need.add("flavors"); need.add("locations");
    }
    if (types.has("batches")) {
      // adjust based on BatchGridModel's real needs
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

  makeModel(type, domain, { location = 0 } = {}) {
    if (type === "planning") return new CabinetGridModel(domain, { location, type });
    if (type === "tubs")     return new FlavorTubsGridModel(domain, { location, type  });
    if (type === "batches")  return new BatchGridModel(domain, { location, type  });
    return null;
  }

  async mountAllGrids({
    root = document,
    domainCodec = DomainCodec,
    formCodec = FormCodec,
  } = {}) 
  {
    const hosts = this.findGridHosts(root);
    if (!hosts.length) return;

    const types = new Set(hosts.map(h => h.dataset.gridType));
    const raw   = await this.loadBundle(this.bundleSpecForGridTypes(types));
    const D     = domainCodec.decode(raw);

    for (const el of hosts) {
      const type = el.dataset.gridType;
      const location = Number(el.dataset.location || 0);

      const model = this.makeModel(type, D, { location });
      if (!model) {
        el.textContent = `Unknown grid type: ${type}`;
        continue;
      }

      const grid = new Grid(el, type, { api: this, formCodec, domainCodec });

      // If you want per-grid override later, keep it here:
      if (type === "planning") grid.postUrl = this.routes.planning;

      grid.init(model);
    }
  }
  

  async _fetch(url, { method="GET", headers={}, body=null, useNonce=false } = {}) {
    const u = (url instanceof URL) ? url : this._absUrl(url);
    const res = await fetch(u, {
      method,
      credentials: "same-origin",
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

  async postJson(payload, type = "planning", { useNonce = true } = {}) {
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

  async loadBundle(endpoints) {
    const entries = Object.entries(endpoints ?? {});
    const pairs = await Promise.all(entries.map(async ([key, spec]) => {
      const cfg = (typeof spec === "string") ? { url: spec } : (spec ?? {});
      if (!cfg.url) throw new Error(`Missing url for endpoint "${key}"`);

      const data = cfg.paged
        ? await this.getAllPages(cfg.url, { perPage: cfg.perPage ?? 100, maxPages: cfg.maxPages ?? 1000 })
        : await this.getJson(cfg.url);

      return [key, data];
    }));

    return Object.fromEntries(pairs);
  }

  // Generic: post planning to a provided endpoint
  route(name) {
    const u = this.routes?.[name];
    if (!u) throw new Error(`ScoopAPI.route("${name}") missing`);
    return u;
  }

}

class DomainCodec {
  // Keep “policy” explicit so you can audit/remove later.
  static defaults = {
    // If true, decode relationship fields (arrays/objects) into scalar IDs.
    coerceRelationIds: true,
    // If true, compute _title strings from WP-ish title shapes.
    computeTitles: true,
    // If true, normalize embedded tubs inside flavors.
    normalizeEmbeddedTubs: true,
  };

  /**
   * Decode a raw bundle (WP REST / Pods-shaped) into your canonical domain.
   * This is the one place “WP shape quirks” should live.
   */
  static decode(bundle, opts = {}) {
    if (!bundle || typeof bundle !== "object") return bundle;

    const o = { ...DomainCodec.defaults, ...opts };
    const D = { ...bundle }; // shallow clone of bundle

    if (Array.isArray(D.tubs))     D.tubs     = DomainCodec.decodeTubs(D.tubs, o);
    if (Array.isArray(D.slots))    D.slots    = DomainCodec.decodeSlots(D.slots, o);
    if (Array.isArray(D.cabinets)) D.cabinets = DomainCodec.decodeCabinets(D.cabinets, o);
    if (Array.isArray(D.flavors))  D.flavors  = DomainCodec.decodeFlavors(D.flavors, o);

    if (Array.isArray(D.locations)) D.locations = DomainCodec.decodeLocations(D.locations, o);

    // Singular location endpoint (if you keep it)
    if (D.location && typeof D.location === "object" && !Array.isArray(D.location)) {
      D.location = DomainCodec.decodeLocations([D.location], o)[0] ?? D.location;
    }

    return D;
  }

  // -------------------------
  // Collection decoders
  // -------------------------

  static decodeTubs(tubs = [], o = DomainCodec.defaults) {
    if (!Array.isArray(tubs)) return [];
    return tubs.map(t => DomainCodec._decodeTub(t, o));
  }

  static decodeSlots(slots = [], o = DomainCodec.defaults) {
    if (!Array.isArray(slots)) return [];
    return slots.map(s => DomainCodec._decodeSlot(s, o));
  }

  static decodeCabinets(cabinets = [], o = DomainCodec.defaults) {
    if (!Array.isArray(cabinets)) return [];
    return cabinets.map(c => DomainCodec._decodeCabinet(c, o));
  }

  static decodeFlavors(flavors = [], o = DomainCodec.defaults) {
    if (!Array.isArray(flavors)) return [];
    return flavors.map(f => DomainCodec._decodeFlavor(f, o));
  }

  static decodeLocations(locations = [], o = DomainCodec.defaults) {
    if (!Array.isArray(locations)) return [];
    return locations.map(loc => DomainCodec._decodeLocation(loc, o));
  }

  // -------------------------
  // Shared per-entity helpers
  // -------------------------

  /**
   * Ensure:
   * - canonical numeric id in x.id
   * - optional string title in x._title (without overwriting server-provided _title)
   *
   * Returns a CLONED object so callers can safely mutate.
   */
  static _withIdAndTitle(obj, o) {
    if (!obj || typeof obj !== "object") return obj;

    const x = { ...obj };

    if (x.id == null || x.id === 0) {
      x.id = DomainCodec._idOf(x.id ?? x.ID);
    }

    if (o.computeTitles) {
      if (x._title == null || x._title === "") {
        x._title = DomainCodec._titleOf(x);
      }
    }

    return x;
  }

  // -------------------------
  // Item decoders
  // -------------------------

  static _decodeTub(t, o) {
    if (!t || typeof t !== "object") return t;

    const x = DomainCodec._withIdAndTitle(t, o);

    // scalar overwrites
    x.state = DomainCodec._titleOf(x.state);

    if (o.coerceRelationIds) {
      x.flavor   = DomainCodec._idOf(x.flavor);
      x.location = DomainCodec._idOf(x.location);
      x.batch    = DomainCodec._idOf(x.batch);
      x.cabinet  = DomainCodec._idOf(x.cabinet);
    }

    return x;
  }

  static _decodeSlot(s, o) {
    if (!s || typeof s !== "object") return s;

    const x = DomainCodec._withIdAndTitle(s, o);

    if (o.coerceRelationIds) {
      x.cabinet          = DomainCodec._idOf(x.cabinet);
      x.location         = DomainCodec._idOf(x.location);
      x.current_flavor   = DomainCodec._idOf(x.current_flavor);
      x.immediate_flavor = DomainCodec._idOf(x.immediate_flavor);
      x.next_flavor      = DomainCodec._idOf(x.next_flavor);
    }

    return x;
  }

  static _decodeCabinet(c, o) {
    if (!c || typeof c !== "object") return c;

    const x = DomainCodec._withIdAndTitle(c, o);

    if (o.coerceRelationIds) {
      x.location = DomainCodec._idOf(x.location);
    }

    if (x.max_tubs != null) {
      const n = Number(x.max_tubs);
      x.max_tubs = Number.isFinite(n) ? n : 0;
    }

    return x;
  }

  static _decodeFlavor(f, o) {
    if (!f || typeof f !== "object") return f;

    const x = DomainCodec._withIdAndTitle(f, o);

    if (o.normalizeEmbeddedTubs && Array.isArray(x.tubs)) {
      x.tubs = DomainCodec.decodeTubs(x.tubs, o);
    }

    return x;
  }

  static _decodeLocation(loc, o) {
    if (!loc || typeof loc !== "object") return loc;

    const x = DomainCodec._withIdAndTitle(loc, o);

    // If you have relationship fields on location later, coerce them here.

    return x;
  }

  // -------------------------
  // Shared coercion helpers
  // -------------------------

  static _first(v) {
    if (v == null) return null;
    return Array.isArray(v) ? (v.length ? v[0] : null) : v;
  }

  static _idOf(v) {
    const x = DomainCodec._first(v);
    if (x == null || x === false) return 0;

    if (typeof x === "object") {
      return DomainCodec._idOf(x.id ?? x.ID ?? x.value);
    }

    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  static _titleOf(v) {
    const x = DomainCodec._first(v);
    if (x == null || x === false) return "";
    if (typeof x === "string") return x;

    if (typeof x === "object") {
      const t = x.title;
      if (t && typeof t === "string") return t;
      if (t && typeof t === "object" && typeof t.rendered === "string") return t.rendered;

      if (typeof x.post_title === "string") return x.post_title;
      if (typeof x.name === "string") return x.name;
      if (typeof x.slug === "string") return x.slug;
      if (typeof x.rendered === "string") return x.rendered;
    }

    return "";
  }
}

class FormCodec {
  static extractGridChanges(form, formKey = "planning") {
    if (!form || !(form instanceof HTMLFormElement)) {
      throw new TypeError("extractGridChanges(form, formKey): form must be a HTMLFormElement");
    }

    const prefix = `${formKey}[cells]`;
    const changes = { cells: {} };
    const flat = [];

    const inputs = form.querySelectorAll(
      `input[type="hidden"][name^="${FormCodec.cssEscape(prefix)}"]`
    );
    for (const input of inputs) {
      const name = input.getAttribute("name") || "";
      const parsed = FormCodec.parseBracketName(name);

      if (!parsed || parsed.length < 4) continue;
      if (parsed[0] !== formKey) continue;
      if (parsed[1] !== "cells") continue;
      const rowId = Number(parsed[2]);
      const colKey = parsed[3];

      if (!Number.isFinite(rowId) || rowId <= 0) continue;
      if (!colKey) continue;

      const raw = input.value ?? "";
      const value = FormCodec.normalizeScalar(raw);

      flat.push({ rowId, colKey, value, name, input });

      if (!changes.cells[rowId]) changes.cells[rowId] = {};
      changes.cells[rowId][colKey] = value;
    }

    return { changes, flat };
  }

  static parseBracketName(name) {
    if (!name || typeof name !== "string") return null;

    const parts = [];
    const re = /([^[\]]+)|\[(.*?)\]/g;
    let m;

    while ((m = re.exec(name))) {
      const token = (m[1] != null) ? m[1] : m[2];
      parts.push(token);
    }

    return parts.length ? parts : null;
  }

  static normalizeScalar(v) {
    const s = (v ?? "").toString().trim();
    if (s === "") return 0;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return s;
  }

  static cssEscape(s) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
    return s.replace(/["\\]/g, "\\$&");
  }
}

class Indexer {
  static byId(list, key = "id") {
    const map = new Map();
    for (const item of (list ?? [])) {
      const id = item?.[key];
      if (id != null) map.set(id, item);
    }
    return map;
  }

  static groupBy(list, keyFn) {
    if (!Array.isArray(list)) {
      throw new TypeError(`groupBy expected array, got ${Object.prototype.toString.call(list)}`);
    }
    const m = new Map();
    for (const item of list) {
      const k = keyFn(item);
      const arr = m.get(k) ?? [];
      arr.push(item);
      m.set(k, arr);
    }
    return m;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/",
    routes: SCOOP.routes,
  });

  await api.mountAllGrids({ domainCodec: DomainCodec, formCodec: FormCodec });
});