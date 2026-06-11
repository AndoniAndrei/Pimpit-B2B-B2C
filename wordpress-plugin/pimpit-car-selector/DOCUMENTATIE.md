# Pimpit Car Selector — Documentație completă

**Versiune:** 0.1.0
**Tip:** Plugin WordPress (necesită WooCommerce pentru match-ul de produse)
**Locație în repo:** `wordpress-plugin/pimpit-car-selector/`
**API extern:** [wheel-size.com](https://api.wheel-size.com/v2/) (REST, JSON)

---

## 1. Ce face pluginul

Pluginul adaugă pe site un **selector de mașină** (marcă → an → model → motorizare).
După ce clientul își selectează mașina, pluginul:

1. Interoghează API-ul wheel-size.com pentru specificațiile de fitment ale mașinii:
   - **PCD** (bolt pattern, ex. `5x112`)
   - **Diametru jantă** (ex. 17, 18, 19)
   - **Lățime jantă** (ex. 7J, 7.5J, 8J)
   - **ET** (offset, ex. 35–50)
   - **CB** (centre bore, ex. 66.6)
2. Caută în WooCommerce toate produsele ale căror atribute se potrivesc cu aceste specificații (cu toleranțe configurabile).
3. Afișează clientului grila de produse compatibile, cu poză, preț și link spre pagina produsului.

**MVP:** doar jante. Arhitectura e pregătită pentru anvelope și accesorii (vezi secțiunea 8).

---

## 2. Instalare

1. Descarcă folderul `pimpit-car-selector/` din repo.
2. Creează un ZIP astfel încât **rădăcina arhivei să conțină direct `pimpit-car-selector.php`** (nu un folder intermediar dublu).
3. WP admin → **Plugins → Add New → Upload Plugin** → alege ZIP-ul → **Install Now** → **Activate**.
4. Mergi la **Settings → Pimpit Car Selector** și configurează (vezi secțiunea 3).
5. Inserează shortcode-ul pe orice pagină:

```
[pimpit_car_selector]
```

Opțional, cu titlu personalizat:

```
[pimpit_car_selector title="Alege-ți mașina"]
```

### Cerințe

| Cerință | Minim |
|---|---|
| WordPress | 6.0 |
| PHP | 7.4 |
| WooCommerce | activ (altfel matcher-ul de jante e indisponibil) |
| Cheie API wheel-size.com | obligatorie — se obține de pe [wheel-size.com](https://wheel-size.com) (cont developer) |

---

## 3. Configurare (Settings → Pimpit Car Selector)

### 3.1 API

| Câmp | Descriere | Default |
|---|---|---|
| **API key** | Cheia ta wheel-size.com. Se trimite ca parametru `user_key` în query string. Nu e hardcodată nicăieri în cod. | gol |
| **API base URL** | Rădăcina API-ului. Schimbi doar dacă wheel-size publică o versiune nouă. | `https://api.wheel-size.com/v2` |

### 3.2 Mapare atribute WooCommerce

Pluginul face match pe **atribute globale WooCommerce** (Products → Attributes). Introduci slug-ul fiecărui atribut, exact cum apare în WooCommerce (cu prefixul `pa_`):

| Setare | Default | Exemplu de valori în termeni |
|---|---|---|
| Atribut PCD | `pa_pcd` | `5x112`, `5x120`, `4x100` |
| Atribut diametru | `pa_diametru` | `17`, `18`, `19` |
| Atribut lățime | `pa_latime` | `7`, `7.5`, `8` |
| Atribut ET | `pa_et` | `35`, `40`, `45` |
| Atribut CB | `pa_cb` | `66.6`, `57.1` |

> **Important — formatul termenilor:** match-ul se face pe **numele termenului** (`field => name` în tax_query). Termenii din WooCommerce trebuie să fie în format numeric simplu: diametru `17` (nu `R17`), lățime `7.5` (nu `7.5J`), PCD `5x112` (litere mici, fără spații). Dacă produsele tale folosesc alt format, fie redenumești termenii, fie folosești filtrul `pimpit_cs_wheel_query_args` (secțiunea 7) pentru a transforma valorile.

### 3.3 Toleranțe

| Toleranță | Default | Efect |
|---|---|---|
| **ET ± mm** | 5 | Acceptă jante cu offset în intervalul `[ET_min − tol, ET_max + tol]` față de fitment-ul OEM |
| **Lățime ± J** | 0.5 | Acceptă lățimi cu ±0.5J față de lățimile OEM (pași de 0.5) |
| **CB ± mm** | 0.5 | Acceptă centre bore cu ±0.5mm (pași de 0.1) — util pentru jante cu inele de centrare |

Setarea `0` = match strict, doar valorile exacte din fitment-ul OEM.

### 3.4 Categorii active

- **Tipuri de produse recomandate** — checkbox per matcher. În v0.1 doar **Jante** e disponibil; **Anvelope** apare disabled (stub pentru viitor).
- **Limită categorie** — opțional, restricționează căutarea la o categorie WooCommerce (slug sau ID). Util dacă ai și produse non-jante cu atribute similare.
- **Limită rezultate** — câte produse se afișează per secțiune (default 24, max 200).

### 3.5 Cache

Toate apelurile spre wheel-size.com se cache-uiesc în **WP transients** ca să nu epuizezi cota API:

| Date | TTL default | Rațiune |
|---|---|---|
| Mărci | 30 zile | Lista de mărci e practic statică |
| Modele / Ani | 7 zile | Se schimbă rar |
| Motorizări | 1 zi | |
| Specs fitment | 24 ore | |

`0` = dezactivează cache-ul pentru acel tip. Cache-ul se golește automat la **dezactivarea pluginului**.

---

## 4. Fluxul utilizatorului (frontend)

```
┌─────────────────────────────────────────────────┐
│  Găsește produse pentru mașina ta               │
│                                                 │
│  [Marcă ▾]  [An ▾]  [Model ▾]  [Motorizare ▾]   │
│                                                 │
│  [ Vezi produse compatibile ]                   │
└─────────────────────────────────────────────────┘
```

1. La încărcarea paginii, JS-ul cere lista de mărci (AJAX → cache → API).
2. Fiecare selecție deblochează următorul dropdown; schimbarea unui nivel resetează nivelurile de sub el.
3. Butonul de submit se activează doar când toate 4 sunt selectate.
4. La submit, serverul ia specs-urile mașinii, rulează matcher-ele active și returnează HTML gata randat.
5. Rezultatele apar sub formular: secțiune per matcher (deocamdată doar „Jante"), cu numărul de produse găsite și grila de carduri.

Dacă nu există produse compatibile, se afișează mesajul „Nu am găsit produse compatibile cu mașina ta."

---

## 5. Arhitectură și structura fișierelor

```
pimpit-car-selector/
├── pimpit-car-selector.php        # Header plugin + constante + require-uri + hooks de activare
├── uninstall.php                  # Cleanup la ștergere (opțiuni + transients)
├── readme.txt                     # Readme standard WordPress.org
├── README.md                      # Readme pentru dezvoltatori (GitHub)
├── includes/
│   ├── class-plugin.php           # Bootstrap singleton; instanțiază totul
│   ├── class-settings.php         # Pagina de setări + accessor opțiuni (get/all/sanitize)
│   ├── class-wheelsize-api.php    # Client HTTP wheel-size + cache transients
│   ├── class-shortcode.php        # [pimpit_car_selector] + enqueue CSS/JS + wp_localize
│   ├── class-ajax.php             # 5 endpoint-uri AJAX (makes/years/models/modifications/match)
│   ├── class-matcher-registry.php # Registru pluggable de matchere
│   └── matchers/
│       ├── interface-matcher.php       # Contract: label(), query(), is_available()
│       ├── class-wheel-matcher.php     # Jante — extracție fitment + WP_Query pe atribute
│       └── class-tire-matcher.php      # Anvelope — stub, is_available() = false
├── assets/
│   ├── css/frontend.css           # Stiluri selector + grilă rezultate (BEM, prefix .pimpit-cs)
│   └── js/frontend.js             # Vanilla JS: cascade, fetch, render (fără jQuery)
├── templates/
│   ├── selector-form.php          # Markup formular
│   ├── results.php                # Grila de produse per secțiune
│   └── settings-page.php          # Pagina de admin
└── languages/                     # .pot/.po pentru traduceri (text domain: pimpit-car-selector)
```

### Clase și responsabilități

| Clasă | Rol |
|---|---|
| `Pimpit_CS_Plugin` | Singleton; încarcă text domain, instanțiază settings/API/registry, înregistrează matchere, pornește shortcode + AJAX. Hook-uri de activare (default options) și dezactivare (golire cache). |
| `Pimpit_CS_Settings` | `defaults()`, `get($key)`, `all()`, sanitizare, randare pagină admin via Settings API (`register_setting` pe grupul `pimpit_cs_group`, opțiunea `pimpit_cs_settings`). |
| `Pimpit_CS_WheelSize_API` | `get_makes()`, `get_years()`, `get_models()`, `get_modifications()`, `get_specs()`. Fiecare trece prin `cached()` → transient `pimpit_cs_<md5>` → `request()` cu `wp_remote_get`, timeout 15s. Normalizează paginarea `{results: [...]}` în `{data: [...]}`. Erorile devin `{error: "...", data: []}`. |
| `Pimpit_CS_Matcher_Registry` | `register(slug, matcher)`, `get(slug)`, `all()`, `enabled(slugs)`. |
| `Pimpit_CS_Wheel_Matcher` | `extract_fitment()` — parsează payload-ul `search/by_model` (blocurile `wheels[].front/rear`: `bolt_pattern`, `rim_diameter`, `rim_width`, `rim_offset`, `centre_bore`). `query()` — construiește `tax_query AND` pe cele 5 atribute, aplică toleranțele, restricția de categorie și limita. **Guard:** dacă API-ul nu returnează PCD și nici diametre, returnează rezultat gol (nu toate produsele). |
| `Pimpit_CS_Tire_Matcher` | Stub. `is_available()` → `false`; `query()` → rezultat gol. |
| `Pimpit_CS_Shortcode` | Înregistrează shortcode-ul și asset-urile; expune `PimpitCS` (ajax_url, nonce, stringuri i18n) către JS. |
| `Pimpit_CS_Ajax` | Endpoint-uri `wp_ajax_*` + `wp_ajax_nopriv_*` (formularul e public). Toate verifică nonce-ul `pimpit_cs_nonce`. `match()` rulează matcher-ele active și randează `templates/results.php` per secțiune. |

---

## 6. Endpoint-uri

### 6.1 API extern (wheel-size.com)

| Endpoint | Folosit pentru | Cache |
|---|---|---|
| `GET /makes/` | Dropdown mărci | 30 zile |
| `GET /years/?make=` | Dropdown ani | 7 zile |
| `GET /models/?make=&year=` | Dropdown modele | 7 zile |
| `GET /modifications/?make=&year=&model=` | Dropdown motorizări | 1 zi |
| `GET /search/by_model/?make=&year=&model=&modification=` | Specs fitment pentru match | 24 ore |

Autentificare: `user_key=<API key>` în query string, pe fiecare request.

### 6.2 AJAX intern (admin-ajax.php)

Toate `POST`, cu `action` + `nonce` obligatorii:

| Action | Parametri | Răspuns |
|---|---|---|
| `pimpit_cs_makes` | — | `[{value, label}]` |
| `pimpit_cs_years` | `make` | `[{value, label}]` |
| `pimpit_cs_models` | `make, year` | `[{value, label}]` |
| `pimpit_cs_modifications` | `make, year, model` | `[{value, label}]` |
| `pimpit_cs_match` | `make, year, model, modification` | `{sections: [{slug, label, html, count}], vehicle: {...}}` |

Erori: `{success: false, data: {message}}` cu status HTTP 400 (câmpuri lipsă), 403 (nonce invalid), 502 (eroare API upstream).

---

## 7. Extensibilitate pentru dezvoltatori

### Filtrul `pimpit_cs_wheel_query_args`

Modifică query-ul de produse înainte de execuție:

```php
add_filter( 'pimpit_cs_wheel_query_args', function ( $args, $fitment, $specs ) {
    // ex: sortează după preț crescător
    $args['meta_key'] = '_price';
    $args['orderby']  = 'meta_value_num';
    $args['order']    = 'ASC';
    return $args;
}, 10, 3 );
```

`$fitment` conține: `pcds[]`, `diameters[]`, `widths[]`, `et_min`, `et_max`, `cbs[]`.

### Adăugarea unui matcher nou (ex. anvelope)

1. Implementează `Pimpit_CS_Matcher_Interface` (3 metode: `label()`, `query()`, `is_available()`).
2. Pentru anvelope: extrage dimensiunile din blocul `tires` al payload-ului `search/by_model` și interoghează atributele relevante (lățime secțiune / profil / diametru).
3. Stub-ul există deja în `matchers/class-tire-matcher.php` — completezi `query()` și schimbi `is_available()` în `true` (sau condiționat de existența atributelor).
4. Matcher-ul e deja înregistrat în `class-plugin.php`; adminul îl activează din Settings → Categorii active.

Matchere complet noi se înregistrează cu:

```php
Pimpit_CS_Plugin::instance()->matchers->register( 'accesorii', new My_Accessory_Matcher( $settings ) );
```

---

## 8. Securitate

- **Nonce** pe toate endpoint-urile AJAX (`pimpit_cs_nonce`).
- **Sanitizare** pe toate input-urile (`sanitize_text_field`, `sanitize_key`, cast la int/float).
- **Escaping** pe tot output-ul din template-uri (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post` pentru prețul WooCommerce).
- Cheia API e stocată în `wp_options`, afișată ca `type="password"` în admin, trimisă doar server-side — **nu ajunge niciodată în frontend/JS**.
- `defined('ABSPATH') || exit` în toate fișierele PHP.
- `uninstall.php` curăță opțiunile și transient-ele la ștergerea pluginului; produsele WooCommerce nu sunt atinse.

---

## 9. Depanare (troubleshooting)

| Simptom | Cauză probabilă | Soluție |
|---|---|---|
| Dropdown-ul de mărci rămâne „Se încarcă…" | Cheie API lipsă/invalidă | Verifică Settings → API key. Mesajul de eroare exact apare sub formular. |
| „wheel-size.com returned HTTP 401/403" | Cheie invalidă sau cotă epuizată | Verifică contul wheel-size.com |
| Match-ul găsește 0 produse, deși ai produse potrivite | Formatul termenilor diferă (ex. `R17` vs `17`) sau slug-uri de atribute greșite | Verifică formatul termenilor (secțiunea 3.2) și slug-urile exacte din Products → Attributes |
| Match-ul găsește produse care nu se potrivesc | Atribut nemapat (taxonomie inexistentă e ignorată silențios) | Asigură-te că toate cele 5 slug-uri există ca atribute globale |
| Rezultate învechite după schimbarea datelor | Cache transient activ | Dezactivează + reactivează pluginul (golește tot cache-ul) sau setează TTL 0 temporar |
| „Sesiune expirată" la submit | Pagină cache-uită agresiv cu nonce vechi (>24h) | Exclude pagina cu selectorul din page cache, sau acceptă refresh |

---

## 10. Limitări cunoscute (v0.1)

1. **Formatul termenilor e rigid** — match pe nume exact de termen; nu există normalizare automată `R17`→`17` sau `7.5J`→`7.5`. Workaround: filtrul din secțiunea 7.
2. **Fără paginare în rezultate** — se afișează maxim `Limită rezultate` produse per secțiune.
3. **Endpoint-urile v2 presupuse, nu verificate live** — formele exacte ale payload-urilor (`/years/`, structura `wheels[].front`) urmează documentația publică wheel-size; la primul test cu cheia reală, eventualele diferențe se ajustează în `class-wheelsize-api.php` și `extract_fitment()`.
4. **Anvelope/accesorii** — doar stub.
5. **Fără bloc Gutenberg / widget** — doar shortcode (în roadmap).

---

## 11. Istoricul versiunilor

| Versiune | Data | Modificări |
|---|---|---|
| 0.1.0 | 2026-06-11 | Release inițial: matcher jante, shortcode, cascade AJAX, settings page, cache transients, registru de matchere extensibil |
