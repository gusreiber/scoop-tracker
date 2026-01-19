///////////////////////////////////
// Table amd Form combo
// consumes different cell/input types
// can be augmented with FindInGrid
// depends on MOM_El.js
// Is fed by MDL*.js files
//////////////////////////////////

// GRID ---------------------------
import El         from "./_el.js";
import FindIt     from "./find-it.js";
import TextIt     from "./text-it.js";
import FindInGrid from "./find-in-grid.js";
import Toast      from "./toast.js";

export default class Grid extends El{
  constructor(target, name, config={
                api         = {baseUrl:'/'},
                formCodec   = FormCodec,
                domainCodec = DomainCodec,
                modelCtrl
              } = {}
            ) 
  {
    super();
    this.target    = target;
    this.name      = name;
    this.modelCtrl = config?.modelCtrl ?? null;
    this.location  = config?.modelCtrl?.location ?? 0;
  
    this.baseline  = new Map();   // key -> value
    this.dirtySet  = new Set();   // key
    this.state     = null;
    this.filter    = null;
    this._isInit   = false;
    this._docListenerBound = false;
    
    this.loadConfig(config);
    this._build();
    
    if(config.columns) this.setColumns(config.columns);
    
  }
  
  init(state = this.state) {
    this.state = state;
    this.rowGroupDom = [];
    this.setColumns(state.columns);
    this.setRowGroups( state.rowGroups );
    this.setRows(state.rows);
    if(state?.filter) this.FORM.querySelectorAll
        ('.gridFilterInput').forEach(f=>f.remove());
    this._filter = (state?.filter)? new FindInGrid(this.FORM, { root: this.TABLE }) : null;
    
    this._bindEvents();

    this._attachCoreDom();

    this._captureBaseline();

    this.FORM.dispatchEvent(new Event("ts:grid:init"));
    this._isInit = true;
  }

  loadConfig( 
    { api         = this.api,
      formCodec   = this.formCodec,
      domainCodec = this.domainCodec,
      modelCtrl   = this.modelCtrl } = {},
      state = this.state
  ){
    this.api        = api;
    this.formCodec  = formCodec;
    this.domainCodec= domainCodec;
    this.modelCtrl  = modelCtrl;
    this.postUrl    = api.baseUrl;
    
    this.cols       = (state?.columns)? this.setColumns(state.columns) : this.colnulls;
    this.rowGroups  = (state?.groups) ? this.setRowGroups(state.groups): this.rowGroups;
    this.rows       = (state?.rows)   ? this.setRows(state.rows)       : this.rows;
    this._filter    = (state?.filter) ? new FindInGrid(this.FORM, { root: this.TABLE }) : this.filter;

  }

  async refresh(state) {
    if (!this._isInit) throw new Error("Grid.refresh() called before init()");
    this.state = state;
    
    //this.setColumns(await state.columns);

    // rebuild group TBODIES fresh
    this.setRowGroups(state.rowGroups);

    // fill rows
    this.setRows(state.rows);

    // baseline resets because DOM changed
    this._captureBaseline();
    
    
    this.FORM.dispatchEvent(new Event("ts:grid:close-overlays"));
  }

  setColumns(columns = []){
    this.cols = columns;
    this._buildCols();
  }

  setRowGroups(rowGroups = []){
    this.rowGroups = rowGroups;
    this._buildRowGroups();
  }

  setRows(rows = [], rowGroups = this.rowGroups ?? []){
    this.rows = rows;
    this.rowGroups = rowGroups;
    this._buildRows();
  }

  _build(){
    const el = this.el;
    this.FORM   = el( 'form',  { classes:['zGRID-form'] } );
    this.SUBMIT = el( 'button',{ classes:['save'], text : 'save', attrs:{ type:'submit' }  }  );
    this.TABLE  = el( 'table', { classes:['zGRID'] } );
    this.THEAD  = el( 'thead' );
    this.TRH    = el( 'tr' );

    this.THEAD.append(this.TRH);

    if(this.cols) this._buildCols();
  }

