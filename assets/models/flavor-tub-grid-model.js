import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class FlavorTubGridModel extends BaseGridModel{
  constructor(name = 'FlavorTub', domain, attrs = {}) 
  {
    super(name, domain, attrs );
    this.filter = true;    
    this.setShowList(['state', 'use', 'amount', 'author_name', 'date', 'post_modified']);
  }

  buildRows() {
    if (!this.domain) return [];
    
    // Access the primary entity from domain
    const primary = this.metaData?.primary || 'tub';
    const items = this.domain[primary] || [];
    
    const locationTubIds = this.filterByLocation(items)  // ← Use items, not this.domain
        .filter(t => t.state !== "Emptied");
    
    const tubsByFlavorId = Indexer.groupBy(locationTubIds, t => t.flavor);
    
    return this.buildGroupedRows({
        groupsMap     : tubsByFlavorId,
        includeGroupId: (id)   => Number(id) > 0,
        getGroupLabel : (id)   => this.labelFromMap(id, this._flavorsById),
        makeRowId     : (item) => item.id,
        getGroupBadges: (items, flavorId) => this.getBadges(flavorId, 'flavor'),
        fillRow       : (row, items, i) => { this.fillRowFromColumns(row, items, i); },
        collapsed     : true,
        groupType     :'flavor',
        rowType       :'tub',
        rowLabel      :'tub',
    });
  }

}