<?php
/**
 * Results grid for a single matcher section.
 *
 * @var Pimpit_CS_Matcher_Interface $matcher
 * @var WP_Query $query
 * @package PimpitCarSelector
 */

defined( 'ABSPATH' ) || exit;
?>
<section class="pimpit-cs__section">
	<header class="pimpit-cs__section-head">
		<h4><?php echo esc_html( $matcher->label() ); ?></h4>
		<span class="pimpit-cs__count">
			<?php
			printf(
				/* translators: %d: number of matching products */
				esc_html( _n( '%d produs compatibil', '%d produse compatibile', (int) $query->found_posts, 'pimpit-car-selector' ) ),
				(int) $query->found_posts
			);
			?>
		</span>
	</header>

	<?php if ( $query->have_posts() ) : ?>
		<ul class="pimpit-cs__grid products">
			<?php
			while ( $query->have_posts() ) :
				$query->the_post();
				$product = function_exists( 'wc_get_product' ) ? wc_get_product( get_the_ID() ) : null;
				?>
				<li class="pimpit-cs__card product">
					<a href="<?php the_permalink(); ?>" class="pimpit-cs__card-link">
						<?php if ( has_post_thumbnail() ) : ?>
							<?php the_post_thumbnail( 'woocommerce_thumbnail', array( 'class' => 'pimpit-cs__card-img' ) ); ?>
						<?php endif; ?>
						<h5 class="pimpit-cs__card-title"><?php the_title(); ?></h5>
						<?php if ( $product ) : ?>
							<div class="pimpit-cs__card-price"><?php echo wp_kses_post( $product->get_price_html() ); ?></div>
						<?php endif; ?>
					</a>
				</li>
			<?php endwhile; ?>
		</ul>
	<?php else : ?>
		<p class="pimpit-cs__empty">
			<?php esc_html_e( 'Nu am găsit produse compatibile cu mașina ta în această categorie.', 'pimpit-car-selector' ); ?>
		</p>
	<?php endif; ?>
</section>