  _buildCols(){
    if(!this.cols || !this.TABLE  || !this.TRH) return;

    this.TRH.replaceChildren();
    this.TABLE.querySelectorAll('tbody').forEach( el=>el.remove() );
    
    for (const col of this.cols) {
      const TH = this.el( 
        "th", { text: col.label ?? col.key, classes:[col.key, col.type] }  
      );
      if(col.hidden) TH.classList.add('hidden');
      this.TRH.append(TH);
    }

    this.TABLE.prepend(this.THEAD);

  }

  _buildRowGroups(){
    if(!this.rowGroups || this.rowGroups.length === 0) return;
    this.rowGroupDom.forEach(g=>g.remove());
    const gEls = this.rowGroupDom;
    const el = this.el;
    
    let groupCount = 0;
    for(const g of this.rowGroups){
    
      const TBODY = el('tbody', {classes:['groupBody', (g.collapsible?'collapsible':'static'), (g.collapsed?'closed':'opened') ],
        data:{rowType:g.rowType, groupType: g.groupType}
      });
      const GR = el('tr', {classes:['group'], data:{ rowId:g.groupId, groupLabel:g.label } } );
      const GD = el('th', {classes:['groupCell'], attrs:{'colSpan':this.cols.length } } )  
      const SP = el('b');
      const OC = (g.collapsible)? el( 'button', {classes:["oc"]} ) : null;
      const LB = el("span", {text:g.label, classes:["groupLabel"] } );
      
      if(g.collapsible) SP.append(OC);
      if(g.badges && g.badges[0]) GD.append(this._getBadgeDom(g.badges));
      
        
      SP.append(LB);
      GD.append(SP);
      GR.append(GD);
      
      TBODY.append(GR);

      this.TABLE.append(TBODY);
      this.rowGroupDom.push(TBODY);
      
    }
  }

  _buildRows(){
    const rows = this.rows ?? [];
    const cols = this.cols ?? [];
    const rowGroups = this.rowGroups;
    const el = this.el;
    if(!rowGroups || rowGroups.length === 0) {
      this.rowGroupDom = [ el('tbody') ];
      this.TABLE.append(this.rowGroupDom[0]);
    }

    let i = 0;
    let next = (rowGroups.length > 0) ? rowGroups[i].startIndex : 0 ;
    rows.forEach((row, r) => {
      
      if (rowGroups[i + 1] && r === rowGroups[i + 1].startIndex) i++;

      const TR =  el( 'tr', {classes:['row'],data:{ rowId : row.id.rowId }});
      cols.forEach(col =>{

        const data = row?.[col.key] ?? "";
        TR.append( this._getCellDom(col,data) );
        
      });
      this.rowGroupDom[i].append(TR);
      
    });

  }

  _getCellDom(col,data){
    // TODO: Decide if I am going to demand data types for all cells
    // TODO: Decide how I am going to swallow or reflect those types in the css class
    const CELL = this.el('td', { classes:['cell', col.key, col.type ?? 'ok_colType', data.alertCase ?? 'ok_alertCase' ] } );
    if(col.hidden) CELL.classList.add('hidden');
    
    if(col.write){
      if(col.hidden)
        new TextIt(CELL, col, this.name);
      else if(col.control === "text" )
        new TextIt(CELL, data, this.name);
      else new FindIt(CELL, data, this.name);
    }else{
      CELL.append('' + (data.display || ''));
      CELL.classList.add('read-only');
    }
    if(data.badges && data.badges[0]) CELL.append(this._getBadgeDom(data.badges));

    return CELL;
  }

  _getBadgeDom(badges){
    if(!badges || badges.length === 0) return null;
    const BDGs = this.el("span", {classes:["badges"] } ); 
    badges.forEach( (b) => {
      const B = this.el('b', {text:b.text, classes:['badge', b.key] } );
      BDGs.append(B);
    } );
    return BDGs;
  }

