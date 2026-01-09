<?php
    /**
     * Plugin Name: Scoop Rest
     * Description: Minimal REST endpoint to receive planning grid commands.
     */
    
    if ( ! defined( 'ABSPATH' ) ) exit;

    /**
     * Enqueue Scoop assets (CSS/JS) and inject SCOOP config.
     * Call this from both front-end and admin (when appropriate).
     */
    function scoop_enqueue_assets() {
      $base_url  = plugin_dir_url(__FILE__);
      $base_path = plugin_dir_path(__FILE__);
    
      // CSS
      wp_enqueue_style(
        'scoop-grid',
        $base_url . 'assets/css.css',
        [],
        filemtime($base_path . 'assets/css.css')
      );
    
      // JS
      wp_enqueue_script(
        'scoop-grid',
        $base_url . 'assets/app.js',
        [], // add deps if you need (e.g. ['wp-api-fetch'])
        filemtime($base_path . 'assets/app.js'),
        true
      );
    
      // One stable object shape
      wp_localize_script('scoop-grid', 'SCOOP', [
        'nonce'  => wp_create_nonce('wp_rest'),
        'isAdmin'=> current_user_can('edit_posts'),
        'routes' => [
          'planning' => rest_url('scoop/v1/planning'),
          'batches'  => rest_url('scoop/v1/batches'),
          'tubs'     => rest_url('scoop/v1/tubs'),
          'closeouts'=> rest_url('scoop/v1/closeouts'),
        ],
      ]);
    }

    /**
     * Shortcode: [scoop_grid type="planning" location="935"]
     */
    add_shortcode('scoop_grid', function ($atts) {
      $atts = shortcode_atts([
        'type'     => 'planning', // planning | tubs | etc
        'location' => null,
      ], $atts, 'scoop_grid');
    
      if (!is_user_logged_in()) {
        return '<p>You must be logged in to view this.</p>';
      }
    
      $id = 'scoop-grid-' . uniqid();
    
      ob_start();
      ?>
      <div
        id="<?php echo esc_attr($id); ?>"
        class="scoop-grid <?php echo esc_attr($atts['type']); ?>"
        data-grid-type="<?php echo esc_attr($atts['type']); ?>"
        data-location="<?php echo esc_attr($atts['location']); ?>"
      ></div>
      <?php
      return ob_get_clean();
    });


    /**
     * Front-end: enqueue only on posts/pages that contain the shortcode.
     */
    add_action('wp_enqueue_scripts', function () {
      if (!is_singular()) return;
    
      global $post;
      if (!$post) return;
      if (!has_shortcode($post->post_content, 'scoop_grid')) return;
    
      scoop_enqueue_assets();
    });
    
    /**
     * Admin: enqueue only on your plugin admin page.
     */
    add_action('admin_enqueue_scripts', function ($hook) {
      if ($hook !== 'toplevel_page_scoop-command-test') return;
      scoop_enqueue_assets();
    });



/**
 * Fields (Pods slugs) that the planning endpoint is allowed to write.
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

/**
 * REST: /wp-json/scoop/v1/planning
 * - GET: health/info (optional)
 * - POST: apply planning[cells][slotId][field] = value
 */
