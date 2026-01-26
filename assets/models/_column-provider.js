// ColumnsProvider.js
export default class ColumnsProvider {
  constructor(metaPackage) {
    this.meta = metaPackage; // role-resolved snapshot
    console.log('?comsP', this.meta);
  }

  setMeta(metadata){
    this.meta = this.metadata;
  }

  forGrid(gridType, ctx = {}) {
    const spec   = this.meta?.[gridType];
    const fields = spec?.fields;
    const parent = spec?.postPod;
    if (!spec || !fields || !fields?.[parent] ) return [];
    const colFields = fields[parent];
    //console.log('???forGIrd', colField);

   

    const demo = {
        key: "flavor",
        label: "Flavor",
        dataType:'int',
        editor: { kind: "find", source: "flavors" },
        access: { visible: true, editable: false }  // role-based outcome
    };

    switch (gridType) {
      case "FlavorTub": return this._flavorTub(spec, ctx);
      case "Cabinet":   return this._cabinet(spec, ctx);
      default: return [];
    } 
    console.log('?comsP', this.meta);
  }

  _flavorTub(spec, ctx) {  }
  _cabinet(spec, ctx) {  }
}
