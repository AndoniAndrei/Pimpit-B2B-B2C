<?php
/**
 * Registry of product matchers. Lets us add tires/accessories later without
 * touching the shortcode or AJAX layer.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Matcher_Registry {

	/** @var array<string, Pimpit_CS_Matcher_Interface> */
	private $matchers = array();

	public function register( $slug, Pimpit_CS_Matcher_Interface $matcher ) {
		$this->matchers[ sanitize_key( $slug ) ] = $matcher;
	}

	public function get( $slug ) {
		$slug = sanitize_key( $slug );
		return isset( $this->matchers[ $slug ] ) ? $this->matchers[ $slug ] : null;
	}

	public function all() {
		return $this->matchers;
	}

	public function enabled( array $enabled_slugs ) {
		$out = array();
		foreach ( $enabled_slugs as $slug ) {
			$slug = sanitize_key( $slug );
			if ( isset( $this->matchers[ $slug ] ) ) {
				$out[ $slug ] = $this->matchers[ $slug ];
			}
		}
		return $out;
	}
}
