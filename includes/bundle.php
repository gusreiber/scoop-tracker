<?php

add_action('rest_api_init', function () {
  register_rest_route('scoop/v1', '/bundle', [
    'methods'  => ['GET'],
    'callback' => function(\WP_REST_Request $req) {
      return scoop_bundle_get($req);
    },
    'permission_callback' => function(\WP_REST_Request $req) {
      $u = wp_get_current_user();
      error_log('SCOOP whoami: user_id=' . ($u->ID ?? 0)
        . ' roles=' . json_encode($u->roles ?? [])
        . ' can_edit_posts=' . (current_user_can('edit_posts') ? 'yes' : 'no')
        . ' can_manage_options=' . (current_user_can('manage_options') ? 'yes' : 'no')
      );

      return is_user_logged_in();
    },
  ]);
});

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