add_action('rest_api_init', function () {

  $routes = [
    'planning' => [
      'path'         => '/planning',
      'methods'      => ['GET','POST'],
      'mode'         => 'update',
      'envelope_key' => 'planning',
      'post_type'    => 'slot',
      'pod_name'     => 'slot',
      'allowed_fields_cb' => 'scoop_planning_allowed_slot_fields',
    ],
    'batches' => [
      'path'         => '/batches',
      'methods'      => ['GET','POST'],
      'mode'         => 'create',
      'envelope_key' => 'batches',
      'post_type'    => 'batch',
      'pod_name'     => 'batch',
      'allowed_fields_cb' => 'scoop_batches_allowed_fields',
    ],
    'tubs' => [
      'path'         => '/tubs',
      'methods'      => ['GET','POST'],
      'mode'         => 'update',
      'envelope_key' => 'tubs',
      'post_type'    => 'tub',
      'pod_name'     => 'tub',
      'allowed_fields_cb' => 'scoop_tubs_allowed_fields',
    ],
    'closeouts' => [
      'path'         => '/closeouts',
      'methods'      => ['GET','POST'],
      'mode'         => 'create',
      'envelope_key' => 'closeouts',
      'post_type'    => 'closeout',
      'pod_name'     => 'closeout',
      'allowed_fields_cb' => 'scoop_closeouts_allowed_fields',
    ]
  ];

  foreach ($routes as $key => $cfg) {
    register_rest_route('scoop/v1', $cfg['path'], [
      'methods'  => $cfg['methods'],
      'callback' => function(\WP_REST_Request $req) use ($cfg, $key) {
        return scoop_handle_request($req, $cfg, $key);
      },
      'permission_callback' => function(\WP_REST_Request $req) {
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

// TYPE HELPER....
function scoop_coerce_value(string $field, $value) {
  // string enums
  if (in_array($field, ['state'], true)) {
    return (string)$value;
  }

  // integer relationship ids + numeric fields
  if (in_array($field, ['current_flavor','immediate_flavor','next_flavor','flavor','count'], true)) {
    return (int)$value;
  }

  // default: leave as-is
  return $value;
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

  $allowed = array_flip($allowed_fields);

  $post_type = $cfg['post_type'] ?? '';
  $pod_name  = $cfg['pod_name'] ?? '';
  $mode      = $cfg['mode'] ?? 'update';

  $updated   = [];
  $errors    = [];
  
  if($mode === 'create'){
    if(count($cells) !== 1) return 
        new WP_REST_Response(['ok' => false, 'error' => 'Create expects exactly one row in cells.'], 400);

    $row = reset($cells);
    if (!is_array($row)) return 
        new WP_REST_Response(['ok'=>false,'error'=>'Invalid row'], 400);
  
    $new_id = scoop_create_pod_item($pod_name, $allowed_fields, $row);
    
    if (is_wp_error($new_id)) return 
        new WP_REST_Response(['ok' => false, 'errors' => [ ['field'=>null,'error'=>$new_id->get_error_message()] ]], 400);
  
    return new WP_REST_Response([
        'ok' => true,
        'type' => $pod_name,
        'created' => [ 'id' => (int)$new_id ],
    ], 200);
  } 
  
  foreach ($cells as $id_raw => $row) {
    $id = (int)$id_raw;
    
    if ($id === 0){
      $result = create_pod_item($pod, $field, $v);
      if ($result === true) {
        if (!isset($updated[$id])) $updated[$id] = [];
        $updated[$id][$field] = $v;
      } else {
          $errors[$id][] = ['field'=>$field,'error'=> is_string($result) ? $result : 'Unknown error'];
      }
    }
    
    if ($id <= 0 || !is_array($row)) continue;

    $post = get_post($id);
    if (!$post) { $errors[$id][] = ['field'=>null,'error'=>'get_post() not found']; continue; }
    if ($post->post_type !== $post_type) {
      $errors[$id][] = ['field'=>null,'error'=>"ID is post_type={$post->post_type}, not {$post_type}"];
      continue;
    }

    if (!function_exists('pods')) {
      $errors[$id][] = ['field'=>null,'error'=>'Pods not available.'];
      continue;
    }

    $pod = pods($pod_name, $id);
    if (!$pod || !$pod->exists()) {
      $errors[$id][] = ['field'=>null,'error'=>"pods('{$pod_name}', {$id}) => not found / exists() false"];
      continue;
    }

    foreach ($row as $field => $value) {
      if (!isset($allowed[$field])) continue;

      // Default coercion: int (fits your flavor fields). You can override per endpoint later.
      $v = scoop_coerce_value($field, $value);

      $result = scoop_save_pod_field($pod, $field, $v);

      if ($result === true) {
        if (!isset($updated[$id])) $updated[$id] = [];
        $updated[$id][$field] = $v;
      } else {
        $errors[$id][] = ['field'=>$field,'error'=> is_string($result) ? $result : 'Unknown error'];
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

    if (!function_exists('pods')) {
      $errors[$id][] = ['field'=>null,'error'=>'Pods not available.'];
      continue;
    }

    $pod = pods($pod_name, $id);
    if (!$pod || !$pod->exists()) {
      $errors[$id][] = ['field'=>null,'error'=>"pods('{$pod_name}', {$id}) => not found / exists() false"];
      continue;
    }

    foreach ($row as $field => $value) {
      if (!isset($allowed[$field])) continue;

      // Default coercion: int (fits your flavor fields). You can override per endpoint later.
      $v = scoop_coerce_value($field, $value);

      $result = scoop_save_pod_field($pod, $field, $v);

      if ($result === true) {
        if (!isset($updated[$id])) $updated[$id] = [];
        $updated[$id][$field] = $v;
      } else {
        $errors[$id][] = ['field'=>$field,'error'=> is_string($result) ? $result : 'Unknown error'];
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

/**
 * Save a single field on an already-loaded Pods object.
 */
function scoop_save_pod_field( $pod, string $field, $value ) {
  try {
    // Allow "clear" if you post 0
    $pod->save( $field, $value );
    return true;
  } catch ( \Throwable $e ) {
    return $e->getMessage();
  }
}

function scoop_create_pod_item( string $pod_name, array $allowed_fields, array $data ){
  if (!function_exists('pods_api'))  return 'Pods API not available.';
  
  $allowed = array_flip($allowed_fields);

  $params = [
    'pod'  => $pod_name,   // MUST be 'batch' (your pod name), not 'batches'
    'data' => $data,
  ];
  $id = pods_api()->save_pod_item($params);

  error_log('SAVE POD ITEM: pod=' . $pod_name);
  error_log('SAVE POD ITEM DATA: ' . print_r($params['data'], true));

  if (is_wp_error($id)) return $id->get_error_message();
  $id = (int)$id;
  if ($id <= 0) return 'Create failed (no id returned).';

  return $id;
}


/**
 * Admin test page (minimal): lets you POST multiple slot IDs at once
 * and shows registered pods for quick debugging.
 */
add_action( 'admin_menu', function () {
  add_menu_page(
    'Scoop Command Test',
    'Scoop Command Test',
    'edit_posts',
    'scoop-command-test',
    'scoop_render_command_test_page'
  );
} );

function scoop_render_command_test_page() {

  if ( ! current_user_can( 'edit_posts' ) ) {
    wp_die( 'Unauthorized' );
  }

  $response = null;

  // Pods list for debug
  $all_pods = [];
  if ( function_exists( 'pods_api' ) ) {
    $all_pods = pods_api()->load_pods();
  }

  // Handle form submission
  if ( $_SERVER['REQUEST_METHOD'] === 'POST' && isset( $_POST['planning'] ) ) {

    $request = new WP_REST_Request( 'POST', '/scoop/v1/planning' );
    $request->set_param( 'planning', $_POST['planning'] );

    $r = rest_do_request( $request );

    if ( $r instanceof WP_REST_Response ) {
      $response = $r->get_data();
    } elseif ( is_wp_error( $r ) ) {
      $response = [
        'ok'    => false,
        'error' => $r->get_error_message(),
        'data'  => $r->get_error_data(),
      ];
    } else {
      $response = [
        'ok'    => false,
        'error' => 'Unexpected response type from rest_do_request().',
      ];
    }
  }

  // A couple of sample slots to copy/paste IDs
  $slot_posts = get_posts( [
    'post_type'      => 'slot',
    'posts_per_page' => 10,
    'post_status'    => 'any',
    'orderby'        => 'ID',
    'order'          => 'DESC',
  ] );
  ?>
  <div class="wrap">
    <h1>Scoop Command Test</h1>
    <?php
echo shortcode_exists('scoop_grid') ? 'SHORTCODE: yes' : 'SHORTCODE: no';
    
    ?>
    <h3>Registered Pods</h3>
    <pre><?php
      foreach ( $all_pods as $pod ) {
        printf(
          "%s  |  type=%s  |  storage=%s\n",
          $pod['name'] ?? '(no name)',
          $pod['type'] ?? '(unknown)',
          $pod['storage'] ?? '(unknown)'
        );
      }
    ?></pre>

    <h3>Recent Slot IDs</h3>
    <pre><?php
      foreach ( $slot_posts as $sp ) {
        echo (int) $sp->ID . " | " . esc_html( $sp->post_title ) . " | " . esc_html( $sp->post_status ) . "\n";
      }
    ?></pre>

    <form method="post">
      <h3>Test payload (supports multiple slots/fields)</h3>

      <p>Example fields: <code>current_flavor</code>, <code>immediate_flavor</code>, <code>next_flavor</code></p>

      <p>
        <label>Slot ID</label><br>
        <input type="number" name="planning[cells][1295][current_flavor]" value="940">
      </p>

      <p>
        <label>Slot ID (second slot)</label><br>
        <input type="number" name="planning[cells][1296][next_flavor]" value="941">
      </p>

      <p>
        <button class="button button-primary" type="submit">Send Command</button>
      </p>
    </form>

    <?php if ( $response !== null ): ?>
      <h3>Response</h3>
      <pre><?php echo esc_html( print_r( $response, true ) ); ?></pre>
    <?php endif; ?>

    <h3>GET endpoint</h3>
    <p><code>/wp-json/scoop/v1/planning</code></p>
  </div>
  <?php
}
