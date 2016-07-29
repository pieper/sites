class Space {
  constructor(options={}) {

    // required
    this.canvasSelector = options.canvasSelector;
    this.uniforms = options.uniforms;
    this.fieldShader = options.fieldShader;
    this.vertexShaderSource = options.fieldShader.vertexShaderSource();
    this.fragmentShaderSource = options.fieldShader.fragmentShaderSource();

    // optional
    this.clearColor = options.clearColor || [0., 0., 0., 1.];
    this.renderRequestTimeout = options.renderRequestTimeout || 100.;

    // state
    this.pendingRenderRequest = false;

    this.canvas = document.querySelector(options.canvasSelector);
    this.gl = this.canvas.getContext('webgl2');
    let gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // the program and shaders
    this.program = gl.createProgram();
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.vertexShader, this.vertexShaderSource);
    gl.compileShader(this.vertexShader);
    if (!gl.getShaderParameter(this.vertexShader, gl.COMPILE_STATUS)) {
      console.log(this.vertexShaderSource);
      console.error('Could not compile vertexShader');
      console.log(gl.getShaderInfoLog(this.vertexShader));
    }
    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(this.fragmentShader, this.fragmentShaderSource);
    gl.compileShader(this.fragmentShader);
    if (!gl.getShaderParameter(this.fragmentShader, gl.COMPILE_STATUS)) {
      console.log(this.fragmentShaderSource);
      console.error('Could not compile fragmentShader');
      console.log(gl.getShaderInfoLog(this.fragmentShader));
    }
    gl.attachShader(this.program, this.vertexShader);
    gl.deleteShader(this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    gl.deleteShader(this.fragmentShader);
    gl.linkProgram(this.program);

    // buffers for the textured plane in normalized space
    this.renderImageCoordinatesBuffer = gl.createBuffer();
    this.renderImageTexureCoordinatesBuffer = gl.createBuffer();
    let renderImageVertices = [ -1., -1., 0., 1., -1., 0., -1.,  1., 0., 1.,  1., 0., ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageVertices), gl.STATIC_DRAW);
    let renderImageTextureCoordinates = [ 0, 1,  1, 1,  0, 0,  1, 0 ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageTexureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageTextureCoordinates), gl.STATIC_DRAW);
  }

  requestRender(options={}) {
    this.uniforms = options.uniforms || this.uniforms || {};
    if (this.pendingRenderRequest) {
      return;
    }
    // todo
    this.pendingRenderRequest = window.requestIdleCallback(this._render, {
      timeout: this.renderRequestTimeout
    });
  }

  _setUniform(key, uniform) {
    let gl = this.gl;
    let location = gl.getUniformLocation(this.program, key);
    if (uniform.type == '3fv') {gl.uniform3fv(location, uniform.value); return;}
    if (uniform.type == '1f') {gl.uniform1f(location, uniform.value); return;}
    if (uniform.type == '1ui') {gl.uniform1ui(location, uniform.value); return;}
  }

  _render() {

    this.pendingRenderRequest = false;

    let gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // the coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageCoordinatesBuffer);
    let coordinateLocation = gl.getAttribLocation(this.program, "coordinate");
    gl.enableVertexAttribArray( coordinateLocation );
    gl.vertexAttribPointer( coordinateLocation, 3, gl.FLOAT, false, 0, 0);

    // the textureCoordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageTexureCoordinatesBuffer);
    let textureCoordinateLocation = gl.getAttribLocation(this.program, "textureCoordinate");
    gl.enableVertexAttribArray( textureCoordinateLocation );
    gl.vertexAttribPointer( textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);

    // the overall application uniforms, and the per-field uniforms
    Object.keys(this.uniforms).forEach(key=>{
      this._setUniform(key, this.uniforms[key]);
    });
    this.fieldShader.fields.forEach(field=>{
      Object.keys(this.uniforms).forEach(key=>{
        this._setUniform(key, this.uniforms[key]);
      });
    });

    // draw to the main framebuffer!
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  }


}
