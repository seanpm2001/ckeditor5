/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global window, btoa, console */

import { global } from '@ckeditor/ckeditor5-utils';
import { Command } from 'ckeditor5/src/core';
import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph';
import { Heading } from '@ckeditor/ckeditor5-heading';
import { Essentials } from '@ckeditor/ckeditor5-essentials';
import { Image } from '@ckeditor/ckeditor5-image';
import CloudServices from '@ckeditor/ckeditor5-cloud-services/src/cloudservices';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import LinkEditing from '@ckeditor/ckeditor5-link/src/linkediting';
import PictureEditing from '@ckeditor/ckeditor5-image/src/pictureediting';
import ImageUploadEditing from '@ckeditor/ckeditor5-image/src/imageupload/imageuploadediting';
import ImageUploadProgress from '@ckeditor/ckeditor5-image/src/imageupload/imageuploadprogress';
import { setData as setModelData, getData as getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import TokenMock from '@ckeditor/ckeditor5-cloud-services/tests/_utils/tokenmock';
import CloudServicesCoreMock from '../_utils/cloudservicescoremock';
import CKBoxEditing from '../../src/ckboxediting';

import CKBoxImageEditCommand from '../../src/ckboximageedit/ckboximageeditcommand';
import { blurHashToDataUrl } from '../../src/utils';

const CKBOX_API_URL = 'https://upload.example.com';

describe( 'CKBoxImageEditCommand', () => {
	testUtils.createSinonSandbox();

	let editor, domElement, command, model;

	beforeEach( async () => {
		TokenMock.initialToken = [
			// Header.
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
			// Payload.
			btoa( JSON.stringify( { auth: { ckbox: { workspaces: [ 'workspace1' ] } } } ) ),
			// Signature.
			'signature'
		].join( '.' );

		domElement = global.document.createElement( 'div' );
		global.document.body.appendChild( domElement );

		window.CKBox = {
			mountImageEditor: sinon.stub()
		};

		editor = await ClassicTestEditor.create( domElement, {
			plugins: [
				Paragraph,
				Heading,
				Image,
				CloudServices,
				Essentials,
				LinkEditing,
				PictureEditing,
				ImageUploadEditing,
				ImageUploadProgress,
				CKBoxEditing
			],
			ckbox: {
				serviceOrigin: CKBOX_API_URL,
				tokenUrl: 'foo'
			},
			substitutePlugins: [
				CloudServicesCoreMock
			]
		} );

		command = new CKBoxImageEditCommand( editor );
		command.isEnabled = true;
		editor.commands.add( 'ckboxImageEdit', command );
		model = editor.model;
	} );

	afterEach( async () => {
		window.CKBox = null;
		domElement.remove();

		if ( global.document.querySelector( '.ck.ckbox-wrapper' ) ) {
			global.document.querySelector( '.ck.ckbox-wrapper' ).remove();
		}

		await editor.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should be a command instance', () => {
			expect( command ).to.be.instanceOf( Command );
		} );

		it( 'should set "#value" property to false', () => {
			expect( command.value ).to.be.false;
		} );
	} );

	describe( 'execute', () => {
		it( 'should fire "ckboxImageEditor:open" event after command execution', () => {
			const spy = sinon.spy();

			command.on( 'ckboxImageEditor:open', spy );
			command.execute();

			expect( spy.callCount ).to.equal( 1 );
		} );

		it( 'should fire "ckboxImageEditor:open" event as many times as command executions', () => {
			const spy = sinon.spy();

			command.on( 'ckboxImageEditor:open', spy );

			for ( let i = 1; i <= 5; i++ ) {
				command.execute();
			}

			expect( spy.callCount ).to.equal( 1 );
		} );
	} );

	describe( 'events', () => {
		describe( 'opening dialog ("ckboxImageEditor:open")', () => {
			beforeEach( () => {
				sinon.useFakeTimers( { now: Date.now() } );
			} );

			afterEach( () => {
				sinon.restore();
			} );

			it( 'should create a wrapper if it is not yet created and mount it in the document body', () => {
				command.execute();

				const wrapper = command._wrapper;

				expect( wrapper.nodeName ).to.equal( 'DIV' );
				expect( wrapper.className ).to.equal( 'ck ckbox-wrapper' );
			} );

			it( 'should create and mount a wrapper only once', () => {
				command.execute();

				const wrapper1 = command._wrapper;

				command.execute();

				const wrapper2 = command._wrapper;

				command.execute();

				const wrapper3 = command._wrapper;

				expect( wrapper1 ).to.equal( wrapper2 );
				expect( wrapper2 ).to.equal( wrapper3 );
			} );

			it( 'should not create a wrapper if the command is disabled', () => {
				command.isEnabled = false;
				command.execute();

				expect( command._wrapper ).to.equal( null );
			} );

			it( 'should not create a wrapper if the wrapper is already created', () => {
				const wrapper = global.document.createElement( 'p' );

				command._wrapper = wrapper;
				command.execute();

				expect( command._wrapper ).to.equal( wrapper );
			} );

			it( 'should open the CKBox Image Editor dialog instance only once', () => {
				command.execute();
				command.execute();
				command.execute();

				expect( window.CKBox.mountImageEditor.callCount ).to.equal( 1 );
			} );
		} );

		describe( 'closing dialog ("ckboxImageEditor:close")', () => {
			let onClose;

			beforeEach( () => {
				onClose = command._prepareOptions().onClose;
			} );

			it( 'should fire "ckboxImageEditor:close" event after closing the CKBox Image Editor dialog', () => {
				const spy = sinon.spy();

				command.on( 'ckboxImageEditor:close', spy );
				onClose();

				expect( spy.callCount ).to.equal( 1 );
			} );

			it( 'should remove the wrapper after closing the CKBox Image Editor dialog', () => {
				command.execute();

				expect( command._wrapper ).not.to.equal( null );

				const spy = sinon.spy( command._wrapper, 'remove' );

				onClose();

				expect( spy.callCount ).to.equal( 1 );
				expect( command._wrapper ).to.equal( null );
			} );

			it( 'should focus view after closing the CKBox Image Editor dialog', () => {
				const focusSpy = testUtils.sinon.spy( editor.editing.view, 'focus' );

				const openSpy = sinon.spy();
				const closeSpy = sinon.spy();

				command.on( 'ckboxImageEditor:open', openSpy );
				command.execute();

				command.on( 'ckboxImageEditor:close', closeSpy );
				onClose();

				expect( openSpy.callCount ).to.equal( 1 );
				expect( closeSpy.callCount ).to.equal( 1 );

				sinon.assert.calledOnce( focusSpy );
			} );
		} );

		describe( 'saving edited asset', () => {
			let onSave, sinonXHR, jwtToken;

			beforeEach( () => {
				jwtToken = createToken( { auth: { ckbox: { workspaces: [ 'workspace1' ] } } } );
				onSave = command._prepareOptions().onSave;
				sinonXHR = testUtils.sinon.useFakeServer();
				sinonXHR.autoRespond = true;
			} );

			afterEach( () => {
				sinonXHR.restore();
			} );

			it( 'should pool data for edited image and if success status, save it', done => {
				setModelData( model, '[<imageBlock alt="alt text" ckboxImageId="example-id" src="/assets/sample.png"></imageBlock>]' );

				sinonXHR.respondWith( 'GET', CKBOX_API_URL + '/assets/image-id1', [
					200,
					{ 'Content-Type': 'application/json' },
					JSON.stringify( {
						metadata: {
							metadataProcessingStatus: 'success'
						}
					} )
				] );

				const dataMock = {
					data: {
						id: 'image-id1',
						extension: 'png',
						metadata: {
							width: 100,
							height: 100
						},
						name: 'image1',
						imageUrls: {
							100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
							default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
						},
						url: 'https://example.com/workspace1/assets/image-id1/file'
					}
				};

				command.decorate( 'updateImage' );

				editor.listenTo( command, 'updateImage', () => {
					expect( getModelData( model ) ).to.equal(
						'[<imageBlock alt="" ckboxImageId="image-id1" sources="[object Object]"' +
							' src="https://example.com/workspace1/assets/image-id1/images/100.png">' +
						'</imageBlock>]'
					);
					done();
				} );

				onSave( dataMock );
			} );

			it( 'should stop pooling if limit was reached', () => {
				const clock = sinon.useFakeTimers();

				setModelData( model, '[<imageBlock alt="alt text" ckboxImageId="example-id" src="/assets/sample.png"></imageBlock>]' );

				const respondSpy = sinon.spy( sinonXHR, 'respond' );

				sinonXHR.respondWith( 'GET', CKBOX_API_URL + '/assets/image-id1', [
					200,
					{ 'Content-Type': 'application/json' },
					JSON.stringify( {
						metadata: {
							metadataProcessingStatus: 'queued'
						}
					} )
				] );

				const dataMock = {
					data: {
						id: 'image-id1',
						extension: 'png',
						metadata: {
							width: 100,
							height: 100
						},
						name: 'image1',
						imageUrls: {
							100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
							default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
						},
						url: 'https://example.com/workspace1/assets/image-id1/file'
					}
				};

				onSave( dataMock );

				clock.tick( 15000 );

				sinon.assert.callCount( respondSpy, 10 );
			} );

			it( 'should reject if fetching asset\\s status ended with the authorization error', () => {
				sinon.stub( console, 'error' );

				sinonXHR.respondWith( 'GET', CKBOX_API_URL + '/assets/image-id1', [
					401,
					{ 'Content-Type': 'application/json' },
					JSON.stringify( { message: 'Invalid token.', statusCode: 401 } )
				] );

				const dataMock = {
					id: 'image-id1',
					extension: 'png',
					metadata: {
						width: 100,
						height: 100
					},
					name: 'image1',
					imageUrls: {
						100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
						default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
					},
					url: 'https://example.com/workspace1/assets/image-id1/file'
				};

				return command.getAssetStatusFromServer( dataMock )
					.then( res => {
						expect( res.message ).to.equal( 'Invalid token.' );
						throw new Error( 'Expected to be rejected.' );
					}, () => {
						expect( sinonXHR.requests[ 0 ].requestHeaders ).to.be.an( 'object' );
						expect( sinonXHR.requests[ 0 ].requestHeaders ).to.contain.property( 'Authorization', jwtToken );
						expect( sinonXHR.requests[ 0 ].requestHeaders ).to.contain.property( 'CKBox-Version', 'CKEditor 5' );
					} );
			} );

			it( 'should fire "ckboxImageEditor:save" and "ckboxImageEditor:processed" ' +
				'event after hit "Save" button in the CKBox Image Editor dialog', () => {
				const clock = sinon.useFakeTimers();
				const spyBeginProcess = sinon.spy();
				const spyFinishProcess = sinon.spy();

				command.on( 'ckboxImageEditor:save', spyBeginProcess );
				command.on( 'ckboxImageEditor:processed', spyFinishProcess );

				const dataMock = {
					data: {
						id: 'image-id1',
						extension: 'png',
						metadata: {
							width: 100,
							height: 100
						},
						name: 'image1',
						imageUrls: {
							100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
							default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
						},
						url: 'https://example.com/workspace1/assets/image-id1/file'
					}
				};
				onSave( dataMock );

				clock.tick( 4000 );

				expect( spyBeginProcess.callCount ).to.equal( 1 );
				expect( spyFinishProcess.callCount ).to.equal( 1 );
			} );

			it( 'should replace image with saved one', () => {
				const clock = sinon.useFakeTimers();

				setModelData( model, '[<imageBlock alt="alt text" ckboxImageId="example-id" ' +
					' width="50" height="50" src="/assets/sample.png"></imageBlock>]' );

				const dataMock = {
					data: {
						id: 'image-id1',
						extension: 'png',
						metadata: {
							width: 100,
							height: 100
						},
						name: 'image1',
						imageUrls: {
							100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
							default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
						},
						url: 'https://example.com/workspace1/assets/image-id1/file'
					}
				};

				onSave( dataMock );

				clock.tick( 4000 );

				expect( getModelData( model ) ).to.equal(
					'[<imageBlock ' +
						'alt="" ' +
						'ckboxImageId="image-id1" ' +
						'height="100" ' +
						'src="https://example.com/workspace1/assets/image-id1/images/100.png" ' +
						'width="100">' +
					'</imageBlock>]'
				);
			} );

			it( 'should replace image with saved one (with blurHash placeholder)', () => {
				const clock = sinon.useFakeTimers();

				setModelData( model, '[<imageBlock alt="alt text" ckboxImageId="example-id" ' +
					' width="50" height="50" src="/assets/sample.png"></imageBlock>]' );

				const dataMock = {
					data: {
						id: 'image-id1',
						extension: 'png',
						metadata: {
							width: 100,
							height: 100,
							blurHash: 'KTF55N=ZR4PXSirp5ZOZW9'
						},
						name: 'image1',
						imageUrls: {
							100: 'https://example.com/workspace1/assets/image-id1/images/100.webp',
							default: 'https://example.com/workspace1/assets/image-id1/images/100.png'
						},
						url: 'https://example.com/workspace1/assets/image-id1/file'
					}
				};

				const placeholder = blurHashToDataUrl( dataMock.data.metadata.blurHash );

				onSave( dataMock );

				clock.tick( 4000 );

				expect( getModelData( model ) ).to.equal(
					'[<imageBlock ' +
						'alt="" ' +
						'ckboxImageId="image-id1" ' +
						'height="100" ' +
						'placeholder="' + placeholder + '" ' +
						'src="https://example.com/workspace1/assets/image-id1/images/100.png" ' +
						'width="100">' +
					'</imageBlock>]'
				);
			} );
		} );
	} );

	function createToken( tokenClaims ) {
		return [
			// Header.
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
			// Payload.
			btoa( JSON.stringify( tokenClaims ) ),
			// Signature.
			'signature'
		].join( '.' );
	}
} );
