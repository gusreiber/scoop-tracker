import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class BatchGridModel extends BaseGridModel{

  constructor(name = 'Batch', domain, attrs = {}, metaData = null) 
  {
    super(name, domain, attrs, metaData );
    this._flavorsById  = Indexer.byId(domain?.flavors) || {};
    this.submitMode = 'all';
    this._build();
  }

  buildCols() {
    this.columns = [
      { key: "flavor", label: "flavor", write: true, type: "flavor", titleMap: "flavors" },
      { key: "count", label: "count", write: true, control: "text", type: "number", step:0.01 }
    ];
    return this.columns;
  }
  
  builRows() {
    // single row
    const rowId = 0;
    
    this.rows = [
      {
        id: rowId,
        // flavor cell (FindIt expects id/display/options/etc.)
        flavor: {
          id: 0,
          rowId,
          colKey: "flavor",
          type: "flavor",
          display: "",
          options: this.getOptions("flavor", "flavor", 0),
          badges: []
        },
        // count cell (TextIt expects value/display + rowId/colKey/type)
        count: { 
          rowId,
          colKey: "count",
          type: "number",
          step: 0.01,
          value: ""          // default blank
        }        
      }
    ];

    return this.rows;
  } 

}