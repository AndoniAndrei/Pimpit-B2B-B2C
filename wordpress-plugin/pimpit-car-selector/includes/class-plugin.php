<?php
/**
 * Plugin bootstrap. Wires together settings, shortcode, AJAX, and matcher registry.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Plugin {

	/**
	 * @var Pimpit_CS_Plugin
	 */
	private static $instance = null;

	/**
	 * @var Pimpit_CS_Settings
	 */
	public $settings;

	/**
	 * @var Pimpit_CS_WheelSize_API
	 */
	public $api;

	/**
	 * @var Pimpit_CS_Matcher_Registry
	 */
	public $matchers;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->boot();
		}
		return self::$instance;
	}

	private function boot() {
		load_plugin_textdomain(
			'pimpit-car-selector',
			false,
			dirname( plugin_basename( PIMPIT_CS_FILE ) ) . '/languages'
		);

		$this->settings = new Pimpit_CS_Settings();
		$this->api      = new Pimpit_CS_WheelSize_API( $this->settings );
		$this->matchers = new Pimpit_CS_Matcher_Registry();

		$this->matchers->register( 'wheels', new Pimpit_CS_Wheel_Matcher( $this->settings ) );
		$this->matchers->register( 'tires', new Pimpit_CS_Tire_Matcher( $this->settings ) );

		new Pimpit_CS_Shortcode( $this );
		new Pimpit_CS_Ajax( $this );

		if ( is_admin() ) {
			$this->settings->register_admin();
		}
	}

	public static function on_activate() {
		$defaults = Pimpit_CS_Settings::defaults();
		if ( false === get_option( PIMPIT_CS_OPTION_KEY ) ) {
			add_option( PIMPIT_CS_OPTION_KEY, $defaults );
		}
	}

	public static function on_deactivate() {
		// Flush all transients we own.
		global $wpdb;
		$wpdb->query(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_pimpit\\_cs\\_%' OR option_name LIKE '\\_transient\\_timeout\\_pimpit\\_cs\\_%'"
		);
	}
}
