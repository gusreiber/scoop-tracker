<?php

/**
 * Shortcode: [scoop_grid type="Cabinet" location="935"]
 */

error_log('🔍 TRACE: shortcode.php file loaded');

add_shortcode('scoop_grid', function ($atts) {
    error_log('🔍 TRACE: scoop_grid shortcode handler called');
    error_log('🔍 TRACE: Raw attributes: ' . print_r($atts, true));
    
    $atts = shortcode_atts([
        'type'     => 'Cabinet', // Cabinet | tub | etc
        'location' => null,
    ], $atts, 'scoop_grid');

    error_log('🔍 TRACE: Parsed attributes - type: ' . $atts['type'] . ', location: ' . $atts['location']);

    if (!is_user_logged_in()) {
        error_log('🔍 TRACE: User not logged in - returning error message');
        return '<p>You must be logged in to view this.</p>';
    }

    error_log('🔍 TRACE: User is logged in');

    $id = 'scoop-grid-' . uniqid();
    error_log('🔍 TRACE: Generated element ID: ' . $id);

    ob_start();
    ?>
    <div
    id="<?php echo esc_attr($id); ?>"
    class="scoop-grid <?php echo esc_attr($atts['type']); ?>"
    data-grid-type="<?php echo esc_attr($atts['type']); ?>"
    data-location="<?php echo esc_attr($atts['location']); ?>"
    ></div>
    <?php
    $output = ob_get_clean();
    
    error_log('🔍 TRACE: Generated HTML length: ' . strlen($output) . ' bytes');
    error_log('🔍 TRACE: scoop_grid shortcode handler complete');
    
    return $output;
});

error_log('🔍 TRACE: scoop_grid shortcode registered');
