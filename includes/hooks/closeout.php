<?php
if (!defined('ABSPATH')) exit;

/**
 * CLOSEOUT AUTOMATION
 * 
 * When a closeout is created with:
 * - tubs_emptied: 3.5 (can be fractional)
 * - flavor: ID
 * - location: ID  
 * - use: ID
 * 
 * This will:
 * 1. Find matching partial tub if needed (±0.2)
 * 2. Find whole tubs (prefer Opened, oldest first)
 * 3. Mark tubs as Emptied, link them bidirectionally
 * 4. Set emptied_at date on tubs
 */

/**
 * Pre-save: Build title for closeout
 */
add_filter('pods_api_pre_save_pod_item_closeout', 'scoop_prepare_closeout', 5, 2);
function scoop_prepare_closeout($pieces, $is_new_item) {
  error_log("=== CLOSEOUT PRE-SAVE ===");
  error_log("Is new: " . ($is_new_item ? 'YES' : 'NO'));
  
  if (!isset($pieces['fields_active']) || !is_array($pieces['fields_active'])) {
    $pieces['fields_active'] = [];
  }

  $tubs_emptied = (float)($pieces['fields']['tubs_emptied']['value'] ?? 0);
  $flavor_id    = scoop_rel_id($pieces['fields']['flavor']['value'] ?? null);
  $location_id  = scoop_rel_id($pieces['fields']['location']['value'] ?? null);

  error_log("  tubs_emptied: {$tubs_emptied}");
  error_log("  flavor_id: {$flavor_id}");
  error_log("  location_id: {$location_id}");

  $flavor_name   = $flavor_id ? get_the_title($flavor_id) : '';
  $location_name = $location_id ? get_the_title($location_id) : '';

  if ($tubs_emptied > 0 && $flavor_name) {
    $post_title = sprintf(
      '%.2fx %s%s',
      $tubs_emptied,
      $flavor_name,
      $location_name ? " @ {$location_name}" : ''
    );
    
    error_log("  Generated title: {$post_title}");
    
    $pieces['object_fields']['post_title']['value'] = $post_title;
    $pieces['object_fields']['post_name']['value'] = sanitize_title($post_title);
    
    if (!in_array('post_title', $pieces['fields_active'], true)) {
      $pieces['fields_active'][] = 'post_title';
    }
  }

  return $pieces;
}

/**
 * Post-save: Process closeout (idempotent)
 */
