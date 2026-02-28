<?php
/**
 * Quinn Widget - WordPress Integration Example
 *
 * Add this to your theme's functions.php or create a custom plugin
 */

// Method 1: Add to footer (site-wide)
function add_quinn_widget() {
    ?>
    <!-- Quinn Widget -->
    <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
    <script>
      QuinnWidget.initButton({
        apiUrl: '<?php echo get_site_url(); ?>/api',
        position: 'bottom-right',
        label: 'Ask Quinn',
        theme: 'light'
      });
    </script>
    <?php
}
add_action('wp_footer', 'add_quinn_widget');


// Method 2: Shortcode (for specific pages/posts)
function quinn_shortcode($atts) {
    $atts = shortcode_atts([
        'width' => '100%',
        'height' => '600px',
        'theme' => 'light'
    ], $atts);

    $output = '<div id="quinn-widget-' . uniqid() . '"></div>';
    $output .= '<script src="https://cdn.yoursite.com/quinn-widget.js"></script>';
    $output .= '<script>';
    $output .= 'QuinnWidget.init({';
    $output .= 'container: "#quinn-widget-' . uniqid() . '",';
    $output .= 'apiUrl: "' . get_site_url() . '/api",';
    $output .= 'width: "' . esc_js($atts['width']) . '",';
    $output .= 'height: "' . esc_js($atts['height']) . '",';
    $output .= 'theme: "' . esc_js($atts['theme']) . '"';
    $output .= '});';
    $output .= '</script>';

    return $output;
}
add_shortcode('quinn', 'quinn_shortcode');

/**
 * Usage in WordPress:
 *
 * In posts/pages, use shortcode:
 * [quinn width="100%" height="600px" theme="light"]
 *
 * In theme templates:
 * <?php echo do_shortcode('[quinn]'); ?>
 */


// Method 3: Gutenberg Block (WordPress 5+)
function register_quinn_block() {
    wp_register_script(
        'quinn-widget',
        'https://cdn.yoursite.com/quinn-widget.js',
        [],
        '1.0.0',
        true
    );

    register_block_type('propertyiq/quinn', [
        'editor_script' => 'quinn-widget',
        'render_callback' => 'render_quinn_block',
    ]);
}
add_action('init', 'register_quinn_block');

function render_quinn_block($attributes) {
    $id = 'quinn-' . uniqid();

    return sprintf(
        '<div id="%s"></div>
        <script>
        QuinnWidget.init({
            container: "#%s",
            apiUrl: "%s/api",
            width: "100%%",
            height: "600px",
            theme: "light"
        });
        </script>',
        $id,
        $id,
        get_site_url()
    );
}
?>
