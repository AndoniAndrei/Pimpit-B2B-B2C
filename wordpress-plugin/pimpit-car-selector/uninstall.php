<?php
/**
 * Runs when the plugin is uninstalled from the WP admin. Removes options and
 * transients but leaves WooCommerce products untouched.
 *
 * @package PimpitCarSelector
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'pimpit_cs_settings' );

global $wpdb;
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_pimpit\\_cs\\_%' OR option_name LIKE '\\_transient\\_timeout\\_pimpit\\_cs\\_%'"
);