add_filter('pods_api_post_save_pod_item_closeout', 'scoop_process_closeout', 20, 3);
function scoop_process_closeout($pieces, $is_new_item, $id) {
  error_log("=== CLOSEOUT POST-SAVE ===");
  error_log("Closeout ID: {$id}");
  error_log("Is new: " . ($is_new_item ? 'YES' : 'NO'));
  
  $closeout_id = (int)$id;
  if (!$closeout_id) {
    error_log("ERROR: No closeout ID");
    return $pieces;
  }

  return scoop_guard("process_closeout:{$closeout_id}", function() use ($pieces, $closeout_id) {
    error_log("  Inside guard for closeout {$closeout_id}");
    
    $closeout = pods('closeout', $closeout_id);
    if (!$closeout || !$closeout->exists()) {
      error_log("  ERROR: Closeout pod doesn't exist");
      return $pieces;
    }

    // Idempotency: skip if already has linked tubs
    $existing_tubs = $closeout->field('tub');
    error_log("  Existing tubs: " . print_r($existing_tubs, true));
    
    if (!empty($existing_tubs)) {
      error_log("  SKIP: Closeout already processed");
      return $pieces;
    }

    // Extract field values
    $location_raw = $closeout->field('location');
    $flavor_raw   = $closeout->field('flavor');
    $use_raw      = $closeout->field('use');
    $need_raw     = $closeout->field('tubs_emptied');
    
    error_log("  Raw values:");
    error_log("    location: " . print_r($location_raw, true));
    error_log("    flavor: " . print_r($flavor_raw, true));
    error_log("    use: " . print_r($use_raw, true));
    error_log("    tubs_emptied: " . print_r($need_raw, true));

    $location_id  = scoop_rel_id($location_raw);
    $flavor_id    = scoop_rel_id($flavor_raw);
    $use_id       = scoop_rel_id($use_raw);
    $need         = (float)$need_raw;

    error_log("  Normalized values:");
    error_log("    location_id: {$location_id}");
    error_log("    flavor_id: {$flavor_id}");
    error_log("    use_id: {$use_id}");
    error_log("    need: {$need}");

    if (!$location_id || !$flavor_id || !$use_id || $need <= 0) {
      error_log("  ERROR: Missing required data");
      scoop_fail_closeout($closeout_id, 'Missing required data (location/flavor/use/tubs_emptied)');
      return $pieces;
    }

    // Match tubs with fractional logic
    error_log("  Calling scoop_match_closeout_tubs...");
    $match = scoop_match_closeout_tubs($flavor_id, $location_id, $need);
    
    error_log("  Match result: " . print_r($match, true));
    
    if ($match['error']) {
      error_log("  ERROR: " . $match['error']);
      scoop_fail_closeout($closeout_id, $match['error']);
      return $pieces;
    }

    if (empty($match['tubs'])) {
      error_log("  ERROR: No tubs found");
      scoop_fail_closeout($closeout_id, 'No eligible tubs found');
      return $pieces;
    }

    // Mark tubs as emptied
    $updated_tub_ids = [];
    $total_amount = 0;
    $emptied_at = current_time('mysql');
    
    error_log("  Processing " . count($match['tubs']) . " tubs...");
    error_log("  emptied_at: {$emptied_at}");

    foreach ($match['tubs'] as $idx => $tub_obj) {
      $tub_id = (int)$tub_obj->id();
      error_log("    Tub #{$idx}: ID={$tub_id}");
      
      if (!$tub_id) {
        error_log("      SKIP: No ID");
        continue;
      }

      $amount = (float)$tub_obj->field('amount') ?: 1.0;
      error_log("      amount: {$amount}");
      
      $update_data = [
        'state'      => 'Emptied',
        'use'        => $use_id,
        'closeout'   => $closeout_id,
        'emptied_at' => $emptied_at,
      ];
      
      error_log("      Update data: " . print_r($update_data, true));
      
      $res = pods_api()->save_pod_item([
        'pod'  => 'tub',
        'id'   => $tub_id,
        'data' => $update_data,
      ]);
      
      error_log("      Save result: " . ($res ? "SUCCESS (ID: {$res})" : "FAILED"));
      
      if ($res) {
        $updated_tub_ids[] = $tub_id;
        $total_amount += $amount;
      }
    }

    error_log("  Updated {count($updated_tub_ids)} tubs, total amount: {$total_amount}");
    error_log("  Tub IDs: " . implode(', ', $updated_tub_ids));

    // Link tubs back to closeout
    $note = sprintf(
      'Closed %.2f tubs (requested %.2f). Tub IDs: %s',
      $total_amount,
      $need,
      implode(', ', $updated_tub_ids)
    );

    error_log("  Note: {$note}");
    
    $closeout_update = [
      'tub'          => $updated_tub_ids,
      'post_content' => $note,
    ];
    
    error_log("  Updating closeout with: " . print_r($closeout_update, true));

    $closeout_res = pods_api()->save_pod_item([
      'pod'  => 'closeout',
      'id'   => $closeout_id,
      'data' => $closeout_update,
    ]);

    error_log("  Closeout update result: " . ($closeout_res ? "SUCCESS" : "FAILED"));

    return $pieces;
  }, $pieces);
}

/**
 * Match tubs: handle fractional + whole logic
 */
function scoop_match_closeout_tubs(int $flavor_id, int $location_id, float $need): array {
  error_log("  === scoop_match_closeout_tubs ===");
  error_log("    flavor_id: {$flavor_id}");
  error_log("    location_id: {$location_id}");
  error_log("    need: {$need}");
  
  $whole = floor($need);
  $fraction = $need - $whole;
  
  error_log("    whole: {$whole}");
  error_log("    fraction: {$fraction}");
  
  $results = [
    'tubs'  => [],
    'total' => 0,
    'error' => null
  ];
  
  // Step 1: Match fractional part if needed
  if ($fraction > 0.01) {
    error_log("    Looking for fractional tub...");
    $fractional_tub = scoop_find_fractional_tub($flavor_id, $location_id, $fraction);
    
    if (!$fractional_tub) {
      $error = sprintf(
        'No partial tub found matching %.2f (need %.2f ± 0.2)',
        $fraction,
        $fraction
      );
      error_log("    ERROR: {$error}");
      $results['error'] = $error;
      return $results;
    }
    
    $frac_amount = (float)$fractional_tub->field('amount') ?: 1.0;
    error_log("    Found fractional tub ID " . $fractional_tub->id() . " with amount {$frac_amount}");
    
    $results['tubs'][] = $fractional_tub;
    $results['total'] += $frac_amount;
  }
  
  // Step 2: Match whole tubs
  if ($whole > 0) {
    error_log("    Looking for {$whole} whole tubs...");
    $whole_tubs = scoop_find_whole_tubs($flavor_id, $location_id, $whole);
    
    error_log("    Found " . count($whole_tubs) . " whole tubs");
    
    if (count($whole_tubs) < $whole) {
      $error = sprintf(
        'Only found %d whole tubs, need %d',
        count($whole_tubs),
        $whole
      );
      error_log("    ERROR: {$error}");
      $results['error'] = $error;
      return $results;
    }
    
    foreach ($whole_tubs as $tub) {
      $whole_amount = (float)$tub->field('amount') ?: 1.0;
      error_log("      Whole tub ID " . $tub->id() . " with amount {$whole_amount}");
      $results['tubs'][] = $tub;
      $results['total'] += $whole_amount;
    }
  }
  
  error_log("    Match complete: " . count($results['tubs']) . " tubs, total {$results['total']}");
  
  return $results;
}

