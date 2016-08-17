class View {
  // All the parameters of the view (camera plus planes and other options)
  constructor(options={}) {
    this.viewPoint = options.viewPoint || [0., 0., -30.];
    this.viewNormal = this.vnormalize(options.viewNormal || [0., 0., 1.5]);
    this.viewUp = this.vnormalize(options.viewUp || [0., -1., 0.]);
    this.viewDistance = this.vlength(this.viewPoint);
    this.viewBoxMin = options.viewBoxMin || [-3., -3., -3.];
    this.viewBoxMax = options.viewBoxMax || [3., 3., 3.];
    this.viewAngle = options.viewAngle || 30.;
    this.viewNear = 0.;
    this.viewFar = 3e+38;  // basically float max

    this.look();
  }

  uniforms() {
    let halfSinViewAngle = 0.5 * Math.sin(this.viewAngle * Math.PI/180.);
    return({
      viewPoint: { type: '3fv', value: this.viewPoint },
      viewNormal: { type: '3fv', value: this.viewNormal },
      viewRight: { type: '3fv', value: this.viewRight },
      viewUp: { type: '3fv', value: this.viewUp },
      viewBoxMin: { type: '3fv', value: this.viewBoxMin },
      viewBoxMax: { type: '3fv', value: this.viewBoxMax },
      halfSinViewAngle: { type: '1f', value: halfSinViewAngle },
      viewNear: { type: '1f', value: this.viewNear },
      viewFar: { type: '1f', value: this.viewFar },
    });
  }

  vlength(v) {
    return(Math.sqrt(v.map(e=>e*e).reduce((sum,value)=>sum+value)));
  }

  vnormalize(v) {
    return(this.vscale(v, 1./this.vlength(v)));
  }

  vdistance(v1, v2) {
    return(this.vlength(this.vminus(v2, v1)));
  }

  vplus(v1, v2) {
    return([v1[0]+v2[0],v1[1]+v2[1],v1[2]+v2[2]]);
  }

  vminus(v1, v2) {
    return([v1[0]-v2[0],v1[1]-v2[1],v1[2]-v2[2]]);
  }

  vscale(v1, scale) {
    return([v1[0]*scale,v1[1]*scale,v1[2]*scale]);
  }

  vcross(v1, v2) {
    return([v1[1]*v2[2] - v1[2]*v2[1],
            v1[2]*v2[0] - v1[0]*v2[2],
            v1[0]*v2[1] - v1[1]*v2[0]]);
  }

  vdot(v1, v2) {
    return([v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]]);
  }

  target() {
    this.viewNormal = this.vnormalize(this.viewNormal);
    return(this.vplus(this.viewPoint, this.vscale(this.viewNormal, this.viewDistance)));
  }

  look(options={}) {
    let at = options.at || this.target();
    let from = options.from || this.viewPoint;
    let up = options.up || this.viewUp;

    this.viewNormal = this.vnormalize(this.vminus(at, from));
    this.viewRight = this.vcross(this.viewNormal, up);
    this.viewUp = this.vcross(this.viewRight, this.viewNormal);
    this.viewPoint = from.slice();
    this.viewDistance = this.vdistance(at, from);
  }

  slice(options={}) {
    let plane = options.plane || "axial";
    let offset = options.offset || 0.5;
    let thickness = options.thickness || 0.;
    let bounds = options.bounds || {min: this.viewBoxMin, max: this.viewBoxMax};
    let magnification = options.magnification || 1.;

    let target = this.vscale(this.vplus(bounds.min, bounds.max), offset);
    let extent = this.vminus(bounds.max, bounds.min);

    // TODO: doublecheck these with Slicer
    switch (plane) {
      case "axial": {
        // looking from below at LPS slice
        this.viewRight = [1, 0, 0];
        this.viewUp = [0, -1, 0];
        this.viewNormal = [0, 0, 1];
        this.viewPoint = [0, 0, -1];
      }
      break;
      case "sagittal": {
        // nose pointing left
        this.viewRight = [0, 1, 0];
        this.viewUp = [0, 0, 1];
        this.viewNormal = [1, 0, 0];
        this.viewPoint = [-1, 0, 0];
      }
      break;
      case "coronal": {
        this.viewRight = [1, 0, 0];
        this.viewUp = [0, 0, 1];
        this.viewNormal = [0, 1, 0];
        this.viewPoint = [0, -1, 0];
      }
      break;
      default: {
        console.log('Unknown slice plane', plane);
      }
    }

    let extentRight = this.vlength(this.vdot(extent, this.viewRight));
    let windowRight = magnification * extentRight;
    this.viewDistance = windowRight / Math.tan(this.viewAngle * Math.PI/180.);
    let viewOffset = this.vscale(this.viewPoint, this.viewDistance);
    this.viewPoint = this.vplus(target, viewOffset);

    this.viewNear = this.viewDistance - 0.5 * thickness;
    this.viewFar = this.viewDistance + 0.5 * thickness;
  }
}

