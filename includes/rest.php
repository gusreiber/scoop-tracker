<?php

/**
 * REST: /wp-json/scoop/v1/planning
 * - GET: health/info (optional)
 * - POST: apply Cabinet[cells][slotId][field] = value
 */

add_action('rest_api_init', function () {
  
  $routes = scoop_routes_config();

  foreach ($routes as $key => $cfg) {
    register_rest_route('scoop/v1', $cfg['path'], [
      'methods'  => $cfg['methods'],
      'callback' => function(\WP_REST_Request $req) use ($cfg, $key) {
        return scoop_handle_request($req, $cfg, $key);
      },
      'permission_callback' => function(\WP_REST_Request $req) {
        $u = wp_get_current_user();
        error_log('SCOOP perm: method=' . $req->get_method()
          . ' user_id=' . ($u->ID ?? 0)
          . ' logged_in=' . (is_user_logged_in() ? 'yes' : 'no')
          . ' can_edit_posts=' . (current_user_can('edit_posts') ? 'yes' : 'no')
          . ' can_manage_options=' . (current_user_can('manage_options') ? 'yes' : 'no')
          . ' is_super_admin=' . (is_super_admin() ? 'yes' : 'no')
        );
        return is_user_logged_in() && current_user_can('edit_posts');
      },

    ]);
  }
  
});

/**
 * Combined handler for GET/POST.
 */
function scoop_handle_request(\WP_REST_Request $req, array $cfg, string $route_key) {

  $allowed_fields = [];
  if (!empty($cfg['allowed_fields_cb']) && is_callable($cfg['allowed_fields_cb'])) {
    $allowed_fields = call_user_func($cfg['allowed_fields_cb']);
  }

  if ($req->get_method() === 'GET') {
    return new \WP_REST_Response([
      'ok'            => true,
      'route'         => $route_key,
      'message'       => "scoop/v1/{$route_key} alive",
      'allowed_fields'=> array_values($allowed_fields),
      'time'          => current_time('mysql'),
    ], 200);
  }

  if ($cfg['mode'] === 'create') 
    return scoop_handle_create_post($req, $cfg, $allowed_fields);
  else
    return scoop_handle_cells_post( $req, $cfg, $allowed_fields);
}

/**
 * POST handler.
 */
function scoop_handle_create_post(\WP_REST_Request $req, array $cfg, array $allowed_fields) {

  $envelope_key = $cfg['envelope_key'] ?? null;
  if (!$envelope_key) {
    return new \WP_REST_Response(['ok'=>false,'error'=>'Misconfigured endpoint (missing envelope_key).'], 500);
  }

  $payload = $req->get_param($envelope_key);
  if (!is_array($payload)) {
    return new \WP_REST_Response(['ok'=>false,'error'=>"Missing or invalid {$envelope_key} payload."], 400);
  }

  $cells = $payload['cells'] ?? null;
  if (!is_array($cells)) {
    return new \WP_REST_Response(['ok'=>false,'error'=>"Missing {$envelope_key}[cells]."], 400);
  }

  if (count($cells) !== 1) {
    return new \WP_REST_Response(['ok' => false, 'error' => 'Create expects exactly one row in cells.'], 400);
  }

  $row = reset($cells);
  if (!is_array($row)) {
    return new \WP_REST_Response(['ok'=>false,'error'=>'Invalid row'], 400);
  }

  $pod_name  = $cfg['pod_name'] ?? '';
  if (!$pod_name) {
    return new \WP_REST_Response(['ok'=>false,'error'=>'Misconfigured endpoint (missing pod_name).'], 500);
  }

  $new_id = scoop_create_pod_item($pod_name, $allowed_fields, $row);
  if (is_wp_error($new_id)) {
    return new \WP_REST_Response([
      'ok' => false,
      'errors' => [
        ['field' => null, 'error' => $new_id->get_error_message()]
      ]
    ], 400);
  }

  return new \WP_REST_Response([
    'ok' => true,
    'type' => $pod_name,
    'created' => ['id' => (int)$new_id],
  ], 200);
}


function scoop_handle_cells_post(\WP_REST_Request $req, array $cfg, array $allowed_fields) {

  $envelope_key = $cfg['envelope_key'] ?? null;
  if (!$envelope_key) {
    return new \WP_REST_Response(['ok'=>false,'error'=>'Misconfigured endpoint (missing envelope_key).'], 500);
  }

  $payload = $req->get_param($envelope_key);
  if (!is_array($payload)) {
    return new \WP_REST_Response(['ok'=>false,'error'=>"Missing or invalid {$envelope_key} payload."], 400);
  }

  $cells = $payload['cells'] ?? null;
  if (!is_array($cells)) {
    return new \WP_REST_Response(['ok'=>false,'error'=>"Missing {$envelope_key}[cells]."], 400);
  }

  $allowed = array_flip($allowed_fields);

  $post_type = $cfg['post_type'] ?? '';
  $pod_name  = $cfg['pod_name'] ?? '';

  $updated = [];
  $errors  = [];

  foreach ($cells as $id_raw => $row) {
    $id = (int)$id_raw;
    if ($id <= 0 || !is_array($row)) continue;

    $post = get_post($id);
    if (!$post) { $errors[$id][] = ['field'=>null,'error'=>'get_post() not found']; continue; }
    if ($post->post_type !== $post_type) {
      $errors[$id][] = ['field'=>null,'error'=>"ID is post_type={$post->post_type}, not {$post_type}"];
      continue;
    }

    if (!function_exists('pods_api') || !is_object(pods_api())) {
      $errors[$id][] = ['field'=>null,'error'=>'Pods API not available.'];
      continue;
    }

    $clean = [];
    foreach ($row as $field => $value) {
      if (!isset($allowed[$field])) continue;
      $clean[$field] = scoop_coerce_value($field, $value);
    }

    if (!empty($clean)) {
      $result = scoop_pods_api_save($pod_name, $id, $clean);

      if ($result !== false && !is_wp_error($result)) {
        $updated[$id] = ($updated[$id] ?? []) + $clean;
      } else {
        $msg = is_wp_error($result) ? $result->get_error_message() : 'Save failed';
        foreach (array_keys($clean) as $field) {
          $errors[$id][] = ['field'=>$field,'error'=>$msg];
        }
      }
    }

  }

  $ok = empty($errors);
  return new \WP_REST_Response([
    'ok'      => $ok,
    'updated' => $updated,
    'errors'  => $errors,
  ], $ok ? 200 : 400);
}
