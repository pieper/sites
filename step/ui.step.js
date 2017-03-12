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
  constructor(step, options) {
    super();
    this.container.add(new stepFileMenu(step,options).container);
    this.container.add(new stepDatabaseMenu(step,options).container);
    this.container.add(new stepOperationMenu(step,options).container);
    this.container.add(new stepViewMenu(step,options).container);
    this.container.add(new stepAboutMenu(step,options).container);
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
  constructor(step,options) {
    super(step, {title: 'File'});

    // demos
    let demos = [
      /*
      { name: "Prostate Example",
        seriesKeys: ['[["UnspecifiedInstitution","QIN-PROSTATE-01-0002"],["MS2197/BD/PRO   Pelvis w&w/o","1.3.6.1.4.1.14519.5.2.1.3671.7001.267069126134560539593081476574"],["MR","AX FRFSE-XL T2","1.3.6.1.4.1.14519.5.2.1.3671.7001.311804128593572138452599822764"]]'],
      },
      */
      { name: "Head and Neck Example",
        seriesKeys: ['[["UnspecifiedInstitution","QIN-HEADNECK-01-0003"],["Thorax^1HEAD_NECK_PETCT","1.3.6.1.4.1.14519.5.2.1.2744.7002.150059977302243314164020079415"],["CT","CT WB 5.0 B40s_CHEST","1.3.6.1.4.1.14519.5.2.1.2744.7002.248974378224961074547541151175"]]'],
      },
      /*
      { name: "QIN 139 Segmentation",
        seriesKeys: [
          '[["UnspecifiedInstitution","QIN-HEADNECK-01-0139"],["CT CHEST W/O CONTRAST","1.3.6.1.4.1.14519.5.2.1.2744.7002.373729467545468642229382466905"],["SEG","tumor segmentation - User3 SemiAuto trial 1","1.2.276.0.7230010.3.1.3.8323329.20009.1440004784.9295"]]',
          '[["UnspecifiedInstitution","QIN-HEADNECK-01-0139"],["CT CHEST W/O CONTRAST","1.3.6.1.4.1.14519.5.2.1.2744.7002.373729467545468642229382466905"],["CT","CT HeadNeck  3.0  B30f_CHEST","1.3.6.1.4.1.14519.5.2.1.2744.7002.182837959725425690842769990419"]]',
        ],
      },
      */
      { name: "MRHead",
        seriesKeys: [
          '[["UnspecifiedInstitution","123456"],["Slicer Sample Data","1.2.826.0.1.3680043.2.1125.1.34027065691713096181869243555208536"],["MR","No series description","1.2.826.0.1.3680043.2.1125.1.60570920072252354871500178658621494"]]',
        ],
      },
    ];

    let option;
    demos.forEach(demo => {
      option = new UI.Row();
      option.setClass( 'option' );
      option.setTextContent( demo.name );
      option.onClick( function () {
        demo.seriesKeys.forEach(seriesKey => {
          options.chronicle.seriesOperation({
            chronicle: options.chronicle,
            key: JSON.parse(seriesKey),
            operation: options.requestSeries
          });
        });
      });
      this.menuPanel.add( option );
    });

    // spacer
    this.menuPanel.add( new UI.HorizontalRule() );
    // File -> Add Fiducials
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Add 3 Random Fiducials' );
    option.onClick( function () {
      options.addRandomFiducials();
    } );
    this.menuPanel.add( option );

    // spacer
    this.menuPanel.add( new UI.HorizontalRule() );
    // File -> Save
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Save' );
    option.onClick( function () {
      options.save();
    } );
    this.menuPanel.add( option );

    // spacer
    this.menuPanel.add( new UI.HorizontalRule() );
    // File -> Clear
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Clear' );
    option.onClick( function () {
      if ( confirm( 'Any unsaved data will be lost. Are you sure?' ) ) {
        step.generator = null;
        step.renderer.inputFields = [];
        step.renderer.updateProgram();
        step.renderer.requestRender(step.view);
      }
    });
    this.menuPanel.add( option );
  }
}

