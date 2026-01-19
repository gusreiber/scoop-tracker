<?php

function scoop_enforce_tub_rules( $pieces, $is_new_item, $id = 0 ) {
  error_log('scoop_enforce_tub_rules');

  // Resolve tub ID robustly
  $tub_id = 0;

  if (!empty($id)) {
    $tub_id = (int) $id;
  } elseif (!empty($pieces['id'])) {
    $tub_id = (int) $pieces['id'];
  } elseif (isset($pieces['params'])) {
    if (is_array($pieces['params']) && !empty($pieces['params']['id'])) {
      $tub_id = (int) $pieces['params']['id'];
    } elseif (is_object($pieces['params']) && !empty($pieces['params']->id)) {
      $tub_id = (int) $pieces['params']->id;
    }
  }

  error_log('scoop_enforce_tub_rules tub_id=' . $tub_id);

  // Only apply to edits, not new items.
  if ($is_new_item || $tub_id <= 0) return $pieces;

  if (!function_exists('pods')) return $pieces;

  $pod_obj = pods('tub', $tub_id);
  if (!$pod_obj || !$pod_obj->exists()) return $pieces;

  // Old values from DB (authoritative)
  $old_state      = (string) $pod_obj->field('state');
  $old_opened_on  = $pod_obj->field('opened_on');
  $old_emptied_at = $pod_obj->field('emptied_at');

  // New values from pieces if provided, else fall back to old
  $new_state      = isset($pieces['fields']['state']['value'])      ? (string) $pieces['fields']['state']['value']      : $old_state;
  $new_opened_on  = isset($pieces['fields']['opened_on']['value'])  ? $pieces['fields']['opened_on']['value']           : $old_opened_on;
  $new_emptied_at = isset($pieces['fields']['emptied_at']['value']) ? $pieces['fields']['emptied_at']['value']          : $old_emptied_at;

  // Helper: did the request attempt to change a field?
  $req_changes_field = function(string $field) use ($pieces): bool {
    return isset($pieces['fields'][$field]) && array_key_exists('value', (array) $pieces['fields'][$field]);
  };

  // Helper: ensure field is marked active so Pods will persist it
  $activate = function(string $field) use (&$pieces): void {
    if (!isset($pieces['fields_active']) || !is_array($pieces['fields_active'])) {
      $pieces['fields_active'] = [];
    }
    if (!in_array($field, $pieces['fields_active'], true)) {
      $pieces['fields_active'][] = $field;
    }
  };

  // If not in override, timestamps are system-controlled
  if ($new_state !== '__override__') {

    // Revert manual timestamp edits (only if request tried to change them)
    if ($req_changes_field('opened_on') && $new_opened_on !== $old_opened_on) {
      error_log('Revert opened_on for tub ' . $tub_id);
      $pieces['fields']['opened_on']['value'] = $old_opened_on;
      $activate('opened_on');
      $new_opened_on = $old_opened_on;
    }

    if ($req_changes_field('emptied_at') && $new_emptied_at !== $old_emptied_at) {
      error_log('Revert emptied_at for tub ' . $tub_id);
      $pieces['fields']['emptied_at']['value'] = $old_emptied_at;
      $activate('emptied_at');
      $new_emptied_at = $old_emptied_at;
    }

    // State transition enforcement (only if request tried to change state)
    $state_changed = $req_changes_field('state') && ($new_state !== $old_state);
    if ($state_changed) {

      if ($old_state === 'Emptied') {
        error_log('Blocked state change from Emptied for tub ' . $tub_id);

        // Revert just the state field (do not return $old_all)
        $pieces['fields']['state']['value'] = $old_state;
        $activate('state');
        $new_state = $old_state;

      } elseif ($old_state === 'Opened' && !in_array($new_state, ['Opened', 'Emptied'], true)) {
        error_log('Blocked invalid Opened transition for tub ' . $tub_id);

        $pieces['fields']['state']['value'] = $old_state;
        $activate('state');
        $new_state = $old_state;
      }
    }

    // Auto-set timestamps (idempotent)
    $now = current_time('mysql');

    if ($new_state === 'Opened' && scoop_nodate($old_opened_on) && scoop_nodate($new_opened_on)) {
      $pieces['fields']['opened_on']['value'] = $now;
      $activate('opened_on');
      error_log('auto-set opened_on for tub ' . $tub_id);
    }

    if ($new_state === 'Emptied' && scoop_nodate($old_emptied_at) && scoop_nodate($new_emptied_at)) {
      $pieces['fields']['emptied_at']['value'] = $now;
      $activate('emptied_at');
      error_log('auto-set emptied_at for tub ' . $tub_id);
    }
  }

  return $pieces;
}
