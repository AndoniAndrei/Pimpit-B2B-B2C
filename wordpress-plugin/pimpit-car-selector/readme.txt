=== Pimpit Car Selector ===
Contributors: andoniandrei
Tags: woocommerce, wheels, fitment, vehicle selector, wheel-size
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Vehicle-based product recommender for WooCommerce. Shoppers pick make/model/year/engine, get only the wheels (and later tires/accessories) that fit.

== Description ==

Pimpit Car Selector adds a cascading vehicle selector to any page via the
`[pimpit_car_selector]` shortcode. It uses the [wheel-size.com](https://wheel-size.com)
REST API to look up the original-fitment specs for the chosen vehicle
(bolt pattern, rim diameter, width, offset, centre bore) and queries
WooCommerce for products whose attributes match.

= Features (v0.1) =

* Cascading dropdowns: marcă → an → model → motorizare
* Match logic for wheels (jante) using configurable WooCommerce attribute slugs
* Tolerances per fitment dimension (ET ±mm, lățime ±J, CB ±mm)
* Transient caching for every wheel-size endpoint (configurable TTL)
* Scaffold for additional matchers (anvelope, accesorii) via the matcher registry

= Settings =

Settings → Pimpit Car Selector:

* API key (sent as `user_key` query param)
* API base URL (default `https://api.wheel-size.com/v2`)
* Attribute mapping (PCD, diametru, lățime, ET, CB)
* Tolerance per dimension
* Enabled matchers (only `Jante` ships enabled)
* Optional WooCommerce category restriction
* Cache TTLs

= Roadmap =

* Tire matcher reading tire dimensions from the wheel-size payload
* Accessory matcher with vehicle-keyed lookup tables
* Gutenberg block alternative to the shortcode
* Sidebar widget

== Installation ==

1. Upload the `pimpit-car-selector` folder to `/wp-content/plugins/`.
2. Activate the plugin in WP admin → Plugins.
3. Go to Settings → Pimpit Car Selector and enter your wheel-size.com API key.
4. Map the WooCommerce attribute slugs to your store's actual attribute names.
5. Insert `[pimpit_car_selector]` on any page.

== Changelog ==

= 0.1.0 =
* Initial release: wheel matcher, settings page, AJAX cascade, shortcode.
