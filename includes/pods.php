<?php

function scoop_coerce_value(string $field, $value) {

  // string enums
  if (in_array($field, ['state'], true)) {
    return (string)$value;
  }

  // integer relationship ids + numeric fields
  if (in_array($field, [
    'current_flavor',
    'immediate_flavor',
    'next_flavor',
    'flavor',
    'use',
    'location',
    'count',
    'tubs_emptied',
    'order',
  ], true)) {
    return (int)$value;
  }

  // default: leave as-is
  return $value;
}

/**
 * Fields (Pods slugs) that the Cabinet endpoint is allowed to write.
 */
function scoop_planning_allowed_slot_fields(): array {
  return [ 'current_flavor', 'immediate_flavor', 'next_flavor' ];
}
function scoop_batches_allowed_fields(): array {
  return [ 'count', 'flavor' ];
}
function scoop_tubs_allowed_fields(): array {
  return [ 'state', 'use']; //'amount' 
}
function scoop_closeouts_allowed_fields(): array {
  return [ 'tubs_emptied', 'flavor', 'use', 'location', 'order']; //'amount' 
}

function scoop_save_pod_field( $pod, string $field, $value ) {
  try {
    // Allow "clear" if you post 0
    $pod->save( $field, $value );
    return true;
  } catch ( \Throwable $e ) {
    return $e->getMessage();
  }
}

function scoop_create_pod_item(string $pod_name, array $allowed_fields, array $data) {
  if (!function_exists('pods_api')) {
    return new WP_Error('pods_missing', 'Pods API not available.');
  }

  $allowed = array_flip($allowed_fields);
  $clean = [];
  foreach ($data as $k => $v) {
    if (!isset($allowed[$k])) continue;
    $clean[$k] = scoop_coerce_value($k, $v);
  }

  $params = ['pod' => $pod_name, 'data' => $clean];
  $id = pods_api()->save_pod_item($params);

  if (is_wp_error($id)) return $id;

  $id = (int)$id;
  if ($id <= 0) return new WP_Error('create_failed', 'Create failed (no id returned).');

  return $id;
}
