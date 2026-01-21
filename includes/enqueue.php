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

function scoop_client_metadata():array{
  $out = [];
  foreach (scoop_routes_config() as $key => $cfg) {
    $fields = [];
    $writeable = [];
    foreach(scoop_get_entity_spec_keys($key) as $pod){
      $spc = scoop_entity_specs($pod);
      $fields[$pod] = $spc['fields'];
      $writeable[$pod] = $spc['writeable'];
    }
    $out[$key] = [
      'fields'   => $fields,
      'writeable' => $writeable,
      'fieldType' => scoop_routes_config($key)['post_type']
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