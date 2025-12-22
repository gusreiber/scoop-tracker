// slot_update_sanity.js
//
// Client-side sanity validator for your "planning" form POSTs:
//   planning[cells][<slotId>][current_flavor]   = <flavorId>
//   planning[cells][<slotId>][immediate_flavor] = <flavorId>
//   planning[cells][<slotId>][next_flavor]      = <flavorId>
//
// Designed to run in-browser *before* you send to PHP/REST.
// Assumes your domain object `D` has already been DoNorm.normalize(...)'d.
//
// Usage example:
//   import { extractPlanningChangesFromForm, validatePlanningChanges } from "./slot_update_sanity.js";
//
//   const form = document.querySelector("form.zGRID-form");
//   const { formKey, changes } = extractPlanningChangesFromForm(form, "planning");
//
//   const result = validatePlanningChanges(changes, D, { location: 935 });
//   if (!result.ok) console.log(result);
//   else console.log("OK", result.normalized);

export function extractPlanningChangesFromForm(formEl, formKey = "planning") {
  if (!formEl) throw new Error("extractPlanningChangesFromForm: missing form element");

  const fd = new FormData(formEl);
  const changes = {}; // slotId -> { colKey: value, ... }

  const re = new RegExp(
    `^${escapeRegExp(formKey)}\\[cells\\]\\[(\\d+)\\]\\[([^\\]]+)\\]$`
  );

  for (const [name, rawVal] of fd.entries()) {
    const m = String(name).match(re);
    if (!m) continue;

    const slotId = m[1];
    const colKey = m[2];

    changes[slotId] ??= {};
    changes[slotId][colKey] = rawVal;
  }

  return { formKey, changes };
}

