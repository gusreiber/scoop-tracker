import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class CabinetGridModel extends BaseGridModel{
  constructor(name = 'Cabinet', domain, attrs = {}) 
  {
    super(name, domain, attrs );
    this._cabinetsById = Indexer.byId(domain.cabinet);
    this._slotsByCabinetId = Indexer.groupBy(domain.slot, s => s.cabinet);

    this._build();
  }

  buildRows() {
    const cabinetIds = this.getIdsForLocation(this.domain.cabinet);
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