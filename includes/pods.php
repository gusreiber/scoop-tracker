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

// TODO: REWRITE or DELETE: scoop_changed
function scoop_changed( $slug, $old_pieces, $new_pieces ) {
	error_log('scoop_changed');
	$old = isset( $old_pieces['fields'][ $slug ]['value'] )
		? $old_pieces['fields'][ $slug ]['value']
		: null;

	$new = isset( $new_pieces['fields'][ $slug ]['value'] )
		? $new_pieces['fields'][ $slug ]['value']
		: null;

	// Normalize relationship arrays to scalars
	if ( is_array( $old ) ) $old = reset( $old );
	if ( is_array( $new ) ) $new = reset( $new );

	// Strict compare
	return $old !== $new;
}


// TODO: DELETE / deprecate: scoop_cast_pieces
function scoop_cast_pieces( $pieces, $pod_obj ) {
	error_log('scoop_cast_pieces');
	if ( ! $pod_obj instanceof Pods   || ! $pod_obj->exists() ) return $pieces;
	if ( ! isset( $pieces['fields'] ) || ! is_array( $pieces['fields'] ) ) return $pieces;
	if ( ! isset( $pieces['fields_active'] ) || ! is_array( $pieces['fields_active'] ) )
		$pieces['fields_active'] = array();

	foreach ( $pieces['fields'] as $slug => $field_data ) {

		// Always ask Pods for the raw field value by slug.
		$db_value = $pod_obj->field( $slug );

		// Normalize common relationship shapes to a simple ID when possible.
		if ( is_array( $db_value ) ) {
			// Case: [ 'ID' => 123, ... ]
			if ( isset( $db_value['ID'] ) ) {
				$db_value = (int) $db_value['ID'];
			}
			// Case: [ 0 => 123 ] or [ 0 => [ 'ID' => 123 ] ]
			elseif ( count( $db_value ) === 1 ) {
				$single = reset( $db_value );
				if ( is_array( $single ) && isset( $single['ID'] ) ) {
					$db_value = (int) $single['ID'];
				} else {
					$db_value = $single;
				}
			}
		} elseif ( is_object( $db_value ) && isset( $db_value->ID ) ) {
			$db_value = (int) $db_value->ID;
		}
		if ( ! isset( $pieces['fields'][ $slug ] ) || ! is_array( $pieces['fields'][ $slug ] ) )
			$pieces['fields'][ $slug ] = array();

		$pieces['fields'][ $slug ]['value'] = $db_value;

		if ( ! in_array( $slug, $pieces['fields_active'], true ) )
			$pieces['fields_active'][] = $slug;

	}
	
	return $pieces;
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
function scoop_pods_api_save( $pod, $id, array $data ) {
	error_log('scoop_pods_api_save'.$id);
    $pod = (string) $pod;
    $id  = (int) $id;

    if ( '' === $pod || $id <= 0 || empty( $data ) ) {
        return false;
    }

    if ( ! function_exists( 'pods_api' ) || ! is_object( pods_api() ) ) {
        return false;
    }

    return pods_api()->save_pod_item( array(
        'pod'  => $pod,
        'id'   => $id,
        'data' => $data,   // IMPORTANT: this path triggers your pre_save logic properly
    ) );
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
    scoop_pods_api_save( $pod, $field, $value );
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
