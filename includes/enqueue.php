<?php

/**
 * Enqueue Scoop assets (CSS/JS) and inject SCOOP config.
 * Call this from both front-end and admin (when appropriate).
 */

function scoop_client_routes(): array {
  $out = [];
  foreach (scoop_routes_config() as $key => $cfg) {
    $path = $cfg['path'] ?? '';
    $out[$key] = rest_url('scoop/v1' . $path);
  }

  $out['Bundle'] = rest_url('scoop/v1/bundle');
  
  return $out;
}

function scoop_client_metadata(): array {

  $out  = [];
  $user = wp_get_current_user();

  $routes = scoop_routes_config();

  foreach ($routes as $route_key => $cfg) {

    // Primary entity for this module (today: one entity per module)
    $primary = $cfg['pod_name'] ?? ($cfg['post_type'] ?? '');

    // Future-proof: allow multiple editable entities per module
    // Later you can add in _config.php: 'entity_keys' => ['slot','tub']
    if (!empty($cfg['entity_keys']) && is_array($cfg['entity_keys'])) {
      $entity_keys = $cfg['entity_keys'];
      if ($primary === '' && !empty($entity_keys)) $primary = (string)$entity_keys[0];
    } else {
      $entity_keys = ($primary !== '') ? [$primary] : [];
    }

    $entities_out = [];

    foreach ($entity_keys as $entity_key) {
      $spec   = scoop_entity_specs($entity_key);
      $fields = $spec['fields'] ?? [];

      if (empty($fields) || !is_array($fields)) {
        $entities_out[$entity_key] = [];
        continue;
      }

      // Static "ever editable" list from specs
      $spec_writeable = $spec['writeable'] ?? [];
      if (!is_array($spec_writeable)) $spec_writeable = [];

      // Dynamic per-user list from policy
      $policy_writeable = scoop_user_writeable_fields($user, $entity_key);
      if (!is_array($policy_writeable)) $policy_writeable = [];

      // Final editable set = spec ∩ policy
      $writeable_set = array_flip(array_values(array_intersect($spec_writeable, $policy_writeable)));

      // Build LIST (Grid-friendly): [{key,label,dataType,control,hidden,visible,editable}, ...]
      $columns = [];
      foreach ($fields as $field_key => $field_def) {
        // Back-compat: if you still have 'state' => 'string' style
        if (is_string($field_def)) $field_def = ['data_type' => $field_def];
        if (!is_array($field_def)) $field_def = [];

        $hidden = (bool)($field_def['hidden'] ?? false);

        $columns[] = [
          'key'      => (string)$field_key,
          'label'    => ucfirst(str_replace('_', ' ', (string)$field_key)),
          'dataType' => $field_def['data_type'] ?? 'string',
          'control'  => $field_def['control'] ?? 'input',
          'hidden'   => $hidden,
          'visible'  => !$hidden,
          'editable' => isset($writeable_set[$field_key]),
        ];
      }

      $entities_out[$entity_key] = $columns;
    }

    $out[$route_key] = [
      'primary'  => $primary,
      'entities' => $entities_out,
    ];
  }

  error_log('Final metadata module keys: ' . print_r(array_keys($out), true));
  return $out;
}

function scoop_enqueue_assets() {
  $base_url  = SCOOP_REST_URL;
  $base_path = SCOOP_REST_DIR;

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

    wp_localize_script('scoop-grid', 'SCOOP', [
        'nonce'   => wp_create_nonce('wp_rest'),
        'isAdmin' => current_user_can('edit_posts'),
        'routes'  => scoop_client_routes(),
        'metaData'=> scoop_client_metadata(), //scoop_fetch_entities
    ]);
}


// Mark the scoop-grid handle as type="module"
add_filter('script_loader_tag', function($tag, $handle, $src) {
  if ($handle !== 'scoop-grid') return $tag;

  // replace the <script ...> tag with a module script tag
  return sprintf(
    '<script type="module" src="%s"></script>' . "\n",
    esc_url($src)
  );
}, 10, 3);

// admin-page.php (or wherever you have your wp_enqueue_scripts hook)

add_action('wp_enqueue_scripts', function () {
    error_log("wp_enqueue_scripts hook fired");
    error_log("is_singular: " . (is_singular() ? 'YES' : 'NO'));
    
    if (!is_singular()) return;

    global $post;
    error_log("post exists: " . ($post ? 'YES' : 'NO'));
    
    if (!$post) return;
    
    error_log("post_content: " . substr($post->post_content, 0, 200));
    error_log("has shortcode: " . (has_shortcode($post->post_content, 'scoop_grid') ? 'YES' : 'NO'));
    
    if (!has_shortcode($post->post_content, 'scoop_grid')) return;

    error_log("CALLING scoop_enqueue_assets()");
    scoop_enqueue_assets();
});