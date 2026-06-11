<?php
/**
 * Settings page + accessor for plugin options.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Settings {

	const MENU_SLUG = 'pimpit-car-selector';

	public static function defaults() {
		return array(
			'api_key'           => '',
			'api_base'          => 'https://api.wheel-size.com/v2',
			'attr_pcd'          => 'pa_pcd',
			'attr_diameter'     => 'pa_diametru',
			'attr_width'        => 'pa_latime',
			'attr_et'           => 'pa_et',
			'attr_cb'           => 'pa_cb',
			'et_tolerance'      => 5,
			'width_tolerance'   => 0.5,
			'cb_tolerance'      => 0.5,
			'enabled_matchers'  => array( 'wheels' ),
			'product_category'  => '',
			'results_limit'     => 24,
			'cache_makes_days'  => 30,
			'cache_models_days' => 7,
			'cache_mods_days'   => 1,
			'cache_specs_hours' => 24,
		);
	}

	public function get( $key, $fallback = null ) {
		$opts = get_option( PIMPIT_CS_OPTION_KEY, self::defaults() );
		$opts = wp_parse_args( $opts, self::defaults() );
		if ( array_key_exists( $key, $opts ) ) {
			return $opts[ $key ];
		}
		return $fallback;
	}

	public function all() {
		return wp_parse_args( get_option( PIMPIT_CS_OPTION_KEY, array() ), self::defaults() );
	}

	public function register_admin() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function add_menu() {
		add_options_page(
			__( 'Pimpit Car Selector', 'pimpit-car-selector' ),
			__( 'Pimpit Car Selector', 'pimpit-car-selector' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' )
		);
	}

	public function register_settings() {
		register_setting(
			'pimpit_cs_group',
			PIMPIT_CS_OPTION_KEY,
			array(
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => self::defaults(),
			)
		);
	}

	public function sanitize( $input ) {
		$defaults = self::defaults();
		$clean    = array();

		$clean['api_key']  = isset( $input['api_key'] ) ? sanitize_text_field( $input['api_key'] ) : '';
		$clean['api_base'] = isset( $input['api_base'] ) ? esc_url_raw( $input['api_base'] ) : $defaults['api_base'];

		foreach ( array( 'attr_pcd', 'attr_diameter', 'attr_width', 'attr_et', 'attr_cb' ) as $k ) {
			$clean[ $k ] = isset( $input[ $k ] ) ? sanitize_key( $input[ $k ] ) : $defaults[ $k ];
		}

		$clean['et_tolerance']    = isset( $input['et_tolerance'] ) ? max( 0, (int) $input['et_tolerance'] ) : $defaults['et_tolerance'];
		$clean['width_tolerance'] = isset( $input['width_tolerance'] ) ? max( 0, (float) $input['width_tolerance'] ) : $defaults['width_tolerance'];
		$clean['cb_tolerance']    = isset( $input['cb_tolerance'] ) ? max( 0, (float) $input['cb_tolerance'] ) : $defaults['cb_tolerance'];

		$clean['enabled_matchers'] = array();
		if ( ! empty( $input['enabled_matchers'] ) && is_array( $input['enabled_matchers'] ) ) {
			foreach ( $input['enabled_matchers'] as $slug ) {
				$clean['enabled_matchers'][] = sanitize_key( $slug );
			}
		}

		$clean['product_category'] = isset( $input['product_category'] ) ? sanitize_text_field( $input['product_category'] ) : '';
		$clean['results_limit']    = isset( $input['results_limit'] ) ? max( 1, min( 200, (int) $input['results_limit'] ) ) : $defaults['results_limit'];

		$clean['cache_makes_days']  = isset( $input['cache_makes_days'] ) ? max( 0, (int) $input['cache_makes_days'] ) : $defaults['cache_makes_days'];
		$clean['cache_models_days'] = isset( $input['cache_models_days'] ) ? max( 0, (int) $input['cache_models_days'] ) : $defaults['cache_models_days'];
		$clean['cache_mods_days']   = isset( $input['cache_mods_days'] ) ? max( 0, (int) $input['cache_mods_days'] ) : $defaults['cache_mods_days'];
		$clean['cache_specs_hours'] = isset( $input['cache_specs_hours'] ) ? max( 0, (int) $input['cache_specs_hours'] ) : $defaults['cache_specs_hours'];

		return $clean;
	}

	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$opts = $this->all();
		include PIMPIT_CS_DIR . 'templates/settings-page.php';
	}
}
