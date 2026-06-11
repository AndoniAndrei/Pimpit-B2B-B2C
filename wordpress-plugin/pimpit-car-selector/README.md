# Pimpit Car Selector — WordPress plugin

Vehicle-based product recommender for WooCommerce, powered by the
[wheel-size.com](https://wheel-size.com) REST API.

Shoppers pick make / year / model / engine (motorizare) in cascading
dropdowns; the plugin reads the OEM and plus-size fitments for that
vehicle and queries WooCommerce for products whose attributes match
(PCD, rim diameter, width, ET, CB).

This folder lives inside the `Pimpit-B2B-B2C` monorepo for convenience
during development, but the plugin is fully self-contained — when ready
to publish, copy `pimpit-car-selector/` into its own repo or zip it for
upload via WP admin.

## Quick start (WordPress install)

1. Zip the contents of `pimpit-car-selector/` so the zip root contains
   `pimpit-car-selector.php`.
2. WP admin → Plugins → Add New → Upload Plugin → choose the zip.
3. Activate.
4. Settings → Pimpit Car Selector — paste the wheel-size.com API key,
   verify the WooCommerce attribute slugs (defaults assume `pa_pcd`,
   `pa_diametru`, `pa_latime`, `pa_et`, `pa_cb`).
5. Add `[pimpit_car_selector]` shortcode to any page.

## File layout

```
pimpit-car-selector/
├── pimpit-car-selector.php        # Plugin header + requires
├── uninstall.php                  # Cleanup on plugin delete
├── readme.txt                     # WP plugin readme
├── includes/
│   ├── class-plugin.php           # Bootstrap
│   ├── class-settings.php         # Admin settings + accessor
│   ├── class-wheelsize-api.php    # API client + transient cache
│   ├── class-shortcode.php        # [pimpit_car_selector]
│   ├── class-ajax.php             # Cascade endpoints + match
│   ├── class-matcher-registry.php # Pluggable matcher registry
│   └── matchers/
│       ├── interface-matcher.php
│       ├── class-wheel-matcher.php   # Jante (MVP)
│       └── class-tire-matcher.php    # Stub — flesh out when selling tires
├── assets/
│   ├── css/frontend.css
│   └── js/frontend.js             # Cascade + fetch
└── templates/
    ├── selector-form.php
    ├── results.php
    └── settings-page.php
```

## Adding a new matcher (e.g. anvelope)

1. Create `includes/matchers/class-tire-matcher.php` (already stubbed) —
   implement `query()` by extracting the tire dimensions from the
   wheel-size specs payload and running a `WP_Query` on the relevant
   WooCommerce attributes.
2. Return `true` from `is_available()` once it's ready.
3. The matcher is already registered in `class-plugin.php`; admin can
   enable it from Settings → Categorii active.

## API endpoints touched

* `GET /makes/`
* `GET /years/?make=…`
* `GET /models/?make=…&year=…`
* `GET /modifications/?make=…&year=…&model=…`
* `GET /search/by_model/?make=…&year=…&model=…&modification=…`

All cached via WP transients with TTLs configurable in settings.