export function validatePlanningChanges(changes, domain, {
  location = null,
  allowedFields = ["current_flavor", "immediate_flavor", "next_flavor"],
  allowZeroFlavor = true,
  // "warning" checks are things you may still allow because hooks can reconcile.
  // "error" checks are hard blocks.
  deepChecks = true,
} = {}) {
  const errors = [];            // general errors
  const fieldErrors = {};       // slotId -> field -> [msgs]
  const warnings = [];          // general warnings
  const fieldWarnings = {};     // slotId -> field -> [msgs]

  const addError = (msg, path = null) => {
    errors.push(path ? { message: msg, path } : { message: msg });
  };
  const addWarning = (msg, path = null) => {
    warnings.push(path ? { message: msg, path } : { message: msg });
  };
  const addFieldError = (slotId, field, msg) => {
    const sid = String(slotId);
    fieldErrors[sid] ??= {};
    fieldErrors[sid][field] ??= [];
    fieldErrors[sid][field].push(msg);
  };
  const addFieldWarning = (slotId, field, msg) => {
    const sid = String(slotId);
    fieldWarnings[sid] ??= {};
    fieldWarnings[sid][field] ??= [];
    fieldWarnings[sid][field].push(msg);
  };

  // ---- basic type checks ----
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return {
      ok: false,
      errors: [{ message: "changes must be an object mapping slotId -> patch." }],
      fieldErrors: {},
      warnings: [],
      fieldWarnings: {},
      normalized: {}
    };
  }

  // ---- build indexes ----
  const slots    = Array.isArray(domain?.slots)    ? domain.slots    : [];
  const cabinets = Array.isArray(domain?.cabinets) ? domain.cabinets : [];
  const flavors  = Array.isArray(domain?.flavors)  ? domain.flavors  : [];
  const tubs     = Array.isArray(domain?.tubs)     ? domain.tubs     : [];

  const slotsById = new Map(slots.map(s => [Number(s?.id), s]));
  const cabinetsById = new Map(cabinets.map(c => [Number(c?.id), c]));
  const flavorsById = new Map(flavors.map(f => [Number(f?.id), f]));

  // cabinet ids in location (if location provided)
  const cabinetIdsInLocation = new Set();
  if (location != null) {
    const loc = Number(location);
    for (const c of cabinets) {
      const cid = Number(c?.id);
      const cl  = Number(c?.location ?? 0);
      if (Number.isFinite(cid) && cl === loc) cabinetIdsInLocation.add(cid);
    }
  }

  // slots in location (via cabinet relationship)
  const slotIdsInLocation = new Set();
  if (location != null) {
    for (const s of slots) {
      const sid = Number(s?.id);
      const cabId = Number(s?.cabinet ?? 0);
      if (Number.isFinite(sid) && cabinetIdsInLocation.has(cabId)) {
        slotIdsInLocation.add(sid);
      }
    }
  }

  // ---- normalize input values to integers ----
  const normalized = {}; // slotId -> { field: intFlavorId }
  for (const [slotIdStr, patch] of Object.entries(changes)) {
    const slotId = Number(slotIdStr);

    if (!Number.isFinite(slotId) || slotId <= 0) {
      addError(`Invalid slot id "${slotIdStr}".`, `changes.${slotIdStr}`);
      continue;
    }

    const slot = slotsById.get(slotId);
    if (!slot) {
      addError(`Unknown slot id ${slotId}.`, `changes.${slotIdStr}`);
      continue;
    }

    if (location != null && !slotIdsInLocation.has(slotId)) {
      addError(`Slot ${slotId} is not in location ${location}.`, `changes.${slotIdStr}`);
      continue;
    }

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      addError(`Slot ${slotId} patch must be an object.`, `changes.${slotIdStr}`);
      continue;
    }

    const cleaned = {};
    for (const [field, raw] of Object.entries(patch)) {
      if (!allowedFields.includes(field)) {
        addFieldError(slotId, field, `Field "${field}" is not writable.`);
        continue;
      }

      // empty -> 0
      const n = (raw == null || raw === "") ? 0 : Number(raw);

      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        addFieldError(slotId, field, `Value must be an integer id (or 0). Got "${String(raw)}".`);
        continue;
      }

      if (n === 0 && !allowZeroFlavor) {
        addFieldError(slotId, field, `0 is not allowed for "${field}".`);
        continue;
      }

      if (n !== 0 && !flavorsById.has(n)) {
        addFieldError(slotId, field, `Flavor id ${n} does not exist.`);
        continue;
      }

      cleaned[field] = n;
    }

    normalized[String(slotId)] = cleaned;
  }

  // Stop if schema errors are already present
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  if (errors.length || hasFieldErrors) {
    return { ok: false, errors, fieldErrors, warnings, fieldWarnings, normalized };
  }

  // ---- deep checks (optional) ----
  if (deepChecks) {
    // 1) Warn if "current_flavor" conflicts within same cabinet (often undesirable)
    // (This is a WARNING by default, since your hooks may reconcile.)
    const cabinetSlots = new Map(); // cabinetId -> [slotId]
    for (const s of slots) {
      const sid = Number(s?.id);
      const cabId = Number(s?.cabinet ?? 0);
      if (!Number.isFinite(sid) || !Number.isFinite(cabId) || cabId <= 0) continue;
      if (location != null && !slotIdsInLocation.has(sid)) continue;

      const arr = cabinetSlots.get(cabId) ?? [];
      arr.push(sid);
      cabinetSlots.set(cabId, arr);
    }

    // Effective value = existing slot field overridden by patch if provided
    const effectiveField = (slot, slotId, field) => {
      const p = normalized[String(slotId)];
      if (p && Object.prototype.hasOwnProperty.call(p, field)) return p[field];
      return Number(slot?.[field] ?? 0);
    };

    for (const [cabId, slotIds] of cabinetSlots.entries()) {
      const seen = new Map(); // flavorId -> slotId list
      for (const sid of slotIds) {
        const slot = slotsById.get(sid);
        const cur = effectiveField(slot, sid, "current_flavor");
        if (!cur) continue;
        const list = seen.get(cur) ?? [];
        list.push(sid);
        seen.set(cur, list);
      }
      for (const [flavorId, list] of seen.entries()) {
        if (list.length > 1) {
          const cabTitle = cabinetsById.get(cabId)?._title ?? `Cabinet ${cabId}`;
          for (const sid of list) {
            addFieldWarning(
              sid,
              "current_flavor",
              `Duplicate current_flavor ${flavorId} within ${cabTitle} (slots: ${list.join(", ")}).`
            );
          }
        }
      }
    }

    // 2) Warn if immediate == next (likely pointless)
    for (const [sidStr, patch] of Object.entries(normalized)) {
      const sid = Number(sidStr);
      if (!patch) continue;
      if (patch.immediate_flavor && patch.next_flavor && patch.immediate_flavor === patch.next_flavor) {
        addFieldWarning(sid, "next_flavor", "next_flavor equals immediate_flavor.");
      }
    }

    // 3) Optional inventory-aware warning: selecting a current_flavor with no locally-available tubs
    // Your Flavor model defines "available" as state !== Opened && !== Emptied.
    // Here we warn if there are 0 "available here" tubs for chosen current_flavor.
    const loc = location != null ? Number(location) : null;
    if (loc != null && Number.isFinite(loc)) {
      const availHereByFlavor = new Map(); // flavorId -> count
      for (const t of tubs) {
        if (!t) continue;
        const state = String(t.state ?? "");
        if (state === "Opened" || state === "Emptied") continue;
        if (Number(t.location ?? 0) !== loc) continue;
        const fid = Number(t.flavor ?? 0);
        if (!fid) continue;
        availHereByFlavor.set(fid, (availHereByFlavor.get(fid) ?? 0) + 1);
      }

      for (const [sidStr, patch] of Object.entries(normalized)) {
        const sid = Number(sidStr);
        const fid = patch?.current_flavor;
        if (!fid) continue;
        const n = availHereByFlavor.get(fid) ?? 0;
        if (n === 0) {
          addFieldWarning(
            sid,
            "current_flavor",
            `No available tubs of flavor ${fid} at location ${loc} (based on current data).`
          );
        }
      }
    }
  }

  const ok =
    errors.length === 0 &&
    Object.keys(fieldErrors).length === 0;

  return { ok, errors, fieldErrors, warnings, fieldWarnings, normalized };
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
