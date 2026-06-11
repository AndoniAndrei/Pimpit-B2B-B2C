<?php
/**
 * Matcher contract. A matcher takes the wheel-size specs payload for the
 * selected vehicle and returns a WP_Query of products that fit.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

interface Pimpit_CS_Matcher_Interface {

	/**
	 * Human label shown in the results UI.
	 *
	 * @return string
	 */
	public function label();

	/**
	 * Run the WooCommerce product query.
	 *
	 * @param array $specs Normalised vehicle specs (see Pimpit_CS_Wheel_Matcher::extract_fitment for shape).
	 * @param array $args  Extra args: 'limit', 'paged'.
	 * @return WP_Query
	 */
	public function query( array $specs, array $args = array() );

	/**
	 * Whether this matcher can run with the current site setup (e.g. WooCommerce active,
	 * required attributes exist). Drives the UI to skip empty sections gracefully.
	 *
	 * @return bool
	 */
	public function is_available();
}
