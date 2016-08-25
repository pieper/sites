class Control {
  constructor(options={}) {
    this.mouseEvents = ['mousedown', 'mousemove', 'mouseup'];
  }

  preventEventDefault(event) {
    event.preventDefault();
  }
  activate(options) {
    document.addEventListener("contextmenu", this.preventEventDefault);
  }
  deactivate() {
    document.removeEventListener("contextmenu", this.preventEventDefault);
  }

  onMouseEvent(mouseEvent) {
  }
  onKeyEvent(mouseEvent) {
  }

  // TODO: currently the last field added, but should
  // come from a UI selection of the active tool and target image
  selectedImageField() {
    let fields = step.space.fields;
    let imageField = fields[fields.length-1];
    return (imageField);
  }
}

class WindowLevelControl extends Control {
  constructor(options={}) {
    super(options);
    this.startPoint = undefined;
    this.startWindow = undefined;
  }

  activate(options) {
    super.activate(options);
    // TODO: step is global and defines the application that is being controlled
    this.mouseCallback = this.onMouseEvent.bind(this);
    this.mouseEvents.forEach(eventName => {
      step.space.canvas.addEventListener(eventName, this.mouseCallback, {passive:true});
    });
  }

  deactivate() {
    super.deactivate(options);
    this.mouseEvents.forEach(eventName => {
      step.space.canvas.removeEventListener(eventName, this.mouseCallback);
    });
  }

  onMouseEvent(mouseEvent) {
    let imageField = this.selectedImageField();
    if (!imageField) {
      return;
    }
    let point = [-1. + (2. * mouseEvent.clientX / step.space.canvas.width),
                 -1. + (2. * mouseEvent.clientY / step.space.canvas.height)];
    switch (mouseEvent.type) {
      case 'mousedown': {
        this.startPoint = point.slice();
        this.startWindow = [imageField.windowWidth, imageField.windowCenter].slice();
        this.startViewPoint = step.view.viewPoint.slice();
      }
      break;
      case 'mousemove': {
        if (this.startPoint) {
          let pointDelta = [0,1].map(e=>point[e]-this.startPoint[e]);
          if (mouseEvent.buttons == 1) {
            // W/L
            // TODO: figure out a good way to automatically determine the gain
            imageField.windowWidth = this.startWindow[0] + pointDelta[0] * 500.;
            imageField.windowWidth = Math.max(imageField.windowWidth, 0.);
            imageField.windowCenter = this.startWindow[1] + pointDelta[1] * 500.;
          }
          if (mouseEvent.buttons == 4) {
            // PAN
            let gain = 5.;
            let rightward = [0, 1, 2].map(e=>{
              return(-1 * gain * pointDelta[0] * step.view.viewRight[e]);
            });
            let upward = [0, 1, 2].map(e=>{
              return(gain * pointDelta[1] * step.view.viewUp[e]);
            });
            let viewPoint = step.view.vplus(this.startViewPoint, rightward);
            step.view.viewPoint = step.view.vplus(viewPoint, upward);
            step.view.look({from: viewPoint});
          }
          if (mouseEvent.buttons == 2) {
            // ZOOM
            let gain = 5.;
            let viewPoint = [0, 1, 2].map(e=>{
              return(this.startViewPoint[e] + step.view.viewNormal[e] * gain * pointDelta[1]);
            });
            step.view.look({from: viewPoint});
          }
          step.space.requestRender(step.view);
        }
      }
      break;
      case 'mouseup': {
        this.startPoint = undefined;
      }
    }
  }
}

class ViewControl extends Control {
  constructor(options={}) {
    super(options);
    this.startPoint = undefined;
  }

  activate(options) {
    super.activate(options);
    // TODO: step is global and defines the application that is being controlled
    this.wheelCallback = this.onWheelEvent.bind(this);
    step.space.canvas.addEventListener('mousewheel', this.wheelCallback, {passive:true});
    this.keyboardCallback = this.onKeyboardEvent.bind(this);
    window.addEventListener('keydown', this.keyboardCallback, {passive:true});
  }

  deactivate() {
    super.deactivate(options);
    step.space.canvas.removeEventListener('mousewheel', this.wheelCallback);
    window.removeEventListener('keydown', this.keyboardCallback);
  }

  onWheelEvent(wheelEvent) {
    let gain = 5.;
    if (wheelEvent.wheelDelta < 0) {
      gain *= -1;
    }
    step.view.viewPoint = [0, 1, 2].map(e=>{
      return(step.view.viewPoint[e] - gain * step.view.viewNormal[e]);
    });
    step.view.look({from: step.view.viewPoint});
    step.space.requestRender(step.view);
  }

  onKeyboardEvent(keyboardEvent) {
    switch (keyboardEvent.key) {
      case "ArrowUp": {
        step.view.orbit(0, 1);
      }
      break;
      case "ArrowRight": {
        step.view.orbit(1, 0);
      }
      break;
      case "ArrowLeft": {
        step.view.orbit(-1, 0);
      }
      break;
      case "ArrowDown": {
        step.view.orbit(0, -1);
      }
      break;
      case "a": {
        step.view.slice({plane: "axial", offset: 0.5, thickness: 1});
      }
      break;
      case "s": {
        step.view.slice({plane: "sagittal", offset: 0.5, thickness: 1});
      }
      break;
      case "c": {
        step.view.slice({plane: "coronal", offset: 0.5, thickness: 1});
      }
      break;
      case "v": {
        step.view.viewNear = 0;
        step.view.viewFar = 3e38;
      }
      break;
    }
    step.space.requestRender(step.view);
  }
}
