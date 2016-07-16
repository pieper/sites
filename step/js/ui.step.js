/**
 * @author pieper
 *
 * derived from three.js/editor/ui from:
 * @author mrdoob / http://mrdoob.com/
 */

var STEP = function () {
  this.applicationName = "STEP";
};

STEP.prototype = {
  // TODO (maybe)
};

var Menubar = function ( application ) {

	var container = new UI.Panel();
	container.setId( 'menubar' );

	container.add( new Menubar.File( application ) );
  /*
	container.add( new Menubar.Edit( application ) );
	container.add( new Menubar.Add( application ) );
	container.add( new Menubar.Play( application ) );
	container.add( new Menubar.View( application ) );
	container.add( new Menubar.Help( application ) );
	container.add( new Menubar.Status( application ) );
  */
	return container;
};

Menubar.File = function ( editor ) {

	var container = new UI.Panel();
	container.setClass( 'menu' );

	var title = new UI.Panel();
	title.setClass( 'title' );
	title.setTextContent( 'File' );
	container.add( title );

	var options = new UI.Panel();
	options.setClass( 'options' );
	container.add( options );

	// New

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'New' );
	option.onClick( function () {

		if ( confirm( 'Any unsaved data will be lost. Are you sure?' ) ) {

			//editor.clear();

		}

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	// Import

	var fileInput = document.createElement( 'input' );
	fileInput.type = 'file';
	fileInput.addEventListener( 'change', function ( event ) {

		//editor.loader.loadFile( fileInput.files[ 0 ] );

	} );

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Import' );
	option.onClick( function () {

		fileInput.click();

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	return container;

};
