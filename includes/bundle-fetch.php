<?php

function scoop_cast($v, string $type) {
  switch ($type) {
    case 'int':
      // critical: collapse relationship values to an ID
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


function scoop_fetch_entities(string $key, array $ctx = []): array {
  error_log("top????: SCOOP fetch_entities key={$key} ctx=" . json_encode($ctx));

  $specs = scoop_entity_specs();
  if (empty($specs[$key])) return [];

  $spec = $specs[$key];
error_log(' pods?');
  if (!function_exists('pods')) return [];
  error_log('got pods');

  $post_type = $spec['post_type'];
  $pod_name  = $spec['pod'];

  // Keep this big to avoid paging; we’ll filter in PHP for now.
  // If you later confirm fields are stored in postmeta, you can add meta_query here.
  $ids = get_posts([
    'post_type'      => $post_type,
    'post_status'    => 'any',
    'posts_per_page' => 2000,
    'fields'         => 'ids',
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

    foreach (($spec['fields'] ?? []) as $field => $type) {
      $row[$field] = scoop_cast($pod->field($field), $type);
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

  error_log("bottom: SCOOP fetch_entities key={$key} count=" . count($out));

  return $out;
}

function scoop_bundle_fetch_type(string $needType, \WP_REST_Request $req): array {
  // Convert request context you care about (location, etc.)
  $ctx = [];

  $loc = $req->get_param('location');
  if ($loc !== null && $loc !== '') $ctx['location'] = (int) $loc;

  $map = [
    'tubs'      => 'tubs',
    'flavors'   => 'flavors',
    'slots'     => 'slots',
    'uses'      => 'uses',
    'locations' => 'locations',
    'cabinets'  => 'cabinets',
    'batches'   => 'batchs',
    'closeouts' => 'closeouts',
  ];

  $key = $map[$needType] ?? $needType;
  return scoop_fetch_entities($key, $ctx);
}