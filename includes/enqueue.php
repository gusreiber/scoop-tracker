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

// enqueue.php - REPLACE scoop_client_metadata()
function scoop_client_metadata(): array {
  $out = [];
  
  foreach (scoop_routes_config() as $key => $cfg) {
    $post_type = $cfg['post_type'] ?? null;
    if (!$post_type) continue;
    
    $entity_spec = scoop_entity_specs($post_type);
    if (!$entity_spec) continue;
    
    $writeable_fields = $entity_spec['writeable'] ?? [];
    $writeable_set = array_flip($writeable_fields);
    
    // Build column definitions
    $columns = [];
    foreach ($entity_spec['fields'] as $field_key => $field_desc) {
      $columns[$field_key] = [
        'label'    => ucfirst(str_replace('_', ' ', $field_key)),
        'dataType' => $field_desc['data_type'] ?? 'string',
        'control'  => $field_desc['control'] ?? 'input',
        'hidden'   => $field_desc['hidden'] ?? false,
        'visible'  => !($field_desc['hidden'] ?? false),
        'editable' => isset($writeable_set[$field_key]), // ← KEY PART
      ];
    }
    
    $out[$key] = [
      'postPod'  => $post_type,
      'columns'  => $columns,
      'writeable' => $writeable_fields, // Keep for debugging
    ];
  }
  
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