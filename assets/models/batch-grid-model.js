import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class BatchGridModel extends BaseGridModel{

  constructor(name = 'Batch', domain, attrs = {}) 
  {
    super(name, domain, attrs );
    this._flavorsById  = Indexer.byId(domain?.flavors) || {};
    this.submitMode = 'all';
    this._build();
  }

  buildCols() {
    this.columns = [
      { key: "count", label: "count", write: true, control: "text", type: "number" },
      { key: "flavor", label: "flavor", write: true, type: "flavor", titleMap: "flavors" }
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