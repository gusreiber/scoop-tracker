///////////////////////////////////
// base class for Models 
// Does almost everything for everyone
// leaves getRows and getColumns 
// should be overritten by children
// TODO: needs to refactor out IF blocks
// ...and leave that to the kids...
//////////////////////////////////
import Indexer         from "../data/indexer.js";
import Flavor          from "./_flavor.js";
import ColumnsProvider from "./_column-provider.js";

export default class BaseGridModel {
  
  constructor(name, domain, options = {}) {
    const { location = 935 } = options || {};
    this.name = name;
    this.domain = domain;
    this.metaData = options?.metaData ?? null;
    console.log(name, options);

    this.location = location;
    // --- grid contract ---
    this.columns = [];
    this.rows = [];
    this.rowGroups = [];
    this.minCount = 0;

    // --- derived indexes (convenience, not exposed to Grid) ---
    this._tubsById         = domain.tub? 
                             Indexer.byId(domain.tub.filter(t => t.state !== 'Emptied'))  : [];
    this._flavorsById      = domain.flavor? 
                             Indexer.byId(domain.flavor) : [];
    this._availByFlavor    = domain.tub? 
                             Indexer.groupBy(
                              domain.tub.filter( t => t.state !== "Emptied"),
                              t => t.flavor
                            ) : [];

    this.flavorMeta = new Flavor({
      flavorsById: this._flavorsById,
      location:    this.location,
      tub:        domain.tub
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
      ids.add(item?.[idKey]);
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

  _build() {
    this.buildCols();
    this.buildRows();
  }

  buildCols() {
    // Try metadata first for column schema
    if (this.metaData?.columns) {
      this.columns = this._columnsFromMetadata();
      if (this.columns?.length) return this.columns;
    }
    
    // Subclass must provide fallback
    throw new Error(`${this.name}.buildCols(): no metadata and no fallback implemented`);
  }

  _columnsFromMetadata() {
    const cols = [];
    for (const [key, meta] of Object.entries(this.metaData.columns)) {
      if (!meta.visible) continue;
      
      cols.push({
        key,
        label: meta.label,
        type: meta.dataType,
        write: meta.editable,  // ← Server-controlled editability
        hidden: meta.hidden,
        control: meta.control === 'input' ? 'text' : undefined,
        titleMap: this._inferTitleMap(key)
      });
    }
    return cols;
  }

  _inferTitleMap(key) {
    const maps = {
      'flavor': 'flavor',
      'current_flavor': 'flavor',
      'immediate_flavor': 'flavor',
      'next_flavor': 'flavor',
      'use': 'use',
      'location': 'location',
      'cabinet': 'cabinet'
    };
    return maps[key] ?? null;
  }

  buildRows(){
    throw new Error("buildRows() must be implemented by subclass");
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
  
  getAlertCase(id, fieldKey = 'flavor') {  // Changed param name from 'type' to 'fieldKey'
    // Only flavor-related fields get alert cases
    if (fieldKey === 'flavor' || fieldKey.includes('_flavor')) {
      return this.flavorMeta.alertCase(id);
    }
    return '';
  }

  getBadges(id, fieldKey = 'flavor', spec = this.fBadgeSpecs) {  // Changed param name
    // Only flavor-related fields get badges
    if (fieldKey === 'flavor' || fieldKey.includes('_flavor')) {
      return this.flavorMeta.badges(id, spec);
    }
    return [];
  }

  getOptions(id, fieldKey) {  // Changed param name from 'type' to 'fieldKey'
    if (!fieldKey || fieldKey === 'id') return [];
    
    if (fieldKey === 'state') return [
      {key:'__override__',   label:'__override__'},
      {key:'Hardening',      label:'Hardening'},
      {key:'Freezing',       label:'Freezing'},
      {key:'Tempering',      label:'Tempering'},
      {key:'Opened',         label:'Opened'},
      {key:'Emptied',        label:'Emptied'}
    ];
    
    if (fieldKey === 'location') {
      return [...this.domain.location]
        .map(u => ({
          key: u.id,
          label: u._title || u.title?.rendered || ''
        }));
    }
    
    if (fieldKey === 'use') {
      return [...this.domain.use]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(u => ({
          key: u.id,
          label: u._title || u.title?.rendered || ''
        }));
    }
    
    // Handle all flavor-related fields
    if (fieldKey === 'flavor' || fieldKey === 'current_flavor' || 
        fieldKey === 'immediate_flavor' || fieldKey === 'next_flavor') {
      return this.flavorMeta.optionsAll;
    }
    
    return [];
  }

  getTitleMap(name) {
    this._titleMaps ??= new Map();           // Map<string, Map<number, obj>>
    if (this._titleMaps.has(name)) return this._titleMaps.get(name);

    const list = this.domain?.[name];
    const map  = Indexer.byId(Array.isArray(list) ? list : []);
    this._titleMaps.set(name, map);
    return map;
  }

  titleFrom(id, col) {
    if (!col?.titleMap) return id;
    const map = this.getTitleMap(col.titleMap);  // col.titleMap = "use" | "flavor" | ...
    return map.get(Number(id))?._title ?? "";
  }
  
  fillRowFromColumns(row, rowData, i) {
    for (const col of this.columns) {
      const key = col?.key;
      if (!key) continue;

      const raw = rowData?.[key];
      const id = Number(raw ?? 0);
      
      row[key] = {
        id,
        rowId:     rowData?.id || i,
        display:   (col.titleMap) ? this.titleFrom(id, col) : raw ?? "",
        type:      col.type,
        colKey:    col.key,
        options:   this.getOptions  (id, col.key),   // ← Changed from col.type
        badges:    this.getBadges   (id, col.key),   // ← Changed from col.type
        alertCase: this.getAlertCase(id, col.key),   // ← Changed from col.key
        value:     col.value,
        hidden:    col.hidden,
        write:     col.write ?? false
      };
    }
  }

  //invalidate() { this._cache = null; this._inflight = null; }
}

