class View {
  // All the parameters of the view (camera plus planes and other options)
  constructor(options={}) {
    this.viewPoint = options.viewPoint || [0., 0., -30.];
    this.viewNormal = this.vnormalize(options.viewNormal || [0., 0., 1.5]);
    this.viewUp = this.vnormalize(options.viewUp || [0., -1., 0.]);
    this.viewDistance = this.vlength(this.viewPoint);
    this.viewBoxMin = options.viewBoxMin || [-3., -3., -3.];
    this.viewBoxMax = options.viewBoxMax || [3., 3., 3.];
    this.halfSinViewAngle = options.halfSinViewAngle || .15;

    this.look();
  }

  uniforms() {
    return({
      viewPoint: { type: '3fv', value: this.viewPoint },
      viewNormal: { type: '3fv', value: this.viewNormal },
      viewRight: { type: '3fv', value: this.viewRight },
      viewUp: { type: '3fv', value: this.viewUp },
      viewBoxMin: { type: '3fv', value: this.viewBoxMin },
      viewBoxMax: { type: '3fv', value: this.viewBoxMax },
      halfSinViewAngle: { type: '1f', value: this.halfSinViewAngle },
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
}

