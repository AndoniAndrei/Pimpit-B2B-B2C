<?php
/**
 * Tire matcher — stub for future scale-up. Disabled by default. When the
 * shop starts selling tires, flesh out query() to filter by section width /
 * aspect ratio / diameter extracted from `tires` block of the wheel-size
 * payload, and add an entry to settings -> Enabled matchers.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Tire_Matcher implements Pimpit_CS_Matcher_Interface {

	/** @var Pimpit_CS_Settings */
	private $settings;

	public function __construct( Pimpit_CS_Settings $settings ) {
		$this->settings = $settings;
	}

	public function label() {
		return __( 'Anvelope', 'pimpit-car-selector' );
	}

	public function is_available() {
		return false;
	}

	public function query( array $specs, array $args = array() ) {
		return new WP_Query( array( 'post__in' => array( 0 ) ) );
	}
}
