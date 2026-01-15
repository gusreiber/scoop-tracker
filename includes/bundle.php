<?php

add_action('rest_api_init', function () {
  register_rest_route('scoop/v1', '/bundle', [
    'methods'  => ['GET'],
    'callback' => 'scoop_bundle_get',
    'permission_callback' => '__return_true',
/*
    'permission_callback' => function () {
      return is_user_logged_in() && current_user_can('edit_posts');
    },*/
  ]);
});

function scoop_bundle_needs_for_grid(string $type): array {
  // mirrors your client bundleSpecForGridTypes
  $map = [
    'Cabinet'   => ['cabinets','slots','flavors','locations','tubs'],
    'FlavorTub' => ['tubs','flavors','locations','uses'],
    'Batch'     => ['flavors','locations'],
    'Closeout'  => ['flavors','locations','uses'],
  ];
  return $map[$type] ?? [];
}

function scoop_bundle_get(\WP_REST_Request $req) {
  $type     = (string)($req->get_param('types') ?? '');
  $location = (int)($req->get_param('location') ?? 0);

  if ($type === '') {
    return new \WP_REST_Response(['ok'=>false,'error'=>'Missing types'], 400);
  }

  $need = scoop_bundle_needs_for_grid($type);
  if (!$need) {
    return new \WP_REST_Response(['ok'=>false,'error'=>"Unknown types={$type}"], 400);
  }

  $ctx = ['location' => $location];

  $bundle = [];
  foreach ($need as $key) {
    $bundle[$key] = scoop_fetch_entities($key, $ctx);
  }

  return new \WP_REST_Response(['ok'=>true,'bundle'=>$bundle], 200);
}