class stepDatabaseMenu extends MenuPanel {
  constructor(step, options) {
    options = options || {};
    options.requestSeries = options.requestSeries || function(){};
    super(step, {title: 'Database'});
    this.menuPanel.setClass('database');

    // status
    let statusEntry = new UI.Row();
    statusEntry.setClass( 'option' );
    let url = options.chronicle.url;
    statusEntry.setTextContent( `Status: Fetching study list from ${url}...` );
    this.menuPanel.add( statusEntry );

    let studyTableUI = new UI.Table();
    studyTableUI.setId('studyTable');
    this.menuPanel.add( studyTableUI );

    let seriesTableUI = new UI.Table();
    seriesTableUI.setId('seriesTable');
    this.menuPanel.add( seriesTableUI );

    let seriesTable = null;
    let instanceTable = null;
    let studyTable = null;

    //
    // get and display list of studies
    //
    options.chronicle.chronicle.query("instances/context", {
      reduce : true,
      group_level : 2,
      stale : 'update_after',
    }).then(function(data) {
      statusEntry.setTextContent( `${data.rows.length} studies from ${url}...` );
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

      if (studyTable) {
        studyTable.destroy();
      }
      studyTable = $('#studyTable').DataTable({
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
      options.chronicle.chronicle.query("instances/context", {
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
      options.chronicle.seriesOperation({
        chronicle: options.chronicle,
        key: key,
        operation: options.requestSeries
      });
    };
  }
}

class stepOperationMenu extends MenuPanel {
  constructor(step, options) {
    options = options || {};
    options.performFilter = options.performFilter || function(){};
    options.performGrowCut = options.performGrowCut || function(){};
    options.performGaussian = options.performGaussian || function(){};
    options.performRasterizeSegments = options.performRasterizeSegments || function(){};
    super(step, {title: 'Operations'});
    this.options = options;

    let option;

    /*
    // Operations -> FilterTest
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'FilterTest' );
    option.onClick( function () {
      options.performFilter();
    } );
    this.menuPanel.add( option );

    // Operations -> Gaussian
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Gaussian' );
    option.onClick( function () {
      options.performGaussian();
    } );
    this.menuPanel.add( option );
    */

    // Operations -> bilateral
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Bilateral' );
    option.onClick(this.bilateralPanel.bind(this));
    this.menuPanel.add( option );

    // Operations -> GrowCut
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'GrowCut' );
    option.onClick( function () {
      options.performGrowCut();
    } );
    this.menuPanel.add( option );

    /*
    // Operations -> RasterizeSegments
    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'RasterizeSegments' );
    option.onClick( function () {
      options.performRasterizeSegments();
    } );
    this.menuPanel.add( option );
    */
  }

  bilateralPanel() {

    this.container = new UI.Panel();
    this.container.setId('bilateralPanel');

    this.bilateralOptions = this.bilateralOptions || {
      sigmaRange : 1000.,
      sigmaSpace : 5.,
      kernelSize : 3,
    };

    // kernel size integer
    this.kernelUI = new UI.Integer();
    this.kernelUI.min = 1;
    this.kernelUI.max = 50;
    this.kernelUI.precision = 1;
    this.kernelUI.step = 1;
    this.kernelUI.unit = "pixels";
    this.container.add( this.kernelUI );
    this.kernelUI.setValue(this.bilateralOptions.kernelSize);

    // space sigma number
    this.sigmaSpaceUI = new UI.Number();
    this.sigmaSpaceUI.min = 0.1;
    this.sigmaSpaceUI.max = 50;
    this.sigmaSpaceUI.precision = 1;
    this.sigmaSpaceUI.step = 0.1;
    this.sigmaSpaceUI.unit = "sigma space";
    this.container.add( this.sigmaSpaceUI );
    this.sigmaSpaceUI.setValue(this.bilateralOptions.sigmaSpace);

    // range sigma number
    this.sigmaRangeUI = new UI.Number();
    this.sigmaRangeUI.value = this.bilateralOptions.sigmaRange;
    this.sigmaRangeUI.min = 0.1;
    this.sigmaRangeUI.max = 5000;
    this.sigmaRangeUI.precision = 1;
    this.sigmaRangeUI.step = 10;
    this.sigmaRangeUI.unit = "sigma range";
    this.container.add( this.sigmaRangeUI );
    this.sigmaRangeUI.setValue(this.bilateralOptions.sigmaRange);

    let apply = function() {
      this.bilateralOptions.kernelSize = this.kernelUI.getValue();
      this.bilateralOptions.sigmaSpace = this.sigmaSpaceUI.getValue();
      this.bilateralOptions.sigmaRange = this.sigmaRangeUI.getValue();
      this.bilateralOptions = this.options.performBilateral(this.bilateralOptions);
    }
    this.applyButton = new UI.Button("Apply");
    this.container.add( this.applyButton );
    this.applyButton.onClick(apply.bind(this));

    let cancel = function() {
      step.ui.sideBar.dom.removeChild(this.container.dom);
    }
    this.cancelButton = new UI.Button("cancel");
    this.container.add( this.cancelButton );
    this.cancelButton.onClick(cancel.bind(this));

    step.ui.sideBar.dom.appendChild(this.container.dom);
  }
}

class stepViewMenu extends MenuPanel {
  constructor(step, options) {
    options = options || {};
    options.performRasterizeSegments = options.performRasterizeSegments || function(){};
    super(step, {title: 'View'});
    this.options = options;

    let option;

    ['Axial', 'Sagittal', 'Coronal'].forEach(view => {
      option = new UI.Row();
      option.setClass( 'option' );
      option.setTextContent( view );
      option.onClick(() => {
        step.view.slice({plane: view.toLowerCase(), offset: 0.5, thickness: 1});
        step.uniforms.sliceMode.value = 1;
        step.renderer.requestRender(step.view);
      });
      this.menuPanel.add( option );
    });

    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent( 'Volume' );
    option.onClick(() => {
      step.view.viewNear = 0;
      step.view.viewFar = Linear.LARGE_NUMBER;
      step.uniforms.sliceMode.value = 0;
      step.renderer.requestRender(step.view);
    });
    this.menuPanel.add( option );
  }
}

class stepAboutMenu extends MenuPanel {
  constructor(step, options) {
    options = options || {};
    super(step, {title: 'About'});
    this.options = options;

    let option;

    option = new UI.Row();
    option.setClass( 'option' );
    option.setTextContent('This is a very experimental implementation of image viewing and manipulation using WebGL 2.0.' );
    this.menuPanel.add( option );
  }
}

class stepSideBar extends UIItem {
  constructor(step, options) {
    options = options || {};
    super(step);
    this.container = new UI.CollapsiblePanel();
    this.container.setId('sideBar');

    let button = new UI.Button('Calculate Histogram');
    button.onClick(this.drawHistogram.bind(this));
    this.container.add(button);

    let histogramUI = new UI.Panel();
    histogramUI.setId('displayPanel');
    this.container.add( histogramUI );

    let histogram = document.createElement('canvas');
    histogram.width = 150;
    histogram.height = 128;
    histogram.id = 'histogram';
    histogramUI.dom.appendChild(histogram);

    let context = histogram.getContext('2d');
    context.fillStyle = 'black';
    context.fillRect(0, 0, histogram.width, histogram.height);
  }

  drawHistogram() {
    let imageField = step.controls.selectedImageField();
    if (!imageField) {
      return;
    }

    if (imageField != this.currentImageField) {
      this.imageStatistics = imageField.statistics();
      this.currentImageField = imageField;
    }

    let context = histogram.getContext('2d');
    context.fillStyle = 'black';
    context.fillRect(0, 0, histogram.width, histogram.height);
    context.lineWidth =1;
    context.strokeStyle = 'rgb(128,128,128)';
    context.beginPath();
    let xScale = this.imageStatistics.bins / histogram.width;
    let yScale = histogram.height * .8 / this.imageStatistics.maxBinValue;
    for(let bin = 0; bin < this.imageStatistics.bins; bin++) {
      context.moveTo(xScale * bin, histogram.height);
      context.lineTo(xScale * bin,
                     histogram.height - yScale * this.imageStatistics.histogram[bin]);
    }
    context.stroke();

    context.fillStyle = 'rgba(128,128,0,0.7)';
    let range = this.imageStatistics.range;
    let valueScale = histogram.width / (range.max - range.min);
    let halfWidth = imageField.windowWidth / 2.;
    let x = valueScale * (imageField.windowCenter - halfWidth - range.min);
    let width = valueScale * imageField.windowWidth;
    context.fillRect(x, 0, width, histogram.height);
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
      /* paint: "Paint", */
    }).setValue('windowLevel');
    this.container.add( this.toolSelectUI );

    this.progressTextUI = new UI.Text('');
    this.progressTextUI.dom.style.textAlign = 'right';
    this.container.add(this.progressTextUI);
  }

  get sliceOffset() {
    return this.sliceOffsetUI.getValue();
  }
  set sliceOffset(value) {
    this.sliceOffsetUI.setValue(value);
  }

  get progress() {
    return this.progressTextUI.getValue();
  }

  set progress(text) {
    this.progressTextUI.setValue(text);
    this.dom.style.opacity = 1;
    let restoreProgress = function() {
      this.progressTextUI.setValue('');
      this.dom.removeAttribute('style');
    };
    clearTimeout(this.progressTimeout);
    this.progressTimeout = setTimeout(restoreProgress.bind(this), 2000);
  }
}
