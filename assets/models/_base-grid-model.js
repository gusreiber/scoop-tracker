///////////////////////////////////
// base class for Models 
// Does almost everything for everyone
// leaves getRows and getColumns 
// should be overritten by children
// TODO: needs to refactor out IF blocks
// ...and leave that to the kids...
//////////////////////////////////
import Indexer from "../data/indexer.js";
import Flavor  from "./_flavor.js";

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
    this._tubsById         = domain.tubs? 
                             Indexer.byId(domain.tubs.filter(t => t.state !== 'Emptied'))  : [];
    this._flavorsById      = domain.flavor? 
                             Indexer.byId(domain.flavor) : [];
    this._availByFlavor    = domain.tubs? 
                             Indexer.groupBy(
                              domain.tubs.filter( t => t.state !== "Emptied"),
                              t => t.flavor
                            ) : [];

    this.flavorMeta = new Flavor({
      flavorsById: this._flavorsById,
      location:    this.location,
      tubs:        domain.tubs
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
  
  getAlertCase( id , type = 'flavor' ){
    //TODO: Not sure what I was thinking when I made a pass-thru...
    //TODO: Need to clean-up all these useless 'ok_' classes..
    if(type !== 'flavor') return 'ok_ac';
    return this[`${type}Meta`].alertCase(id);
  }

  getBadges( id, type = 'flavor', spec = this.fBadgeSpecs){
    // TODO: Badges could differ by type or field name, but at the moment
    // I only have flavor bages and they are all tub counts of that ID.
    if(type !== 'flavor') return [];
    return this[`${type}Meta`].badges(id, spec);
  }

  getOptions( id, type ){
    // TODO: This is just a brute force return of the Flavors list
    // TODO: This should all go in the appropriate models, not options in the parent model
    // key and label are the properties the listed objects need
    if(!type || type === 'id') return [];
    if(type === 'state') return [
        {key:'__override__',   label:'__override__'},
        {key:'Hardening',      label:'Hardening'},
        {key:'Freezing',       label:'Freezing'},
        {key:'Tempering',      label:'Tempering'},
        {key:'Opened',         label:'Opened'},
        {key:'Emptied',        label:'Emptied'}
    ];
    if (type === 'location') {
      return [...this.domain.locations]
        .map(u => ({
          key: u.id,
          label: u._title || u.title?.rendered || ''
        }));
    }
    if (type === 'use') {
      return [...this.domain.uses]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(u => ({
          key: u.id,
          label: u._title || u.title?.rendered || ''
        }));
    }
    //TODO: This should get out of here. I don't need the baseModel doing all this work.
    if(type === 'flavor')
      return this[`${type}Meta`].optionsAll;
    
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
    const map = this.getTitleMap(col.titleMap);  // col.titleMap = "uses" | "flavor" | ...
    return map.get(Number(id))?._title ?? "";
  }
  
  fillRowFromColumns(
    row, // The row so far...
    rowData, // THE RAW DATA for the item that is the basis for the row
    i,   // a simple 
  ) 
  {
    for (const col of this.columns) {
      const key = col?.key;
      if (!key) continue;

      const raw = rowData?.[key];
      const id = Number(raw ?? 0);
      row[key] = {
        id,
        rowId:     rowData?.id || i,
        display:   (col.titleMap)? this.titleFrom(id, col) : raw ?? "",
        type:      col.type,
        colKey:    col.key,
        options:   this.getOptions  (id, col.type),
        badges:    this.getBadges   (id, col.type),
        alertCase: this.getAlertCase(id, col.type),
        value:     col.value,
        hidden:    col.hidden,
        write:     col.write ?? false
      };
    }
  }

  //invalidate() { this._cache = null; this._inflight = null; }
}

