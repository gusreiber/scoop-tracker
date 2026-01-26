// _column-provider.js - REPLACE entire file
export default class ColumnsProvider {
  constructor(metaPackage) {
    this.meta = metaPackage;
  }

  forGrid(gridType, ctx = {}) {
    const spec = this.meta?.[gridType];
    if (!spec?.columns) return null;

    const columns = [];
    
    for (const [key, meta] of Object.entries(spec.columns)) {
      if (!meta.visible) continue; // Skip hidden from metadata
      
      columns.push({
        key,
        label: meta.label,
        type: meta.dataType,
        write: meta.editable,  // ← Server controls this
        hidden: meta.hidden,
        control: meta.control === 'input' ? 'text' : undefined,
        titleMap: this._inferTitleMap(key, meta)
      });
    }
    
    return columns;
  }

  _inferTitleMap(key, meta) {
    // Map relationship fields to their lookup sources
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
}