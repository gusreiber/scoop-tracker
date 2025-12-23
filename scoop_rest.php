<?php
/**
 * Plugin Name: Scoop Rest
 * Description: Minimal REST endpoint to receive planning grid commands.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action('admin_enqueue_scripts', function ($hook) {
  // Matches add_menu_page() slug: 'scoop-command-test'
  if ($hook !== 'toplevel_page_scoop-command-test') return;

  $base_url  = plugin_dir_url(__FILE__);
  $base_path = plugin_dir_path(__FILE__);

  // --- CSS ---
  wp_enqueue_style(
    'scoop-planning-grid',
    $base_url . 'assets/css.css',
    [],
    filemtime($base_path . 'assets/cssd.css')
  );

  // --- JS ---
  wp_enqueue_script(
    'scoop-planning-grid',
    $base_url . 'assets/app.js',
    [],   // add deps if needed
    filemtime($base_path . 'assets/papp.js'),
    true
  );

  wp_localize_script('scoop-planning-grid', 'SCOOP', [
    'restUrl' => rest_url('scoop/v1/planning'),
    'nonce'   => wp_create_nonce('wp_rest'),
  ]);
});



/**
 * Fields (Pods slugs) that the planning endpoint is allowed to write.
 */
function scoop_planning_allowed_slot_fields(): array {
  return [ 'current_flavor', 'immediate_flavor', 'next_flavor' ];
}

/**
 * REST: /wp-json/scoop/v1/planning
 * - GET: health/info (optional)
 * - POST: apply planning[cells][slotId][field] = value
 */
add_action( 'rest_api_init', function () {

  register_rest_route( 'scoop/v1', '/planning', [
    'methods'  => [ 'GET', 'POST' ],
    'callback' => 'scoop_handle_planning_request',
    'permission_callback' => function ( \WP_REST_Request $req ) {
      // Simplest: require logged-in user who can edit posts
      return is_user_logged_in() && current_user_can( 'edit_posts' );
    },
    'args' => [
      // For POST, but leaving it here is fine; GET will just ignore it.
      'planning' => [
        'required' => false,
      ],
    ],
  ] );

} );

/**
 * Combined handler for GET/POST.
 */
function scoop_handle_planning_request( \WP_REST_Request $req ) {

  if ( $req->get_method() === 'GET' ) {
    return new WP_REST_Response( [
      'ok'      => true,
      'message' => 'scoop/v1/planning alive',
      'allowed_fields' => scoop_planning_allowed_slot_fields(),
      'time'    => current_time( 'mysql' ),
    ], 200 );
  }

  // --- POST ---
  return scoop_handle_planning_post( $req );
}

/**
 * POST handler.
 */
function scoop_handle_planning_post( \WP_REST_Request $req ) {

  $planning = $req->get_param( 'planning' );

  if ( ! is_array( $planning ) ) {
    return new WP_REST_Response( [
      'ok'    => false,
      'error' => 'Missing or invalid planning payload (expected planning[...] array).',
    ], 400 );
  }

  $cells = $planning['cells'] ?? null;
  if ( ! is_array( $cells ) ) {
    return new WP_REST_Response( [
      'ok'    => false,
      'error' => 'Missing planning[cells].',
    ], 400 );
  }

  $allowed = array_flip( scoop_planning_allowed_slot_fields() );

  // Group results by slot_id (easier for your GUI)
  $updated = [];  // $updated[slot_id][field] = value
  $errors  = [];  // $errors[slot_id][] = {field, error}

  foreach ( $cells as $slot_id_raw => $row ) {

    $slot_id = (int) $slot_id_raw;
    if ( $slot_id <= 0 || ! is_array( $row ) ) {
      continue;
    }

    // Confirm this is actually a Slot post
    $post = get_post( $slot_id );
    if ( ! $post ) {
      $errors[$slot_id][] = [ 'field' => null, 'error' => 'get_post() not found' ];
      continue;
    }
    if ( $post->post_type !== 'slot' ) {
      $errors[$slot_id][] = [ 'field' => null, 'error' => "ID is post_type={$post->post_type}, not slot" ];
      continue;
    }

    // Load pod once per slot (performance + consistency)
    if ( ! function_exists( 'pods' ) ) {
      $errors[$slot_id][] = [ 'field' => null, 'error' => 'Pods not available.' ];
      continue;
    }

    $pod = pods( 'slot', $slot_id );
    if ( ! $pod || ! $pod->exists() ) {
      $errors[$slot_id][] = [ 'field' => null, 'error' => "pods('slot', {$slot_id}) => not found / exists() false" ];
      continue;
    }

    // Save any whitelisted fields present in this row
    foreach ( $row as $field => $value ) {
      if ( ! isset( $allowed[$field] ) ) {
        continue;
      }

      $flavor_id = (int) $value;

      $result = scoop_save_pod_field( $pod, $field, $flavor_id );

      if ( $result === true ) {
        if ( ! isset( $updated[$slot_id] ) ) $updated[$slot_id] = [];
        $updated[$slot_id][$field] = $flavor_id;
      } else {
        $errors[$slot_id][] = [
          'field' => $field,
          'error' => is_string( $result ) ? $result : 'Unknown error',
        ];
      }
    }
  }

  $ok = empty( $errors );

  return new WP_REST_Response( [
    'ok'      => $ok,
    'updated' => $updated,
    'errors'  => $errors,
  ], $ok ? 200 : 400 );
}

/**
 * Save a single field on an already-loaded Pods object.
 */
function scoop_save_pod_field( $pod, string $field, int $value ) {
  try {
    // Allow "clear" if you post 0
    $pod->save( $field, $value );
    return true;
  } catch ( \Throwable $e ) {
    return $e->getMessage();
  }
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
