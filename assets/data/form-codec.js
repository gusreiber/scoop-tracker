export default class FormCodec {
  static extractGridChanges(form, formKey = "Cabinet") {
    if (!form || !(form instanceof HTMLFormElement)) {
      throw new TypeError("extractGridChanges(form, formKey): form must be a HTMLFormElement");
    }

    const prefix = `${formKey}[cells]`;
    const changes = { cells: {} };
    const flat = [];

    const inputs = form.querySelectorAll(
      `input[type="hidden"][name^="${FormCodec.cssEscape(prefix)}"]`
    );
    
    for (const input of inputs) {
      const name = input.getAttribute("name") || "";
      const parsed = FormCodec.parseBracketName(name);

      if (!parsed || parsed.length < 4) continue;
      if (parsed[0] !== formKey) continue;
      if (parsed[1] !== "cells") continue;
      const rowId = Number(parsed[2]);
      const colKey = parsed[3];

      if (!Number.isFinite(rowId)) continue;
      if (!colKey) continue;

      const raw = input.value ?? "";
      const value = FormCodec.normalizeScalar(raw);

      flat.push({ rowId, colKey, value, name, input });

      if (!changes.cells[rowId]) changes.cells[rowId] = {};
      changes.cells[rowId][colKey] = value;
    }

    return { changes, flat };
  }

  static parseBracketName(name) {
    if (!name || typeof name !== "string") return null;

    const parts = [];
    const re = /([^[\]]+)|\[(.*?)\]/g;
    let m;

    while ((m = re.exec(name))) {
      const token = (m[1] != null) ? m[1] : m[2];
      parts.push(token);
    }

    return parts.length ? parts : null;
  }

  static normalizeScalar(v) {
    const s = (v ?? "").toString().trim();
    if (s === "") return 0;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return s;
  }

  static cssEscape(s) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
    return s.replace(/["\\]/g, "\\$&");
  }
}