/**
 * Find one partial tub matching target ± 0.2
 */
function scoop_find_fractional_tub(int $flavor_id, int $location_id, float $target): ?object {
  $min = max(0.01, $target - 0.2);
  $max = min(1.0, $target + 0.2);
  
  error_log("      scoop_find_fractional_tub: range {$min} to {$max}");
  
  $where = scoop_closeout_tub_where($flavor_id, $location_id);
  $where .= " AND amount >= {$min} AND amount <= {$max} AND amount < 1";
  
  error_log("      WHERE: {$where}");
  
  $tub = pods('tub', [
    'where'   => $where,
    'orderby' => "
      CASE WHEN state = 'Opened' THEN 0 ELSE 1 END ASC,
      post_date ASC,
      `index` ASC
    ",
    'limit'   => 1,
  ]);
  
  $count = $tub ? $tub->total() : 0;
  error_log("      Found {$count} fractional tubs");
  
  if ($count > 0) {
    error_log("      Tub ID: " . $tub->id() . ", amount: " . $tub->field('amount'));
  }
  
  return ($tub && $tub->total() > 0) ? $tub : null;
}

/**
 * Find whole tubs (amount >= 0.8, prefer Opened, oldest first)
 */
function scoop_find_whole_tubs(int $flavor_id, int $location_id, int $count): array {
  error_log("      scoop_find_whole_tubs: looking for {$count}");
  
  $where = scoop_closeout_tub_where($flavor_id, $location_id);
  $where .= " AND (amount IS NULL OR amount >= 0.8)"; // NULL = full tub (1.0)
  
  error_log("      WHERE: {$where}");
  
  $tub = pods('tub', [
    'where'   => $where,
    'orderby' => "
      CASE WHEN state = 'Opened' THEN 0 ELSE 1 END ASC,
      post_date ASC,
      `index` ASC
    ",
    'limit'   => $count,
  ]);
  
  $total = $tub ? $tub->total() : 0;
  error_log("      Found {$total} whole tubs");
  
  $results = [];
  if ($tub && $tub->total() > 0) {
    $idx = 0;
    while ($tub->fetch()) {
      error_log("        [{$idx}] ID: " . $tub->id() . ", state: " . $tub->field('state') . ", amount: " . ($tub->field('amount') ?: 'NULL'));
      $results[] = clone $tub;
      $idx++;
    }
  }
  
  return $results;
}

/**
 * Build WHERE clause for eligible tubs
 */
function scoop_closeout_tub_where(int $flavor_id, int $location_id): string {
  error_log("        scoop_closeout_tub_where: flavor={$flavor_id}, location={$location_id}");
  
  // Get valid states from Pods (dynamic!)
  $state_options = scoop_pods_dropdown_options('tub', 'state');
  
  error_log("        state_options count: " . count($state_options));
  error_log("        state_options: " . print_r($state_options, true));
  
  if (empty($state_options)) {
    // Fallback if helper fails
    $valid_states = ['Hardening', 'Freezing', 'Tempering', 'Opened'];
    error_log("        Using FALLBACK states");
  } else {
    $valid_states = array_filter(
      array_column($state_options, 'key'),
      fn($s) => $s !== 'Emptied' && $s !== '__override__'
    );
    error_log("        Using DYNAMIC states");
  }
  
  error_log("        valid_states: " . implode(', ', $valid_states));
  
  $state_sql = "'" . implode("','", array_map('esc_sql', $valid_states)) . "'";
  
  $where = sprintf(
    "flavor.ID = %d AND location.ID = %d AND state IN (%s)",
    $flavor_id,
    $location_id,
    $state_sql
  );
  
  error_log("        Final WHERE: {$where}");
  
  return $where;
}

/**
 * Mark closeout as failed with error note
 */
function scoop_fail_closeout(int $closeout_id, string $error): void {
  error_log("  === CLOSEOUT FAILED ===");
  error_log("  Closeout ID: {$closeout_id}");
  error_log("  Error: {$error}");
  
  $res = pods_api()->save_pod_item([
    'pod'  => 'closeout',
    'id'   => $closeout_id,
    'data' => [
      'post_content' => 'ERROR: ' . $error,
    ],
  ]);
  
  error_log("  Save result: " . ($res ? "SUCCESS" : "FAILED"));
}