<?php
/**
 * Plugin Name: Scoop Rest
 * Description: Minimal REST endpoint to receive planning grid commands.
 */
if (!defined('ABSPATH')) exit;

define('SCOOP_REST_FILE', __FILE__);
define('SCOOP_REST_DIR', plugin_dir_path(__FILE__));
define('SCOOP_REST_URL', plugin_dir_url(__FILE__));

function scoop_require($rel) {
  $path = __DIR__ . '/' . ltrim($rel, '/');
  if (!file_exists($path)) {
    error_log("Scoop Rest missing file: " . $path);
    wp_die("Scoop Rest missing required file: " . esc_html($rel));
  }
  require_once $path;
}

scoop_require('includes/_config.php');
scoop_require('includes/enqueue.php');
scoop_require('includes/shortcode.php');
scoop_require('includes/pods.php');
scoop_require('includes/_specs.php');
scoop_require('includes/bundle-fetch.php');
scoop_require('includes/bundle.php');

scoop_require('includes/rest.php');

scoop_require('includes/admin-page.php');
