/* global PimpitCS */
( function () {
	'use strict';

	if ( typeof PimpitCS === 'undefined' ) {
		return;
	}

	document.querySelectorAll( '[data-pimpit-cs]' ).forEach( initWidget );

	function initWidget( root ) {
		const form    = root.querySelector( '[data-pimpit-cs-form]' );
		const status  = root.querySelector( '[data-pimpit-cs-status]' );
		const results = root.querySelector( '[data-pimpit-cs-results]' );
		const submit  = form.querySelector( '.pimpit-cs__submit' );

		const fields = {
			make:         form.querySelector( '[data-pimpit-cs-field="make"]' ),
			year:         form.querySelector( '[data-pimpit-cs-field="year"]' ),
			model:        form.querySelector( '[data-pimpit-cs-field="model"]' ),
			modification: form.querySelector( '[data-pimpit-cs-field="modification"]' ),
		};

		loadChoices( 'makes', {}, fields.make, PimpitCS.i18n.select_make );

		fields.make.addEventListener( 'change', function () {
			reset( [ 'year', 'model', 'modification' ] );
			if ( ! fields.make.value ) {
				return;
			}
			loadChoices( 'years', { make: fields.make.value }, fields.year, PimpitCS.i18n.select_year );
		} );

		fields.year.addEventListener( 'change', function () {
			reset( [ 'model', 'modification' ] );
			if ( ! fields.year.value ) {
				return;
			}
			loadChoices(
				'models',
				{ make: fields.make.value, year: fields.year.value },
				fields.model,
				PimpitCS.i18n.select_model
			);
		} );

		fields.model.addEventListener( 'change', function () {
			reset( [ 'modification' ] );
			if ( ! fields.model.value ) {
				return;
			}
			loadChoices(
				'modifications',
				{
					make:  fields.make.value,
					year:  fields.year.value,
					model: fields.model.value,
				},
				fields.modification,
				PimpitCS.i18n.select_mod
			);
		} );

		fields.modification.addEventListener( 'change', function () {
			submit.disabled = ! fields.modification.value;
		} );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			runMatch();
		} );

		function reset( keys ) {
			keys.forEach( function ( k ) {
				const sel = fields[ k ];
				sel.innerHTML = '<option value=""></option>';
				sel.disabled  = true;
			} );
			submit.disabled = true;
			results.innerHTML = '';
		}

		function setStatus( msg ) {
			status.textContent = msg || '';
		}

		function loadChoices( action, params, select, placeholder ) {
			setStatus( PimpitCS.i18n.loading );
			select.disabled = true;

			callAjax( action, params )
				.then( function ( data ) {
					select.innerHTML = '';
					const placeholderOpt = document.createElement( 'option' );
					placeholderOpt.value = '';
					placeholderOpt.textContent = placeholder;
					select.appendChild( placeholderOpt );

					data.forEach( function ( choice ) {
						const opt = document.createElement( 'option' );
						opt.value = choice.value;
						opt.textContent = choice.label;
						select.appendChild( opt );
					} );
					select.disabled = data.length === 0;
					setStatus( '' );
				} )
				.catch( function ( err ) {
					setStatus( err.message || PimpitCS.i18n.error );
				} );
		}

		function runMatch() {
			setStatus( PimpitCS.i18n.loading );
			results.innerHTML = '';
			submit.disabled = true;

			callAjax( 'match', {
				make:         fields.make.value,
				year:         fields.year.value,
				model:        fields.model.value,
				modification: fields.modification.value,
			} )
				.then( function ( data ) {
					setStatus( '' );
					submit.disabled = false;
					if ( ! data.sections || data.sections.length === 0 ) {
						results.innerHTML = '<p class="pimpit-cs__empty">' + escapeHtml( PimpitCS.i18n.no_results ) + '</p>';
						return;
					}
					let total = 0;
					data.sections.forEach( function ( s ) {
						total += s.count;
					} );
					if ( total === 0 ) {
						results.innerHTML = '<p class="pimpit-cs__empty">' + escapeHtml( PimpitCS.i18n.no_results ) + '</p>';
						return;
					}
					results.innerHTML = data.sections.map( function ( s ) {
						return s.html;
					} ).join( '' );
				} )
				.catch( function ( err ) {
					setStatus( err.message || PimpitCS.i18n.error );
					submit.disabled = false;
				} );
		}

		function callAjax( action, params ) {
			const body = new URLSearchParams();
			body.append( 'action', 'pimpit_cs_' + action );
			body.append( 'nonce', PimpitCS.nonce );
			Object.keys( params ).forEach( function ( k ) {
				body.append( k, params[ k ] );
			} );

			return fetch( PimpitCS.ajax_url, {
				method:      'POST',
				credentials: 'same-origin',
				headers:     { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body:        body.toString(),
			} ).then( function ( r ) {
				return r.json().then( function ( json ) {
					if ( ! json.success ) {
						const msg = ( json.data && json.data.message ) || PimpitCS.i18n.error;
						throw new Error( msg );
					}
					return json.data;
				} );
			} );
		}

		function escapeHtml( s ) {
			return String( s ).replace( /[&<>"']/g, function ( c ) {
				return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ];
			} );
		}
	}
}() );
