<?php
/**
 * AJAX endpoints: cascade dropdowns (makes -> years -> models -> mods) and
 * the final "match" call that runs the matchers and returns rendered HTML.
 *
 * All endpoints are public (wp_ajax_nopriv_* + wp_ajax_*) since the form is
 * for unauthenticated shoppers. Auth lives in the nonce.
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Ajax {

	/** @var Pimpit_CS_Plugin */
	private $plugin;

	public function __construct( Pimpit_CS_Plugin $plugin ) {
		$this->plugin = $plugin;
		foreach ( array( 'makes', 'years', 'models', 'modifications', 'match' ) as $action ) {
			add_action( 'wp_ajax_pimpit_cs_' . $action, array( $this, $action ) );
			add_action( 'wp_ajax_nopriv_pimpit_cs_' . $action, array( $this, $action ) );
		}
	}

	private function check_nonce() {
		if ( ! check_ajax_referer( 'pimpit_cs_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Sesiune expirată. Reîmprospătează pagina.', 'pimpit-car-selector' ) ), 403 );
		}
	}

	public function makes() {
		$this->check_nonce();
		$result = $this->plugin->api->get_makes();
		wp_send_json_success( $this->shape_choices( $result, 'slug', 'name' ) );
	}

	public function years() {
		$this->check_nonce();
		$make = isset( $_REQUEST['make'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['make'] ) ) : '';
		$result = $this->plugin->api->get_years( $make );
		// Years endpoint returns either array of ints or array of {year:int}.
		$choices = array();
		$rows    = isset( $result['data'] ) ? $result['data'] : array();
		foreach ( $rows as $row ) {
			if ( is_array( $row ) ) {
				if ( isset( $row['year'] ) ) {
					$choices[] = array(
						'value' => (string) $row['year'],
						'label' => (string) $row['year'],
					);
				}
			} else {
				$choices[] = array(
					'value' => (string) $row,
					'label' => (string) $row,
				);
			}
		}
		wp_send_json_success( $choices );
	}

	public function models() {
		$this->check_nonce();
		$make = isset( $_REQUEST['make'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['make'] ) ) : '';
		$year = isset( $_REQUEST['year'] ) ? (int) $_REQUEST['year'] : 0;
		$result = $this->plugin->api->get_models( $make, $year );
		wp_send_json_success( $this->shape_choices( $result, 'slug', 'name' ) );
	}

	public function modifications() {
		$this->check_nonce();
		$make  = isset( $_REQUEST['make'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['make'] ) ) : '';
		$year  = isset( $_REQUEST['year'] ) ? (int) $_REQUEST['year'] : 0;
		$model = isset( $_REQUEST['model'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['model'] ) ) : '';
		$result = $this->plugin->api->get_modifications( $make, $year, $model );
		wp_send_json_success( $this->shape_choices( $result, 'slug', 'name' ) );
	}

	public function match() {
		$this->check_nonce();
		$make  = isset( $_REQUEST['make'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['make'] ) ) : '';
		$year  = isset( $_REQUEST['year'] ) ? (int) $_REQUEST['year'] : 0;
		$model = isset( $_REQUEST['model'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['model'] ) ) : '';
		$mod   = isset( $_REQUEST['modification'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['modification'] ) ) : '';

		if ( '' === $make || '' === $model || '' === $mod || $year <= 0 ) {
			wp_send_json_error( array( 'message' => __( 'Selectează toate câmpurile.', 'pimpit-car-selector' ) ), 400 );
		}

		$specs = $this->plugin->api->get_specs( $make, $year, $model, $mod );
		if ( isset( $specs['error'] ) ) {
			wp_send_json_error( array( 'message' => $specs['error'] ), 502 );
		}

		$enabled = (array) $this->plugin->settings->get( 'enabled_matchers' );
		$matchers = $this->plugin->matchers->enabled( $enabled );

		$sections = array();
		foreach ( $matchers as $slug => $matcher ) {
			if ( ! $matcher->is_available() ) {
				continue;
			}
			$wp_query = $matcher->query( $specs );
			$sections[] = array(
				'slug'  => $slug,
				'label' => $matcher->label(),
				'html'  => $this->render_section( $matcher, $wp_query ),
				'count' => (int) $wp_query->found_posts,
			);
			wp_reset_postdata();
		}

		wp_send_json_success(
			array(
				'sections' => $sections,
				'vehicle'  => array(
					'make'         => $make,
					'year'         => $year,
					'model'        => $model,
					'modification' => $mod,
				),
			)
		);
	}

	private function render_section( Pimpit_CS_Matcher_Interface $matcher, WP_Query $query ) {
		ob_start();
		include PIMPIT_CS_DIR . 'templates/results.php';
		return ob_get_clean();
	}

	/**
	 * Map an API list payload to {value, label} choices for a <select>.
	 */
	private function shape_choices( $result, $value_key, $label_key ) {
		$rows = isset( $result['data'] ) ? $result['data'] : array();
		$out  = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$value = isset( $row[ $value_key ] ) ? (string) $row[ $value_key ] : '';
			$label = isset( $row[ $label_key ] ) ? (string) $row[ $label_key ] : $value;
			if ( '' === $value ) {
				continue;
			}
			$out[] = array(
				'value' => $value,
				'label' => $label,
			);
		}
		return $out;
	}
}
