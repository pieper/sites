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
    this.application = application;
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
  constructor(application, options) {
    super();
    this.container.add(new stepFileMenu(application,options).container);
    this.container.add(new stepDatabaseMenu(application,options).container);
  }
}

class MenuPanel extends UIItem {
  constructor(application, options) {
    super();
    this.container = new UI.Panel();
    this.container.setClass( 'menu' );
    // title
    let title = new UI.Panel();
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
  constructor(application,options) {
    super(application, {title: 'File'});
    let option;

    // demos
    let demos = [
      { name: "Prostate Example",
        seriesKey: '[["UnspecifiedInstitution","QIN-PROSTATE-01-0002"],["MS2197/BD/PRO   Pelvis w&w/o","1.3.6.1.4.1.14519.5.2.1.3671.7001.267069126134560539593081476574"],["MR","AX FRFSE-XL T2","1.3.6.1.4.1.14519.5.2.1.3671.7001.311804128593572138452599822764"]]',
      },
      { name: "Head and Neck Example",
        seriesKey: '[["UnspecifiedInstitution","QIN-HEADNECK-01-0003"],["Thorax^1HEAD_NECK_PETCT","1.3.6.1.4.1.14519.5.2.1.2744.7002.150059977302243314164020079415"],["CT","CT WB 5.0 B40s_CHEST","1.3.6.1.4.1.14519.5.2.1.2744.7002.248974378224961074547541151175"]]',
      },
    ];

    demos.forEach(demo => {
      option = new UI.Row();
      option.setClass( 'option' );
      option.setTextContent( demo.name );
      option.onClick( function () {
        options.database.seriesOperation({
          database: options.database,
          key: JSON.parse(demo.seriesKey),
          operation: options.requestSeries
        });
      });
      this.menuPanel.add( option );
    });

    // File -> New
    option = new UI.Row();
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
    let fileInput = document.createElement( 'input' );
    fileInput.type = 'file';
    fileInput.addEventListener( 'change', function ( event ) {

      //editor.loader.loadFile( fileInput.files[ 0 ] );

    } );
    option = new UI.Row();
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

class stepDatabaseMenu extends MenuPanel {
  constructor(application, options) {
    options = options || {};
    options.requestSeries = options.requestSeries || function(){};
    super(application, {title: 'Database'});
    this.menuPanel.setClass('database');

    let studyTableUI = new UI.Table();
    studyTableUI.setId('studyTable');
    this.menuPanel.add( studyTableUI );

    let seriesTableUI = new UI.Table();
    seriesTableUI.setId('seriesTable');
    this.menuPanel.add( seriesTableUI );

    let seriesTable = null;
    let instanceTable = null;

    //
    // get and display series render images
    //
    options.database.chronicle.query("instances/context", {
      reduce : true,
      group_level : 2,
      stale : 'update_after',
    }).then(function(data) {
      let studyList = [];
      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex += 1) {
        let row = data.rows[rowIndex].key;
        let studyEntry = [];
        studyEntry.push(row);
        studyEntry.push(row[0][0]);
        studyEntry.push(row[0][1]);
        studyEntry.push(row[1][0]);
        studyEntry.push(data.rows[rowIndex].value);
        studyList.push(studyEntry);
      };

      let studyTable = $('#studyTable').DataTable({
        data : studyList,
        columns : [
          { title: "studyKey" }, // hidden, used for drill down
          { title: "Institution" },
          { title: "Subject" },
          { title: "Description" },
          { title: "Instance Count" },
        ],
        scrollY : "350px",
        scrollCollapse : true,
        paging : true,
        rowID : "StudyUID",
        initComplete : function () {
          let api = this.api();
          api.column(0).visible( false );
          api.$('tr').click( function () {
            let row = api.row(this)[0][0];
            let studyKey = studyTable.data()[row][0];
            showStudy(studyKey);
          });
        },
      });
    }).catch(function (err) {
      console.error(err);
    });

    function showStudy(key) {
      let endKey = key.slice(0);
      endKey.push({});
      options.database.chronicle.query("instances/context", {
        start_key : key,
        end_key : endKey,
        reduce : true,
        group_level : 3,
        stale : 'update_after',
      }).then(function(data) {
        let seriesList = [];
        for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex += 1) {
          let row = data.rows[rowIndex].key;
          let seriesEntry = [];
          seriesEntry.push(row);
          seriesEntry.push(row[2][0]);
          seriesEntry.push(row[2][1]);
          seriesEntry.push(data.rows[rowIndex].value);
          seriesList.push(seriesEntry);
        };

        if (seriesTable) {
          seriesTable.destroy();
        }

        seriesTable = $('#seriesTable').DataTable({
          data : seriesList,
          columns : [
            { title: "seriesKey" }, // hidden, used for drill down
            { title: "Modality" },
            { title: "Description" },
            { title: "Instance Count" },
          ],
          scrollY : "350px",
          scrollCollapse : true,
          paging : false,
          rowID : "StudyUID",
          initComplete : function () {
            let api = this.api();
            api.column(0).visible( false );
            api.$('tr').click( function () {
              let row = api.row(this)[0][0];
              let seriesKey = seriesTable.data()[row][0];
              showSeries(seriesKey);
            });
          },
        });
      }).catch(function (err) {
        console.error(err);
      });
    };

    function showSeries(key) {
      console.log('series', JSON.stringify(key));
      options.database.seriesOperation({
        database: options.database,
        key: key,
        operation: options.requestSeries
      });
    };
  }
}

class stepBottomBar extends UIItem {
  constructor(step, options) {
    options = options || {};
    super(step);
    this.container = new UI.Panel();
    this.container.setId('bottomBar');

    // offset number
    this.sliceOffsetUI = new UI.Number();
    this.sliceOffsetUI.value = .5;
    this.sliceOffsetUI.min = 0;
    this.sliceOffsetUI.max = 1;
    this.sliceOffsetUI.precision = 2;
    this.sliceOffsetUI.step = .25;
    this.sliceOffsetUI.unit = "offset";

    if (options.onSliceOffetChange) {
      this.sliceOffsetUI.onChange(options.onSliceOffetChange);
    }

    this.container.add( this.sliceOffsetUI );

    // tool select
    this.toolText = new UI.Text('Tool:').setWidth('50px');
    this.toolText.dom.style.textAlign = 'right';
    this.container.add(this.toolText);
    this.toolSelectUI = new UI.Select().setOptions({
      windowLevel: "Window/Level",
      trackball: "Trackball",
      paint: "Paint",
    }).setValue('windowLevel');
    this.container.add( this.toolSelectUI );

    // color select
    this.colorText = new UI.Text('Color:').setWidth('50px');
    this.colorText.dom.style.textAlign = 'right';
    this.container.add(this.colorText);
    this.colorSelectUI = new UI.Select().setOptions({
      black: "Black",
      red: "Red",
      green: "Green",
      blue: "Blue",
      white: "White",
    }).setValue('red');
    this.container.add( this.colorSelectUI );
  }

  get sliceOffset() {
    return this.sliceOffsetUI.getValue();
  }
  set sliceOffset(value) {
    this.sliceOffsetUI.setValue(value);
  }
}
