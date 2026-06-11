<?php
/**
 * Thin wrapper around the wheel-size.com REST API with WP transient caching.
 *
 * Endpoints follow https://api.wheel-size.com/v2/ — the `user_key` query
 * parameter carries auth. Adjust paths in the settings UI if the upstream
 * shape changes (it has been stable for years but we keep `api_base`
 * configurable to avoid hardcoding the version).
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_WheelSize_API {

	/** @var Pimpit_CS_Settings */
	private $settings;

	public function __construct( Pimpit_CS_Settings $settings ) {
		$this->settings = $settings;
	}

	public function get_makes() {
		return $this->cached( 'makes', array(), DAY_IN_SECONDS * (int) $this->settings->get( 'cache_makes_days' ) );
	}

	public function get_years( $make_slug ) {
		$make_slug = sanitize_text_field( $make_slug );
		if ( '' === $make_slug ) {
			return array();
		}
		$key = 'years_' . $make_slug;
		return $this->cached(
			'years',
			array( 'make' => $make_slug ),
			DAY_IN_SECONDS * (int) $this->settings->get( 'cache_models_days' ),
			$key
		);
	}

	public function get_models( $make_slug, $year ) {
		$make_slug = sanitize_text_field( $make_slug );
		$year      = (int) $year;
		if ( '' === $make_slug || $year <= 0 ) {
			return array();
		}
		$key = 'models_' . $make_slug . '_' . $year;
		return $this->cached(
			'models',
			array(
				'make' => $make_slug,
				'year' => $year,
			),
			DAY_IN_SECONDS * (int) $this->settings->get( 'cache_models_days' ),
			$key
		);
	}

	public function get_modifications( $make_slug, $year, $model_slug ) {
		$make_slug  = sanitize_text_field( $make_slug );
		$model_slug = sanitize_text_field( $model_slug );
		$year       = (int) $year;
		if ( '' === $make_slug || '' === $model_slug || $year <= 0 ) {
			return array();
		}
		$key = 'mods_' . $make_slug . '_' . $year . '_' . $model_slug;
		return $this->cached(
			'modifications',
			array(
				'make'  => $make_slug,
				'year'  => $year,
				'model' => $model_slug,
			),
			DAY_IN_SECONDS * (int) $this->settings->get( 'cache_mods_days' ),
			$key
		);
	}

	public function get_specs( $make_slug, $year, $model_slug, $modification_slug ) {
		$make_slug         = sanitize_text_field( $make_slug );
		$model_slug        = sanitize_text_field( $model_slug );
		$modification_slug = sanitize_text_field( $modification_slug );
		$year              = (int) $year;
		if ( '' === $make_slug || '' === $model_slug || '' === $modification_slug || $year <= 0 ) {
			return array();
		}
		$key = 'specs_' . $make_slug . '_' . $year . '_' . $model_slug . '_' . $modification_slug;
		return $this->cached(
			'search/by_model',
			array(
				'make'         => $make_slug,
				'year'         => $year,
				'model'        => $model_slug,
				'modification' => $modification_slug,
			),
			HOUR_IN_SECONDS * (int) $this->settings->get( 'cache_specs_hours' ),
			$key
		);
	}

	/**
	 * Internal: hits an endpoint with transient caching keyed by endpoint+args.
	 *
	 * @param string $endpoint Path under api_base, no leading slash.
	 * @param array  $args     Query args (user_key is added automatically).
	 * @param int    $ttl      Seconds to cache. 0 disables cache.
	 * @param string $cache_key Optional override for cache key suffix.
	 */
	private function cached( $endpoint, $args, $ttl, $cache_key = '' ) {
		$slug          = '' === $cache_key ? sanitize_key( $endpoint ) : sanitize_key( $cache_key );
		$transient_key = 'pimpit_cs_' . md5( $slug );

		if ( $ttl > 0 ) {
			$cached = get_transient( $transient_key );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$data = $this->request( $endpoint, $args );

		if ( is_wp_error( $data ) ) {
			return array(
				'error' => $data->get_error_message(),
				'data'  => array(),
			);
		}

		if ( $ttl > 0 ) {
			set_transient( $transient_key, $data, $ttl );
		}

		return $data;
	}

	private function request( $endpoint, $args ) {
		$api_key = (string) $this->settings->get( 'api_key' );
		if ( '' === $api_key ) {
			return new WP_Error( 'pimpit_cs_no_api_key', __( 'wheel-size.com API key is not configured.', 'pimpit-car-selector' ) );
		}

		$base = untrailingslashit( (string) $this->settings->get( 'api_base' ) );
		$url  = $base . '/' . ltrim( $endpoint, '/' ) . '/';

		$args['user_key'] = $api_key;
		$url              = add_query_arg( array_map( 'rawurlencode', $args ), $url );

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'pimpit_cs_http_' . $code,
				sprintf(
					/* translators: 1: HTTP status, 2: endpoint */
					__( 'wheel-size.com returned HTTP %1$d for %2$s', 'pimpit-car-selector' ),
					$code,
					$endpoint
				)
			);
		}

		$decoded = json_decode( $body, true );
		if ( null === $decoded ) {
			return new WP_Error( 'pimpit_cs_bad_json', __( 'Invalid JSON from wheel-size.com', 'pimpit-car-selector' ) );
		}

		// wheel-size paginates list endpoints as { count, next, previous, results: [...] }.
		if ( isset( $decoded['results'] ) && is_array( $decoded['results'] ) ) {
			return array(
				'data'  => $decoded['results'],
				'count' => isset( $decoded['count'] ) ? (int) $decoded['count'] : count( $decoded['results'] ),
			);
		}

		return array( 'data' => $decoded );
	}
}
