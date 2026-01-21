<?php

add_action('rest_api_init', function () {
  register_rest_route('scoop/v1', '/bundle', [
    'methods'  => ['GET'],
    'callback' => 'scoop_bundle_get',
    'permission_callback' => '__return_true',
  ]);
});

function scoop_bundle_specs(): array {
  return [
    'Cabinet'   => ['needs' => ['cabinets','slots','flavors','locations','tubs']],
    'FlavorTub' => ['needs' => ['tubs','flavors','locations','uses']],
    'Batch'     => ['needs' => ['flavors','locations']],
    'Closeout'  => ['needs' => ['flavors','locations','uses']],
  ];
}

function scoop_parse_types_param($raw): array {
  if (is_array($raw)) return array_values(array_filter(array_map('trim', $raw)));
  $raw = (string)$raw;
  if ($raw === '') return [];
  return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

function scoop_bundle_get(\WP_REST_Request $req) {
  $types = scoop_parse_types_param($req->get_param('types'));

  $specs = scoop_bundle_specs();

  if (!$types) {
    return new \WP_REST_Response([
      'ok' => false,
      'error' => 'Missing types param. Example: ?types=Cabinet,FlavorTub',
      'known' => array_keys($specs),
    ], 400);
  }

  $unknown = [];
  $needs = [];

  foreach ($types as $t) {
    if (!isset($specs[$t])) { $unknown[] = $t; continue; }
    foreach (($specs[$t]['needs'] ?? []) as $needType) {
      $needs[$needType] = true;
    }
  }

  if ($unknown) {
    return new \WP_REST_Response([
      'ok' => false,
      'error' => 'Unknown grid type(s)',
      'unknown' => $unknown,
      'known' => array_keys($specs),
      'types' => $types,
    ], 400);
  }

  $needTypes = array_keys($needs);

  $data = [];
  foreach ($needTypes as $needType) {
    $data[$needType] = scoop_bundle_fetch_type($needType, $req);
  }

  return new \WP_REST_Response([
    'ok' => true,
    'types' => $types,
    'needs' => $needTypes,
    'data' => $data,
  ], 200);
}