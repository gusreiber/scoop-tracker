<?php

// TODO: THIS WHOLE FILE SHOULD LIKELY BE REMOVED...

/*
function scoop_active_flavors( $atts = [], $content = null, $tag = '' ) {

    // Flavors that have at least one tub not assigned to a cabinet.
    // (We will filter by dates in PHP.)
    $where_flavor = "
    (
        batches.tubs.ID IS NOT NULL
        AND batches.tubs.cabinet.ID IS NULL
    )
    ";

    $flavors = pods( 'flavor', [
        'where'   => $where_flavor,
        'orderby' => 'post_title ASC',
        'limit'   => -1,
    ] );

    ob_start();

    if ( $flavors && $flavors->total() > 0 ) {
        while ( $flavors->fetch() ) {

            $flavor_id    = (int) $flavors->id();
            $flavor_title = $flavors->display( 'post_title' );

            // Query tubs for THIS flavor that are not in any cabinet.
            $where_tub = "
            (
                cabinet.ID IS NULL
                AND batch.flavor.ID = {$flavor_id}
            )
            ";

            $tubs = pods( 'tub', [
                'where'   => $where_tub,
                'orderby' => 'post_title ASC',
                'limit'   => -1,
            ] );

            if ( ! $tubs || $tubs->total() === 0 ) {
                // No tubs at all for this flavor (with cabinet = NULL),
                // skip this flavor.
                continue;
            }

            // Build tub list for this flavor, filtering by dates in PHP.
            $tub_output = '';

            while ( $tubs->fetch() ) {

                $tub_title     = $tubs->display( 'post_title' );
                $tub_state     = $tubs->display( 'state' );      // optional display
                $sold_on_date  = $tubs->display( 'sold-on' );    // field slug "sold-on"
                $sold_out_date = $tubs->display( 'sold-out' );   // field slug "sold-out"

                // A tub is "available" only if BOTH dates are empty.
                if ( ! empty( $sold_on_date ) || ! empty( $sold_out_date ) ) {
                    continue; // skip tubs that have started or finished serving
                }

                // Only reached for truly available tubs.
                $tub_output .= '<li>';
                $tub_output .= '<strong>' . esc_html( $tub_title ) . '</strong>';

                if ( $tub_state ) {
                    $tub_output .= ' — State: ' . esc_html( $tub_state );
                }
                if ( $sold_on_date ) {
                    $tub_output .= ' — Sold-on: ' . esc_html( $sold_on_date );
                }
                if ( $sold_out_date ) {
                    $tub_output .= ' — Sold-out: ' . esc_html( $sold_out_date );
                }

                $tub_output .= '</li>';
            }

            // If no tubs survived the date filter, skip this flavor entirely.
            if ( $tub_output === '' ) {
                continue;
            }

            // Otherwise, render the flavor + its available tubs.
            echo '<div class="flavor-choice">';
            echo '<h3>' . esc_html( $flavor_title ) . '</h3>';
            echo '<ul>' . $tub_output . '</ul>';
            echo '</div>';
        }
    }

    return ob_get_clean();
}

add_shortcode( 'scoop_active_flavors', 'scoop_active_flavors' );
*/
/////////////////////////////////////
/*
add_action( 'wp_ajax_scoop_add_batches', 'scoop_add_batches_ajax' );
add_action( 'wp_ajax_nopriv_scoop_add_batches', 'scoop_add_batches_ajax' );

function scoop_add_batches_ajax() {
    check_ajax_referer( 'scoop_add_batch', 'nonce' );

    $flavor_id = isset( $_POST['flavor'] ) ? (int) $_POST['flavor'] : 0;
    $count     = isset( $_POST['count'] ) ? (int) $_POST['count']  : 1;

    if ( $flavor_id <= 0 || $count < 1 ) {
        wp_send_json( array( 'success' => false, 'message' => 'Invalid input' ) );
    }

    if ( ! current_user_can( 'edit_post', $flavor_id ) ) {
        wp_send_json( array( 'success' => false, 'message' => 'Permission denied' ) );
    }

	$batch_pod = pods( 'batch' );
	$new_id    = $batch_pod->save( array(
		'flavor'     => $flavor_id,
		'post_title' => 'Batch ' . current_time( 'Y-m-d H:i:s' ),
	) );

    wp_send_json( array(
        'success' => true,
        'created' => $count.'tubs',
    ) );
}
*/
///////////////////////////////////////
/*
OLD STYLES AND SCRIPTS....

add_action( 'wp_enqueue_scripts', function() {

    // Enqueue your custom JS from the child theme
    wp_enqueue_script(
        'scoop-flavors',
        get_stylesheet_directory_uri() . '/js/scoop-flavors.js',
        array(),
        null,
        true
    );

    // Pass ajax_url + nonce to JS
    wp_localize_script(
        'scoop-flavors',
        'SCOOP_FLAVORS',
        array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'scoop_add_batch' ),
        )
    );
});
*/