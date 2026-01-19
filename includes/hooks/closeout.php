<?php
if (!defined('ABSPATH')) exit;

if (!function_exists('scoop_log')) {
  function scoop_log(string $msg): void {
    if (defined('SCOOP_DEBUG') && SCOOP_DEBUG) error_log($msg);
  }
}
if (!function_exists('scoop_rel_id')) {
  function scoop_rel_id($val): int {
    if (empty($val)) return 0;
    if (is_numeric($val)) return (int)$val;
    if (is_array($val)) return (int) (is_numeric(reset($val)) ? reset($val) : 0);
    if (is_object($val) && isset($val->ID)) return (int)$val->ID;
    return 0;
  }
}
if (!function_exists('scoop_guard')) {
  function scoop_guard(string $key, callable $fn, $default = null) {
    $GLOBALS['scoop_guard'] ??= [];
    if (!empty($GLOBALS['scoop_guard'][$key])) return $default;
    $GLOBALS['scoop_guard'][$key] = true;
    try { return $fn(); }
    finally { unset($GLOBALS['scoop_guard'][$key]); }
  }
}

/**
 * Pre-save: normalize/auto-fill closeout fields for admin-form creates.
 * For REST creates, you should pass location explicitly and this becomes mostly a no-op.
 */
add_filter('pods_api_pre_save_pod_item_closeout', 'scoop_prepare_closeout', 5, 2);
function scoop_prepare_closeout($pieces, $is_new_item) {

  // Ensure list
  if (!isset($pieces['fields_active']) || !is_array($pieces['fields_active'])) {
    $pieces['fields_active'] = [];
  }

  // 1) Resolve location id (admin conveniences only)
  $location_id = 0;

  if (!empty($_POST['scoop_location_id'])) {
    $location_id = (int) $_POST['scoop_location_id'];
  }

  if (!$location_id && !empty($_SERVER['HTTP_REFERER'])) {
    $maybe_id = url_to_postid($_SERVER['HTTP_REFERER']);
    if ($maybe_id && get_post_type($maybe_id) === 'location') {
      $location_id = (int) $maybe_id;
    }
  }

  if ($location_id) {
    $pieces['fields']['location']['value'] = $location_id;
    if (!in_array('location', $pieces['fields_active'], true)) $pieces['fields_active'][] = 'location';
  }

  // 2) Build title
  $tubs_emptied = (int) ($pieces['fields']['tubs_emptied']['value'] ?? 0);
  $flavor_id    = scoop_rel_id($pieces['fields']['flavor']['value'] ?? null);

  $flavor_name   = $flavor_id ? (string) get_the_title($flavor_id) : '';
  $location_name = $location_id ? (string) get_the_title($location_id) : '';

  if ($tubs_emptied > 0 && $flavor_name !== '') {
    $post_title = "{$tubs_emptied}x {$flavor_name}" . ($location_name ? " @ {$location_name}" : '');
    $pieces['object_fields']['post_title']['value'] = $post_title;

    // keep slug tidy
    $pieces['object_fields']['post_name']['value'] = sanitize_title($post_title);

    if (!in_array('post_title', $pieces['fields_active'], true)) $pieces['fields_active'][] = 'post_title';
  }

  return $pieces;
}

/**
 * Define eligibility for tubs to be emptied by a closeout.
 * Tune this in one place.
 */
function scoop_closeout_tub_where(int $flavor_id, int $location_id): string {
  // IMPORTANT: adjust state list to match your real workflow.
  // Suggestion: only tubs that are currently Serving (or Opened) get emptied by closeout.
  // Also exclude already-emptied.
  $states = ["Serving", "Opened"];
  $state_sql = "'" . implode("','", array_map('esc_sql', $states)) . "'";
  return "flavor.ID = {$flavor_id} AND location.ID = {$location_id} AND state IN ({$state_sql})";
}

/**
 * Post-save: process closeout once (idempotent).
 * Recommended: keep closeout record; mark processed_at + processed_count.
 *
 * Requires closeout pod to have fields:
 * - processed_at (datetime)  [optional but strongly recommended]
 * - processed_count (number) [optional]
 * - processed_note (text)    [optional]
 */
add_filter('pods_api_post_save_pod_item_closeout', 'scoop_process_closeout', 20, 3);
function scoop_process_closeout($pieces, $is_new_item, $id) {
  $closeout_id = (int)$id;
  if (!$closeout_id || !function_exists('pods') || !function_exists('pods_api')) return $pieces;

  return scoop_guard("process_closeout:{$closeout_id}", function() use ($pieces, $closeout_id) {

    $closeout = pods('closeout', $closeout_id);
    if (!$closeout || !$closeout->exists()) return $pieces;

    // Idempotency: skip if already processed
    $processed_at = $closeout->field('processed_at');
    if (!empty($processed_at) && $processed_at !== '0000-00-00 00:00:00') {
      scoop_log("closeout {$closeout_id} already processed_at={$processed_at}");
      return $pieces;
    }

    $location_id  = (int)$closeout->field('location.ID');
    $flavor_id    = (int)$closeout->field('flavor.ID');
    $use_id       = (int)$closeout->field('use.ID');
    $need         = (int)$closeout->field('tubs_emptied');

    if (!$location_id || !$flavor_id || !$use_id || $need <= 0) {
      // record failure note if fields exist
      pods_api()->save_pod_item([
        'pod'  => 'closeout',
        'id'   => $closeout_id,
        'data' => [
          'processed_at'   => current_time('mysql'),
          'processed_count'=> 0,
          'processed_note' => 'Missing required data (location/flavor/use/tubs_emptied).',
        ],
      ]);
      return $pieces;
    }

    // Fetch eligible tubs
    $tubs = pods('tub', [
      'where'   => scoop_closeout_tub_where($flavor_id, $location_id),
      // Better ordering: oldest first by “sold_on/opened” if you have it.
      // Adjust to your actual datetime field(s).
      'orderby' => 'sold_on ASC, post_date ASC',
      'limit'   => $need,
    ]);

    $updated = 0;

    if ($tubs && $tubs->total() > 0) {
      while ($tubs->fetch()) {
        $tub_id = (int)$tubs->id();
        if (!$tub_id) continue;

        // Use Pods API to ensure hooks fire
        $res = pods_api()->save_pod_item([
          'pod'  => 'tub',
          'id'   => $tub_id,
          'data' => [
            'state' => 'Emptied',
            'use'   => $use_id,
          ],
        ]);
        if ($res) $updated++;
      }
    }

    // Mark closeout processed (keep record)
    pods_api()->save_pod_item([
      'pod'  => 'closeout',
      'id'   => $closeout_id,
      'data' => [
        'processed_at'    => current_time('mysql'),
        'processed_count' => $updated,
        'processed_note'  => ($updated < $need)
          ? "Requested {$need}, updated {$updated} (not enough eligible tubs)."
          : "OK ({$updated}).",
      ],
    ]);

    scoop_log("closeout {$closeout_id}: requested={$need} updated={$updated}");

    return $pieces;
  }, $pieces);
}