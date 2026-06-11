<?php
/**
 * [pimpit_car_selector] shortcode. Renders the cascading dropdown form and
 * an empty results container that JS hydrates after the user submits.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Shortcode {

	/** @var Pimpit_CS_Plugin */
	private $plugin;

	public function __construct( Pimpit_CS_Plugin $plugin ) {
		$this->plugin = $plugin;
		add_shortcode( 'pimpit_car_selector', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
	}

	public function register_assets() {
		wp_register_style(
			'pimpit-cs-frontend',
			PIMPIT_CS_URL . 'assets/css/frontend.css',
			array(),
			PIMPIT_CS_VERSION
		);
		wp_register_script(
			'pimpit-cs-frontend',
			PIMPIT_CS_URL . 'assets/js/frontend.js',
			array(),
			PIMPIT_CS_VERSION,
			true
		);
		wp_localize_script(
			'pimpit-cs-frontend',
			'PimpitCS',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'pimpit_cs_nonce' ),
				'i18n'     => array(
					'select_make'  => __( 'Selectează marca', 'pimpit-car-selector' ),
					'select_year'  => __( 'Selectează anul', 'pimpit-car-selector' ),
					'select_model' => __( 'Selectează modelul', 'pimpit-car-selector' ),
					'select_mod'   => __( 'Selectează motorizarea', 'pimpit-car-selector' ),
					'loading'      => __( 'Se încarcă…', 'pimpit-car-selector' ),
					'no_results'   => __( 'Nu am găsit produse compatibile cu mașina ta.', 'pimpit-car-selector' ),
					'error'        => __( 'A apărut o eroare. Încearcă din nou.', 'pimpit-car-selector' ),
					'submit'       => __( 'Vezi produse compatibile', 'pimpit-car-selector' ),
				),
			)
		);
	}

	public function render( $atts = array() ) {
		wp_enqueue_style( 'pimpit-cs-frontend' );
		wp_enqueue_script( 'pimpit-cs-frontend' );

		$atts = shortcode_atts(
			array(
				'title' => __( 'Găsește produse pentru mașina ta', 'pimpit-car-selector' ),
			),
			$atts,
			'pimpit_car_selector'
		);

		ob_start();
		include PIMPIT_CS_DIR . 'templates/selector-form.php';
		return ob_get_clean();
	}
}
