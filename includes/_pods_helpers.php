<?php

if (!defined('ABSPATH')) exit;

function scoop_nodate( $value ) { 
	return ( 
		$value === null || 
		$value === '' || 
		$value === '0000-00-00 00:00:00' || 
		$value === '0000-00-00' 
	); 
}

/**
 * Extract a single related item ID from a Pods relationship field value.
 * Handles numeric, [id], [{id:..}], [{ID:..}], etc.
 */
function scoop_rel_id( $val ) {
    if ( empty( $val ) ) return 0;

    // If it’s already an ID
    if ( is_numeric( $val ) ) return (int) $val;

    // If it’s an array, get the first meaningful thing
    if ( is_array( $val ) ) {
        $first = reset( $val );
        if ( is_numeric( $first ) ) return (int) $first;

        if ( is_array( $first ) ) {
            if ( isset( $first['id'] ) && is_numeric( $first['id'] ) ) return (int) $first['id'];
            if ( isset( $first['ID'] ) && is_numeric( $first['ID'] ) ) return (int) $first['ID'];
        }

        if ( is_object( $first ) ) {
            if ( isset( $first->id ) && is_numeric( $first->id ) ) return (int) $first->id;
            if ( isset( $first->ID ) && is_numeric( $first->ID ) ) return (int) $first->ID;
        }
    }

    // If it’s an object
    if ( is_object( $val ) ) {
        if ( isset( $val->id ) && is_numeric( $val->id ) ) return (int) $val->id;
        if ( isset( $val->ID ) && is_numeric( $val->ID ) ) return (int) $val->ID;
    }

    // If it’s a string that contains an ID somewhere (rare but happens)
    if ( is_string( $val ) ) {
        $trim = trim( $val );
        if ( ctype_digit( $trim ) ) return (int) $trim;
    }

    return 0;
}

/**
 * Save fields to a Pods item via Pods API (fires Pods pre_save/post_save hooks).
 *
 * @param string $pod   Pod name (e.g. 'tub')
 * @param int    $id    Item ID
 * @param array  $data  Field values, e.g. ['state' => 'Opened']
 * @return mixed        Result from Pods API or false on failure
 */
function scoop_pods_api_save( string $pod_name, $id, array $data ) {
  $pod_name = trim((string)$pod_name);
  $id = (int)$id;

  if ($pod_name === '' || $id <= 0 || empty($data)) return false;
  if (!function_exists('pods_api') || !is_object(pods_api())) return false;

  $clean = [];
  foreach ($data as $field => $value) {
    $field = (string)$field;
    $clean[$field] = scoop_coerce_value($field, $value);
  }

  error_log("scoop_pods_api_save pod={$pod_name} id={$id} data=" . json_encode($clean));

  return pods_api()->save_pod_item([
    'pod'  => $pod_name,
    'id'   => $id,
    'data' => $clean,
  ]);
}

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
    'tubs_emptied',
    'order',
  ], true)) {
    return (int)$value;
  }

  if(in_array($field, [
    'count',
    'amount'
  ], true)) {
    return (float)$value;
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
  return [ 'flavor','count' ];
}
function scoop_tubs_allowed_fields(): array {
  return [ 'state', 'use', 'amount']; //'amount' 
}
function scoop_closeouts_allowed_fields(): array {
  return [ 'tubs_emptied', 'flavor', 'use', 'location', 'order']; //'amount' 
}

function scoop_save_pod_field( string $pod_name, int $id, string $field, $value ) {
  $value = scoop_coerce_value($field, $value);
  return scoop_pods_api_save($pod_name, $id, [ $field => $value ]);
}

function scoop_save_pod_fields( string $pod_name, int $id, array $data ) {
  try {
    $clean = [];
    foreach ($data as $field => $value) {
      $clean[$field] = scoop_coerce_value((string)$field, $value);
    }
    return scoop_pods_api_save($pod_name, $id, $clean);
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
