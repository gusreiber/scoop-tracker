import BaseGridModel from "./_base-grid-model.js";
import Indexer       from "../data/indexer.js";

export default class CloseoutGridModel extends BaseGridModel{
  constructor(name = 'Closeout', domain, attrs = {}) 
  {
    super(name, domain, attrs );
      this._flavorsById  = Indexer.byId(domain.flavor) || {};
      this.submitMode = 'all';
      this._build();
  }

  buildCols() {
    this.columns = [
      { key: "tubs_emptied", label: "count",    write: true, control: "text", type: "number" },
      { key: "flavor",       label: "flavor",   write: true, type: "flavor" },
      { key: "use",          label: "use",      write: true, type: "use" },
      { key: "location",     label: "location", write: true, type:"location"},
     // { key: "date",         label: "date",     write: true, hidden: true,  type:"date", value:new Date()}
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
        tubs_emptied: { 
          rowId,
          colKey: "tubs_emptied",
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
        },

        use: {
          id: 0,
          rowId,
          colKey: "use",
          type: "use",
          display: "",
          options: this.getOptions("use", "use", 0),
          badges: []
        },

        location:{
          id: 935,
          rowId,
          colKey: "location",
          type: "location",
          display: "Woodinville",
          options: this.getOptions("location", "location", 935),
          value: 935,
          badges: []
        }
      }
    ];

    return this.rows;
  } 

}