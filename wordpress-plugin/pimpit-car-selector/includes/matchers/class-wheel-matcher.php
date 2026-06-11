<?php
/**
 * Matcher for wheels (jante). Reads the vehicle's stock + plus-size fitments
 * from the wheel-size specs payload and runs a WooCommerce query against
 * the configured product attributes (PCD, diameter, width, ET, CB).
 *
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

class Pimpit_CS_Wheel_Matcher implements Pimpit_CS_Matcher_Interface {

	/** @var Pimpit_CS_Settings */
	private $settings;

	public function __construct( Pimpit_CS_Settings $settings ) {
		$this->settings = $settings;
	}

	public function label() {
		return __( 'Jante', 'pimpit-car-selector' );
	}

	public function is_available() {
		return class_exists( 'WooCommerce' );
	}

	/**
	 * Pull the fitment dimensions from the wheel-size payload.
	 * Returns:
	 *   [
	 *     'pcds'      => ['5x112', ...],
	 *     'diameters' => [17, 18, 19],
	 *     'widths'    => [7, 7.5, 8],
	 *     'et_min'    => 35,
	 *     'et_max'    => 50,
	 *     'cbs'       => [66.6],
	 *   ]
	 *
	 * Robust to a few payload shapes — wheel-size occasionally nests stock
	 * fitments under `wheels[*].front` / `.rear` and tire-only fitments under
	 * `tires`. We only care about the rim numbers here.
	 */
	public static function extract_fitment( array $specs ) {
		$rows = array();
		if ( isset( $specs['data'] ) && is_array( $specs['data'] ) ) {
			$rows = $specs['data'];
		}

		$pcds      = array();
		$diameters = array();
		$widths    = array();
		$ets       = array();
		$cbs       = array();

		foreach ( $rows as $row ) {
			if ( empty( $row['wheels'] ) || ! is_array( $row['wheels'] ) ) {
				continue;
			}
			foreach ( $row['wheels'] as $wheel ) {
				foreach ( array( 'front', 'rear' ) as $axle ) {
					if ( empty( $wheel[ $axle ] ) || ! is_array( $wheel[ $axle ] ) ) {
						continue;
					}
					$fit = $wheel[ $axle ];

					if ( ! empty( $fit['bolt_pattern'] ) ) {
						$pcds[] = self::normalize_pcd( $fit['bolt_pattern'] );
					}
					if ( isset( $fit['rim_diameter'] ) ) {
						$diameters[] = (float) $fit['rim_diameter'];
					}
					if ( isset( $fit['rim_width'] ) ) {
						$widths[] = (float) $fit['rim_width'];
					}
					if ( isset( $fit['rim_offset'] ) ) {
						$ets[] = (float) $fit['rim_offset'];
					}
					if ( isset( $fit['centre_bore'] ) ) {
						$cbs[] = (float) $fit['centre_bore'];
					}
				}
			}
		}

		$pcds      = array_values( array_unique( array_filter( $pcds ) ) );
		$diameters = array_values( array_unique( $diameters ) );
		$widths    = array_values( array_unique( $widths ) );
		$cbs       = array_values( array_unique( $cbs ) );
		sort( $diameters );
		sort( $widths );
		sort( $cbs );

		return array(
			'pcds'      => $pcds,
			'diameters' => $diameters,
			'widths'    => $widths,
			'et_min'    => $ets ? min( $ets ) : null,
			'et_max'    => $ets ? max( $ets ) : null,
			'cbs'       => $cbs,
		);
	}

	private static function normalize_pcd( $raw ) {
		$raw = strtolower( trim( (string) $raw ) );
		$raw = str_replace( array( ' ', '×' ), array( '', 'x' ), $raw );
		return $raw;
	}

	public function query( array $specs, array $args = array() ) {
		$fit = self::extract_fitment( $specs );

		// No fitment info means we can't safely match — return an empty result rather than showing every product.
		if ( empty( $fit['pcds'] ) && empty( $fit['diameters'] ) ) {
			return new WP_Query( array( 'post__in' => array( 0 ), 'post_type' => 'product' ) );
		}

		$tax_query = array( 'relation' => 'AND' );

		$tax_query = $this->add_taxonomy_in( $tax_query, $this->settings->get( 'attr_pcd' ), $fit['pcds'] );
		$tax_query = $this->add_taxonomy_in(
			$tax_query,
			$this->settings->get( 'attr_diameter' ),
			array_map( array( $this, 'fmt_int_or_float' ), $fit['diameters'] )
		);
		$tax_query = $this->add_taxonomy_in(
			$tax_query,
			$this->settings->get( 'attr_width' ),
			$this->expand_widths( $fit['widths'] )
		);

		if ( null !== $fit['et_min'] && null !== $fit['et_max'] ) {
			$tol = (int) $this->settings->get( 'et_tolerance' );
			$ets = $this->range_int( (int) floor( $fit['et_min'] ) - $tol, (int) ceil( $fit['et_max'] ) + $tol );
			$tax_query = $this->add_taxonomy_in( $tax_query, $this->settings->get( 'attr_et' ), $ets );
		}

		if ( ! empty( $fit['cbs'] ) ) {
			$tol = (float) $this->settings->get( 'cb_tolerance' );
			$cbs = $this->expand_cbs( $fit['cbs'], $tol );
			$tax_query = $this->add_taxonomy_in( $tax_query, $this->settings->get( 'attr_cb' ), $cbs );
		}

		$limit  = isset( $args['limit'] ) ? max( 1, (int) $args['limit'] ) : (int) $this->settings->get( 'results_limit' );
		$paged  = isset( $args['paged'] ) ? max( 1, (int) $args['paged'] ) : 1;

		$query_args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => $limit,
			'paged'          => $paged,
			'tax_query'      => $tax_query,
			'no_found_rows'  => false,
		);

		$cat = (string) $this->settings->get( 'product_category' );
		if ( '' !== $cat ) {
			$query_args['tax_query'][] = array(
				'taxonomy' => 'product_cat',
				'field'    => is_numeric( $cat ) ? 'term_id' : 'slug',
				'terms'    => is_numeric( $cat ) ? (int) $cat : $cat,
			);
		}

		return new WP_Query( apply_filters( 'pimpit_cs_wheel_query_args', $query_args, $fit, $specs ) );
	}

	private function add_taxonomy_in( $tax_query, $taxonomy, $values ) {
		$taxonomy = sanitize_key( $taxonomy );
		if ( '' === $taxonomy || empty( $values ) ) {
			return $tax_query;
		}
		if ( ! taxonomy_exists( $taxonomy ) ) {
			return $tax_query;
		}
		$tax_query[] = array(
			'taxonomy' => $taxonomy,
			'field'    => 'name',
			'terms'    => array_map( 'strval', $values ),
			'operator' => 'IN',
		);
		return $tax_query;
	}

	private function fmt_int_or_float( $n ) {
		return ( floor( $n ) == $n ) ? (string) (int) $n : (string) $n;
	}

	/**
	 * Rim widths come as 7, 7.5, 8 etc. We accept widths within ±tolerance
	 * by enumerating half-step values.
	 */
	private function expand_widths( array $widths ) {
		$tol = (float) $this->settings->get( 'width_tolerance' );
		if ( empty( $widths ) ) {
			return array();
		}
		$step = 0.5;
		$out  = array();
		foreach ( $widths as $w ) {
			$start = $w - $tol;
			$end   = $w + $tol;
			for ( $v = $start; $v <= $end + 0.001; $v += $step ) {
				$out[] = $this->fmt_int_or_float( round( $v * 2 ) / 2 );
			}
		}
		return array_values( array_unique( $out ) );
	}

	private function range_int( $min, $max ) {
		$out = array();
		for ( $i = $min; $i <= $max; $i++ ) {
			$out[] = (string) $i;
		}
		return $out;
	}

	private function expand_cbs( array $cbs, $tol ) {
		$out = array();
		foreach ( $cbs as $cb ) {
			$min = $cb - $tol;
			$max = $cb + $tol;
			for ( $v = $min; $v <= $max + 0.001; $v += 0.1 ) {
				$out[] = (string) round( $v, 1 );
			}
		}
		return array_values( array_unique( $out ) );
	}
}
