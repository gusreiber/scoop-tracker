import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class FlavorTubGridModel extends BaseGridModel{
  constructor(name = 'FlavorTub', domain, attrs = {}) 
  {
    super(name, domain, attrs );
    this.filter = true;
    this._build();
  }

  buildCols(){
    this.columns = [
      {key:'id',              label:'id'},
      {key:'state',           label:'state',   type:'state',  write:true},
      {key:'use',             label:'use',     type:'use',    write:true,  titleMap:'uses'},
      {key:'amount',          label:'amount',  type:'num',    write:true,  control: 'text'},
      {key:'flavor',          label:'flavor',  type:'flavor', titleMap:'flavors'},
      {key:'date',            label:'date',    type:'date'},
      {key:'index',           label:'index',   type:'num'},
    ]

    return this.columns;
  }

  builRows(){
    const locationTubIds = this.filterByLocation(this.domain.tubs)
      .filter(t => t.state !== "Emptied");
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