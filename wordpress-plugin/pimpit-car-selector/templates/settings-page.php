<?php
/**
 * Admin settings page.
 *
 * @var array $opts
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;

$matchers = Pimpit_CS_Plugin::instance()->matchers->all();
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Pimpit Car Selector', 'pimpit-car-selector' ); ?></h1>
	<p class="description">
		<?php esc_html_e( 'Configurează cheia wheel-size.com și maparea atributelor WooCommerce folosite pentru match-ul produselor.', 'pimpit-car-selector' ); ?>
	</p>

	<form method="post" action="options.php">
		<?php settings_fields( 'pimpit_cs_group' ); ?>

		<h2><?php esc_html_e( 'API', 'pimpit-car-selector' ); ?></h2>
		<table class="form-table">
			<tr>
				<th><label for="pimpit_cs_api_key"><?php esc_html_e( 'API key (wheel-size.com)', 'pimpit-car-selector' ); ?></label></th>
				<td>
					<input id="pimpit_cs_api_key" type="password" class="regular-text"
						name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[api_key]"
						value="<?php echo esc_attr( $opts['api_key'] ); ?>" autocomplete="off" />
					<p class="description"><?php esc_html_e( 'Cheia se trimite ca user_key în query string către https://api.wheel-size.com/', 'pimpit-car-selector' ); ?></p>
				</td>
			</tr>
			<tr>
				<th><label for="pimpit_cs_api_base"><?php esc_html_e( 'API base URL', 'pimpit-car-selector' ); ?></label></th>
				<td>
					<input id="pimpit_cs_api_base" type="url" class="regular-text"
						name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[api_base]"
						value="<?php echo esc_attr( $opts['api_base'] ); ?>" />
					<p class="description"><?php esc_html_e( 'Implicit: https://api.wheel-size.com/v2', 'pimpit-car-selector' ); ?></p>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Mapare atribute WooCommerce', 'pimpit-car-selector' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'Slug-ul atributului din WooCommerce (Products → Attributes). Toleranțele sunt aplicate pe match.', 'pimpit-car-selector' ); ?>
		</p>
		<table class="form-table">
			<?php
			$attr_fields = array(
				'attr_pcd'      => __( 'Atribut PCD (bolt pattern)', 'pimpit-car-selector' ),
				'attr_diameter' => __( 'Atribut diametru jantă', 'pimpit-car-selector' ),
				'attr_width'    => __( 'Atribut lățime jantă', 'pimpit-car-selector' ),
				'attr_et'       => __( 'Atribut ET (offset)', 'pimpit-car-selector' ),
				'attr_cb'       => __( 'Atribut CB (centre bore)', 'pimpit-car-selector' ),
			);
			foreach ( $attr_fields as $key => $label ) :
				?>
				<tr>
					<th><label for="pimpit_cs_<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
					<td>
						<input id="pimpit_cs_<?php echo esc_attr( $key ); ?>" type="text" class="regular-text"
							name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[<?php echo esc_attr( $key ); ?>]"
							value="<?php echo esc_attr( $opts[ $key ] ); ?>" />
					</td>
				</tr>
			<?php endforeach; ?>
			<tr>
				<th><?php esc_html_e( 'Toleranțe', 'pimpit-car-selector' ); ?></th>
				<td>
					<label>
						ET ±
						<input type="number" min="0" step="1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[et_tolerance]"
							value="<?php echo esc_attr( $opts['et_tolerance'] ); ?>" style="width:80px" /> mm
					</label>
					&nbsp;&nbsp;
					<label>
						Lățime ±
						<input type="number" min="0" step="0.5" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[width_tolerance]"
							value="<?php echo esc_attr( $opts['width_tolerance'] ); ?>" style="width:80px" /> J
					</label>
					&nbsp;&nbsp;
					<label>
						CB ±
						<input type="number" min="0" step="0.1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[cb_tolerance]"
							value="<?php echo esc_attr( $opts['cb_tolerance'] ); ?>" style="width:80px" /> mm
					</label>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Categorii active', 'pimpit-car-selector' ); ?></h2>
		<table class="form-table">
			<tr>
				<th><?php esc_html_e( 'Tipuri de produse recomandate', 'pimpit-car-selector' ); ?></th>
				<td>
					<?php foreach ( $matchers as $slug => $matcher ) : ?>
						<label style="display:block; margin-bottom:4px;">
							<input type="checkbox"
								name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[enabled_matchers][]"
								value="<?php echo esc_attr( $slug ); ?>"
								<?php checked( in_array( $slug, (array) $opts['enabled_matchers'], true ) ); ?>
								<?php disabled( ! $matcher->is_available() ); ?> />
							<?php echo esc_html( $matcher->label() ); ?>
							<?php if ( ! $matcher->is_available() ) : ?>
								<em style="color:#999"> (<?php esc_html_e( 'indisponibil — necesită WooCommerce / configurare suplimentară', 'pimpit-car-selector' ); ?>)</em>
							<?php endif; ?>
						</label>
					<?php endforeach; ?>
				</td>
			</tr>
			<tr>
				<th><label for="pimpit_cs_product_category"><?php esc_html_e( 'Limită categorie produse (slug sau ID)', 'pimpit-car-selector' ); ?></label></th>
				<td>
					<input id="pimpit_cs_product_category" type="text" class="regular-text"
						name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[product_category]"
						value="<?php echo esc_attr( $opts['product_category'] ); ?>" />
					<p class="description"><?php esc_html_e( 'Opțional: restricționează căutarea la o categorie WooCommerce.', 'pimpit-car-selector' ); ?></p>
				</td>
			</tr>
			<tr>
				<th><label for="pimpit_cs_results_limit"><?php esc_html_e( 'Limită rezultate', 'pimpit-car-selector' ); ?></label></th>
				<td>
					<input id="pimpit_cs_results_limit" type="number" min="1" max="200" step="1"
						name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[results_limit]"
						value="<?php echo esc_attr( $opts['results_limit'] ); ?>" />
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Cache', 'pimpit-car-selector' ); ?></h2>
		<p class="description"><?php esc_html_e( 'Reduce numărul de apeluri către wheel-size.com. 0 = fără cache.', 'pimpit-car-selector' ); ?></p>
		<table class="form-table">
			<tr>
				<th><?php esc_html_e( 'TTL cache', 'pimpit-car-selector' ); ?></th>
				<td>
					<label><?php esc_html_e( 'Mărci', 'pimpit-car-selector' ); ?>:
						<input type="number" min="0" step="1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[cache_makes_days]"
							value="<?php echo esc_attr( $opts['cache_makes_days'] ); ?>" style="width:60px" /> zile
					</label>
					&nbsp;
					<label><?php esc_html_e( 'Modele', 'pimpit-car-selector' ); ?>:
						<input type="number" min="0" step="1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[cache_models_days]"
							value="<?php echo esc_attr( $opts['cache_models_days'] ); ?>" style="width:60px" /> zile
					</label>
					&nbsp;
					<label><?php esc_html_e( 'Motorizări', 'pimpit-car-selector' ); ?>:
						<input type="number" min="0" step="1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[cache_mods_days]"
							value="<?php echo esc_attr( $opts['cache_mods_days'] ); ?>" style="width:60px" /> zile
					</label>
					&nbsp;
					<label><?php esc_html_e( 'Specs', 'pimpit-car-selector' ); ?>:
						<input type="number" min="0" step="1" name="<?php echo esc_attr( PIMPIT_CS_OPTION_KEY ); ?>[cache_specs_hours]"
							value="<?php echo esc_attr( $opts['cache_specs_hours'] ); ?>" style="width:60px" /> ore
					</label>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Cum folosesc?', 'pimpit-car-selector' ); ?></h2>
		<p>
			<?php esc_html_e( 'Inserează shortcode-ul pe orice pagină:', 'pimpit-car-selector' ); ?>
			<code>[pimpit_car_selector]</code>
		</p>

		<?php submit_button(); ?>
	</form>
</div>
