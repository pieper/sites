/**
 * @author pieper
 *
 * derived from three.js/editor/ui from:
 * @author mrdoob / http://mrdoob.com/
 */

class STEP {
  constructor() {
    this.applicationName = "STEP";
  }
}

class UIItem {
  constructor(application) {
  }
  get dom() {
    return this.container.dom;
  }
}

class Menubar extends UIItem {
  constructor() {
    super();
    this.container = new UI.Panel();
    this.container.setId('menubar');
  }
}

class stepMenubar extends Menubar {
  constructor(application) {
    super();
    this.container.add(new stepFileMenu(application).container);
  }
}

class MenuPanel extends UIItem {
  constructor(application, options) {
    super();
    this.container = new UI.Panel();
    this.container.setClass( 'menu' );
    // title
    var title = new UI.Panel();
    title.setClass( 'title' );
    title.setTextContent(options.title);
    this.container.add( title );
    // panel
    this.menuPanel = new UI.Panel();
    this.menuPanel.setClass( 'options' );
    this.container.add( this.menuPanel );
  }
}

class stepFileMenu extends MenuPanel {
  constructor(application) {
    super(application, {title: 'File'});
    // File -> New
    var option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'New' );
    option.onClick( function () {

      if ( confirm( 'Any unsaved data will be lost. Are you sure?' ) ) {

        //editor.clear();

      }

    } );
    this.menuPanel.add( option );
    // spacer
    this.menuPanel.add( new UI.HorizontalRule() );
    // File->Import
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
    this.menuPanel.add( option );
    //
    this.menuPanel.add( new UI.HorizontalRule() );
  }
}
