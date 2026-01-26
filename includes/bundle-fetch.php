<?php

function scoop_field_type($desc): string {
  if (is_string($desc)) return $desc; // backward compat
  if (is_array($desc)) {
    $t = $desc['data_type'] ?? $desc['type'] ?? 'string';
    return is_string($t) ? $t : 'string';
  }
  return 'string';
}

function scoop_cast($v, $desc) {
  $type = scoop_field_type($desc);

  switch ($type) {
    case 'int':
      return scoop_rel_id($v);

    case 'float':
      if (is_array($v) || is_object($v)) return 0.0;
      return (float)$v;

    case 'string':
      if (is_array($v) || is_object($v)) return '';
      return (string)$v;

    case 'bool':
      return (bool)$v;

    default:
      return $v;
  }
}

function scoop_fetch_entities(string $key, array $ctx = [], bool $fields_only = false ): array {
      error_log('-----------scoop_fetch_entities');
  $specs = scoop_entity_specs();
  if (empty($specs[$key])) return [];

  $spec = $specs[$key];
  if (!function_exists('pods')) return [];

  if( $fields_only ) return $spec['fields'];

  $post_type = $spec['post_type'];
  $pod_name  = $spec['pod'];
  $pod_write = $spec['writeable'];

  // Keep this big to avoid paging; we’ll filter in PHP for now.
  // If you later confirm fields are stored in postmeta, you can add meta_query here.
  $ids = get_posts([
    'post_type'      => $post_type,
    'post_status'    => 'any',
    'posts_per_page' => 2000,
    'fields'         => 'ids',
    'writeable'       => $pod_write,
    'no_found_rows'  => true,
  ]);

  $out = [];
  foreach ($ids as $id) {
    $pod = pods($pod_name, $id);
    if (!$pod || !$pod->exists()) continue;
    

    $row = [
      'id' => (int)$id,
    ];

    if (!empty($spec['title'])) {
      $row['_title'] = get_the_title($id);
    }

    foreach (($spec['fields'] ?? []) as $field => $desc) {
      $row[$field] = scoop_cast($pod->field($field), $desc);
    }

    // Optional contextual filter
    if (!empty($spec['filter']) && is_callable($spec['filter'])) {
      if (!$spec['filter']($row, $ctx)) continue;
    }

    // Optional location filter (common)
    if (!empty($ctx['location']) && isset($row['location'])) {
      if ((int)$row['location'] !== (int)$ctx['location']) continue;
    }

    $p = get_post($id);
    foreach (($spec['post_fields'] ?? []) as $field => $type) {
      if ($field === 'author_name') {
        $row['author_name'] = scoop_cast(
          get_the_author_meta('display_name', $p?->post_author ?? 0),
          'string'
        );
      }
    }

    $out[] = $row;
  }

  return $out;
}
//$field = scoop_pods_field_def('tub', 'state');
//error_log(print_r($field, true));
function scoop_bundle_fetch_type(string $needType, \WP_REST_Request $req): array {
  // Convert request context you care about (location, etc.)
  $ctx = [];

  $loc = $req->get_param('location');
  if ($loc !== null && $loc !== '') $ctx['location'] = (int) $loc;

  $map = [ 
    'tub'      => 'tub',
    'flavor'   => 'flavor',
    'slot'     => 'slot',
    'use'      => 'use',
    'location' => 'location',
    'cabinet'  => 'cabinet',
    'batch'   => 'batch',
    'closeout' => 'closeout',
  ];

  $key = $map[$needType] ?? $needType;
  return scoop_fetch_entities($key, $ctx);
}