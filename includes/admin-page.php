<?php

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
  if ( $_SERVER['REQUEST_METHOD'] === 'POST' && isset( $_POST['Cabinet'] ) ) {

    $request = new WP_REST_Request( 'POST', '/scoop/v1/planning' );
    $request->set_param( 'Cabinet', $_POST['Cabinet'] );

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
        <input type="number" name="Cabinet[cells][1295][current_flavor]" value="940">
      </p>

      <p>
        <label>Slot ID (second slot)</label><br>
        <input type="number" name="Cabinet[cells][1296][next_flavor]" value="941">
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
