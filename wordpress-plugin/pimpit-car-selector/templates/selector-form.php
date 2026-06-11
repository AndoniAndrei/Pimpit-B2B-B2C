<?php
/**
 * Front-end selector form. Rendered by the [pimpit_car_selector] shortcode.
 *
 * @var array $atts
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="pimpit-cs" data-pimpit-cs>
	<?php if ( ! empty( $atts['title'] ) ) : ?>
		<h3 class="pimpit-cs__title"><?php echo esc_html( $atts['title'] ); ?></h3>
	<?php endif; ?>

	<form class="pimpit-cs__form" data-pimpit-cs-form>
		<div class="pimpit-cs__row">
			<label class="pimpit-cs__field">
				<span><?php esc_html_e( 'Marcă', 'pimpit-car-selector' ); ?></span>
				<select name="make" data-pimpit-cs-field="make" disabled>
					<option value=""><?php esc_html_e( 'Se încarcă…', 'pimpit-car-selector' ); ?></option>
				</select>
			</label>

			<label class="pimpit-cs__field">
				<span><?php esc_html_e( 'An', 'pimpit-car-selector' ); ?></span>
				<select name="year" data-pimpit-cs-field="year" disabled>
					<option value=""><?php esc_html_e( 'Selectează marca întâi', 'pimpit-car-selector' ); ?></option>
				</select>
			</label>

			<label class="pimpit-cs__field">
				<span><?php esc_html_e( 'Model', 'pimpit-car-selector' ); ?></span>
				<select name="model" data-pimpit-cs-field="model" disabled>
					<option value=""><?php esc_html_e( 'Selectează anul întâi', 'pimpit-car-selector' ); ?></option>
				</select>
			</label>

			<label class="pimpit-cs__field">
				<span><?php esc_html_e( 'Motorizare', 'pimpit-car-selector' ); ?></span>
				<select name="modification" data-pimpit-cs-field="modification" disabled>
					<option value=""><?php esc_html_e( 'Selectează modelul întâi', 'pimpit-car-selector' ); ?></option>
				</select>
			</label>
		</div>

		<button type="submit" class="pimpit-cs__submit button" disabled>
			<?php esc_html_e( 'Vezi produse compatibile', 'pimpit-car-selector' ); ?>
		</button>

		<p class="pimpit-cs__status" data-pimpit-cs-status role="status" aria-live="polite"></p>
	</form>

	<div class="pimpit-cs__results" data-pimpit-cs-results></div>
</div>