  _attachCoreDom(){
    if (!this.FORM.contains(this.TABLE)) this.FORM.append(this.TABLE);
    if (!this.FORM.contains(this.SUBMIT)) this.FORM.append(this.SUBMIT);
    if (!this.target.contains(this.FORM)) this.target.append(this.FORM);
  }

  _buildAllPayload() {
    const changes = { cells: {} };

    const inputs = this.FORM.querySelectorAll(
      `input[type="hidden"][name^="${this.name}[cells]"]`
    );

    for (const input of inputs) {
      const parsed = this.formCodec.parseBracketName(input.name);
      if (!parsed || parsed.length < 4) continue;
      if (parsed[0] !== this.name || parsed[1] !== "cells") continue;

      const rowId = Number(parsed[2]);      // allow 0
      const colKey = parsed[3];

      const value = this.formCodec.normalizeScalar(input.value ?? "");
      if (!changes.cells[rowId]) changes.cells[rowId] = {};
      changes.cells[rowId][colKey] = value;
    }

    return changes;
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
      if (!changes.cells[rowId] ) changes.cells[rowId] = {};
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
  
  _showHide(e, el=e.target){
    if(el.closest(".oc")){
        const TB = e.target.closest("TBODY");
        TB.classList.toggle('opened');
        TB.classList.toggle('closed');
    }
    
    this.FORM.dispatchEvent(new Event("ts:grid:close-overlays"));

  }

  async _bindEvents() {
    if (this._eventsBound || !this.FORM) return;
    this._eventsBound = true;

    this.FORM.addEventListener('ts:findit-change', (e) => {
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

    this.FORM.addEventListener("keydown", (e) => {

      // Spacebar activates focused buttons (including group toggles)
      if (e.key === " "){
        const el = document.activeElement;
        if (!el) return;
        if (!this.FORM.contains(el)) return;

        const isButton = el.matches("button, [role='button']");
        if (!isButton) return;
        
        // Avoid interfering with typing in inputs/textareas
        if (el.matches("input, textarea, [contenteditable='true']")) return;

        e.preventDefault();
        this._showHide(e,el);
      }

      // Ctrl+s to save the form
      if(
        (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ||
        (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey))
      ){
        const el = document.activeElement;
        if (!el || !this.FORM.contains(el)) return;

        // Don't interfere with IME / composition
        if (e.isComposing) return;

        e.preventDefault();
        this.FORM.requestSubmit();
      }

    }, true);

    this.FORM.addEventListener("mousedown", (e)=>{this._showHide(e)}, true);

    this.FORM.addEventListener("submit", async (e) => {
      
      e.preventDefault();
      if(e.submitter && e.submitter.classList.contains('oc')) return false;
      console.log('FORM POST URL',this.postUrl);

      if (!this.api) throw new Error('Grid submit: missing this.api');
      if (!this.postUrl) throw new Error('Grid submit: missing this.postUrl');

      const submitBtn = this.FORM.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const isAll = this.state.submitMode === 'all';
        const changes = ( isAll)? this._buildAllPayload() :this._buildDirtyPayload();
        console.log("try changes", changes);
        // OPTIONAL: no-op submit guard
        if (!Object.keys(changes.cells).length && !isAll) {
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
          document.body.classList.add('TS_GRID-UPDATING');
          this.modelCtrl?.invalidate?.(); 
          await this.modelCtrl?.load?.({ force: true });
        
          this._commitPosted(changes);
          
          const TOAST = Toast.addMessage({title:'Update sent', message:r.data.updated});
          
          await this.api.refreshPageDomain({ force: true, toast:TOAST, info:{name:this.name, response:r} });
          
        }
        // TODO: mark successful cells as clean (e.g., store baseline values)
        
        
      } catch (err) {
        console.error("POST exception:", err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.addEventListener("ts:domain:updated", async (e) => {
      if (this._reloading) return;
      this._reloading = true;
      try {
        const model = await this.modelCtrl.load(); // uses api snapshot
        this.init(model);
      } finally {
        this._reloading = false;
      }
    });
    
  }

  
  destroy() {
    //TODO: this doesn't exist
    console.log("I am here to create not distroy");
  }

}