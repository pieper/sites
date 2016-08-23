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

  midentity() {
    return ([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
  }

  mtranslate(v) {
    return ([[1,0,0,0],[0,1,0,0],[0,0,1,0],[v[0],v[1],v[2],1]]);
  }

  mscale(v) {
    return ([[v[0],0,0,0],[0,v[1],0,0],[0,0,v[2],0],[0,0,0,1]]);
  }

  // return a matrix to rotate a point around the axis by angle
  // axis must be normalized
  // angle is in degrees
  // https://en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
  mrotate(u, theta) {
    let T = theta * Math.PI/180.;
    let cT = Math.cos(T);
    let sT = Math.sin(T);
    return ([
      [cT+u[0]*u[0]*(1-cT), u[1]*u[0]*(1-cT)+u[2]*sT, u[2]*u[0]*(1-cT)-u[1]*sT, 0],
      [u[0]*u[1]*(1-cT)-u[2]*sT, cT+u[1]*u[1]*(1-cT), u[2]*u[1]*(1-cT)+u[0]*sT, 0],
      [u[0]*u[2]*(1-cT)+u[1]*sT, u[1]*u[2]*(1-cT)-u[0]*sT, cT+u[2]*u[2]*(1-cT), 0],
      [0, 0, 0, 1]
    ]);
  }

  mmultiply(m1, m2) {
    return ([
      [m1[0][0]*m2[0][0]+m1[1][0]*m2[0][1]+m1[2][0]*m2[0][2]+m1[3][0]*m2[0][3],
       m1[0][1]*m2[0][0]+m1[1][1]*m2[0][1]+m1[2][1]*m2[0][2]+m1[3][1]*m2[0][3],
       m1[0][2]*m2[0][0]+m1[1][2]*m2[0][1]+m1[2][2]*m2[0][2]+m1[3][2]*m2[0][3],
       m1[0][3]*m2[0][0]+m1[1][3]*m2[0][1]+m1[2][3]*m2[0][2]+m1[3][3]*m2[0][3]],
      [m1[0][0]*m2[1][0]+m1[1][0]*m2[1][1]+m1[2][0]*m2[1][2]+m1[3][0]*m2[1][3],
       m1[0][1]*m2[1][0]+m1[1][1]*m2[1][1]+m1[2][1]*m2[1][2]+m1[3][1]*m2[1][3],
       m1[0][2]*m2[1][0]+m1[1][2]*m2[1][1]+m1[2][2]*m2[1][2]+m1[3][2]*m2[1][3],
       m1[0][3]*m2[1][0]+m1[1][3]*m2[1][1]+m1[2][3]*m2[1][2]+m1[3][3]*m2[1][3]],
      [m1[0][0]*m2[2][0]+m1[1][0]*m2[2][1]+m1[2][0]*m2[2][2]+m1[3][0]*m2[2][3],
       m1[0][1]*m2[2][0]+m1[1][1]*m2[2][1]+m1[2][1]*m2[2][2]+m1[3][1]*m2[2][3],
       m1[0][2]*m2[2][0]+m1[1][2]*m2[2][1]+m1[2][2]*m2[2][2]+m1[3][2]*m2[2][3],
       m1[0][3]*m2[2][0]+m1[1][3]*m2[2][1]+m1[2][3]*m2[2][2]+m1[3][3]*m2[2][3]],
      [m1[0][0]*m2[3][0]+m1[1][0]*m2[3][1]+m1[2][0]*m2[3][2]+m1[3][0]*m2[3][3],
       m1[0][1]*m2[3][0]+m1[1][1]*m2[3][1]+m1[2][1]*m2[3][2]+m1[3][1]*m2[3][3],
       m1[0][2]*m2[3][0]+m1[1][2]*m2[3][1]+m1[2][2]*m2[3][2]+m1[3][2]*m2[3][3],
       m1[0][3]*m2[3][0]+m1[1][3]*m2[3][1]+m1[2][3]*m2[3][2]+m1[3][3]*m2[3][3]]
    ]);
  }

  mvmultiply(m, v) {
    return ([
      m[0][0]*v[0]+m[1][0]*v[1]+m[2][0]*v[2]+m[3][0]*v[3],
      m[0][1]*v[0]+m[1][1]*v[1]+m[2][1]*v[2]+m[3][1]*v[3],
      m[0][2]*v[0]+m[1][2]*v[1]+m[2][2]*v[2]+m[3][2]*v[3],
      m[0][3]*v[0]+m[1][3]*v[1]+m[2][3]*v[2]+m[3][3]*v[3]
    ]);
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
    let target = options.target || this.vscale(this.vplus(bounds.min, bounds.max), offset);
    let extent = options.extent || this.vminus(bounds.max, bounds.min);

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
        this.viewNormal = [-1, 0, 0];
        this.viewPoint = [1, 0, 0];
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
    let windowRight = extentRight / magnification;
    this.viewDistance = windowRight / Math.tan(this.viewAngle * Math.PI/180.);
    let viewOffset = this.vscale(this.viewPoint, this.viewDistance);
    this.viewPoint = this.vplus(target, viewOffset);

    this.viewNear = this.viewDistance - 0.5 * thickness;
    this.viewFar = this.viewDistance + 0.5 * thickness;
  }

  orbit (rightward, upward) {
    let vTargetToOrigin = this.vscale(this.target(), -1);
    let mTargetToOrigin = this.mtranslate(vTargetToOrigin);
    let mAboutUp = this.mrotate(this.viewUp, rightward);
    let mAboutRight = this.mrotate(this.viewRight, upward);
    let mTargetFromOrigin = this.mtranslate(this.target());
    let rotation = this.mmultiply(mTargetFromOrigin,
                    this.mmultiply(mAboutRight,
                      this.mmultiply(mAboutUp, mTargetToOrigin)));
    let newViewPoint = this.mvmultiply(rotation, [...this.viewPoint,1]).slice(0,3);
    this.look({from: newViewPoint});
  }
}

