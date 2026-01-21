import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class CabinetGridModel extends BaseGridModel{
  constructor(name = 'Cabinet', domain, attrs = {}) 
  {
    super(name, domain, attrs );
    this._cabinetsById = Indexer.byId(domain.cabinet);
    this._slotsByCabinetId = Indexer.groupBy(domain.slots, s => s.cabinet);

    this._build();
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'current_flavor',  label:'Current Flavor',   type:"flavor", titleMap: "flavor", write:true},
      {key:'immediate_flavor',label:'Immediate Flavor', type:"flavor", titleMap: "flavor", write:true},
      {key:'next_flavor',     label:'Planned Flavor',   type:"flavor", titleMap: "flavor", write:true}
    ]

    return this.columns;
  }

  builRows() {
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