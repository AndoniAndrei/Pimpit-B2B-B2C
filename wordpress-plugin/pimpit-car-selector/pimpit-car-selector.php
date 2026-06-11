<?php
/**
 * Plugin Name:       Pimpit Car Selector
 * Plugin URI:        https://github.com/AndoniAndrei/Pimpit-B2B-B2C
 * Description:       Lets shoppers pick make / model / year / engine and recommends matching WooCommerce products (wheels for MVP, tires/accessories later) using wheel-size.com data.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Andoni Andrei
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       pimpit-car-selector
 * Domain Path:       /languages
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

define( 'PIMPIT_CS_VERSION', '0.1.0' );
define( 'PIMPIT_CS_FILE', __FILE__ );
define( 'PIMPIT_CS_DIR', plugin_dir_path( __FILE__ ) );
define( 'PIMPIT_CS_URL', plugin_dir_url( __FILE__ ) );
define( 'PIMPIT_CS_OPTION_KEY', 'pimpit_cs_settings' );

require_once PIMPIT_CS_DIR . 'includes/class-plugin.php';
require_once PIMPIT_CS_DIR . 'includes/class-wheelsize-api.php';
require_once PIMPIT_CS_DIR . 'includes/class-settings.php';
require_once PIMPIT_CS_DIR . 'includes/class-shortcode.php';
require_once PIMPIT_CS_DIR . 'includes/class-ajax.php';
require_once PIMPIT_CS_DIR . 'includes/class-matcher-registry.php';
require_once PIMPIT_CS_DIR . 'includes/matchers/interface-matcher.php';
require_once PIMPIT_CS_DIR . 'includes/matchers/class-wheel-matcher.php';
require_once PIMPIT_CS_DIR . 'includes/matchers/class-tire-matcher.php';

add_action( 'plugins_loaded', array( 'Pimpit_CS_Plugin', 'instance' ) );

register_activation_hook( __FILE__, array( 'Pimpit_CS_Plugin', 'on_activate' ) );
register_deactivation_hook( __FILE__, array( 'Pimpit_CS_Plugin', 'on_deactivate' ) );
