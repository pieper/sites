class Control {
  constructor(options={}) {
    this.mouseEvents = ['mousedown', 'mousemove', 'mouseup'];
  }

  activate(options) {
  }
  deactivate() {
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
        this.startWindow = [imageField.windowWidth, imageField.windowCenter];
      }
      break;
      case 'mousemove': {
        if (mouseEvent.buttons == 1) {
          let delta = [0,1].map(e=>point[e]-this.startPoint[e]);
          // TODO: figure out a good way to automatically determine the gain
          imageField.windowWidth = this.startWindow[0] + delta[0] * 500.;
          imageField.windowWidth = Math.max(imageField.windowWidth, 0.);
          imageField.windowCenter = this.startWindow[1] + delta[1] * 500.;
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
    step.space.canvas.removeEventListener('mousewheel', this.wheelCallback);
    window.removeEventListener('keydown', this.keyboardCallback);
  }

  onWheelEvent(wheelEvent) {
    let delta = 1.;
    if (wheelEvent.wheelDelta < 0) {
      delta *= -1;
    }
    step.view.viewPoint[2] += delta;
    step.view.look({from: step.view.viewPoint});
    step.space.requestRender(step.view);
  }

  onKeyboardEvent(keyboardEvent) {
    switch (keyboardEvent.key) {
      case "ArrowUp": {
        step.view.orbit(0, 1);
        step.space.requestRender(step.view);
      }
      break;
      case "ArrowRight": {
        step.view.orbit(1, 0);
        step.space.requestRender(step.view);
      }
      break;
      case "ArrowLeft": {
        step.view.orbit(-1, 0);
        step.space.requestRender(step.view);
      }
      break;
      case "ArrowDown": {
        step.view.orbit(0, -1);
        step.space.requestRender(step.view);
      }
      break;
      case "a": {
        step.view.slice({plane: "axial", offset: 0.5, thickness: 1});
        step.space.requestRender(step.view);
      }
      break;
      case "s": {
        step.view.slice({plane: "sagittal", offset: 0.5, thickness: 1});
        step.space.requestRender(step.view);
      }
      break;
      case "c": {
        step.view.slice({plane: "coronal", offset: 0.5, thickness: 1});
        step.space.requestRender(step.view);
      }
      break;
      case "v": {
        step.view.look({viewNear: 0, viewFar: 3e38});
        step.space.requestRender(step.view);
      }
      break;
    }
  }
}
