// populates Fields with data based on inputs
class Generator {  // TODO: unify with Space
  constructor(options={}) {

    this.gl = options.gl;
    this.uniforms = options.uniforms || {};
    this.uniforms.gradientSize = { type: '1f', value: .01 };
    this.inputFields = options.inputFields || [];
    this.outputFields = options.outputFields || [];
    this.program = undefined;
  }

  // utility for printing multiline strings for debugging
  logWithLineNumbers(string) {
    let lineNumber = 1;
    string.split("\n").forEach(line=>{
      console.log(lineNumber, line);
      lineNumber += 1;
    });
  }
}

// Uses a GL program to generate fields
class ProgrammaticGenerator extends Generator {
  constructor(options={}) {
    super(options);
    this.uniforms.amplitude = { type: '1f', value: 1. };
    this.uniforms.frequency = { type: '1f', value: 1. };
    let gl = this.gl;

    this.outputFields.forEach(outputField=>{
      outputField.generator = this;
    });

    // buffers for the textured plane in normalized (clip) space
    let renderImageVertices = [ -1., -1., 0.,
                                 1., -1., 0.,
                                -1.,  1., 0.,
                                 1.,  1., 0., ];
    this.renderImageCoordinatesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageVertices), gl.STATIC_DRAW);

    let renderImageTextureCoordinates = [ 0., 0.,
                                          1., 0.,
                                          0., 1.,
                                          1., 1. ];
    this.renderImageTexureCoordinatesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageTexureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageTextureCoordinates), gl.STATIC_DRAW);

    // framebuffer to attach texture layer for generating a slice
    this.framebuffer = gl.createFramebuffer();
  }

  headerSource() {
    return(`#version 300 es
      precision highp float;
      precision highp int;
      precision highp sampler3D;
      precision highp isampler3D;
    `);
  }

  _vertexShaderSource() {
    return (`${this.headerSource()}
      layout(location = 0) in vec3 coordinate;
      layout(location = 1) in vec2 textureCoordinate;
      uniform float slice;
      out vec3 interpolatedTextureCoordinate;
      void main()
      {
        interpolatedTextureCoordinate = vec3(textureCoordinate, slice);
        gl_Position = vec4(coordinate, 1.);
      }
    `);
  }

  _fragmentShaderSource() {
    return (`${this.headerSource()}

      ${function() {
          let textureDeclarations = '';
          this.inputFields.forEach(field=>{
            textureDeclarations += "uniform highp isampler3D textureUnit"+String(field.id)+";\n";
          });
          return(textureDeclarations);
        }.bind(this)()
      }

      in vec3 interpolatedTextureCoordinate;
      layout(location = 0) out int fragmentColor;
      layout(location = 1) out int altFragmentColor;

      uniform float slice;
      uniform float gradientSize;
      uniform float amplitude;
      uniform float frequency;
      uniform isampler3D inputTexture0;

      int sampleValue;
      int perturbation;

      void main()
      {
        perturbation = int(10. * amplitude * slice * 
                          (sin(frequency*interpolatedTextureCoordinate.s) 
                           + cos(frequency*interpolatedTextureCoordinate.t))
                        );
        vec3 tc = interpolatedTextureCoordinate;
        sampleValue = texture(inputTexture0, tc).r;
        fragmentColor = sampleValue + perturbation;
        altFragmentColor = sampleValue - perturbation;
      }
    `);
  }

  updateProgram() {
    // recreate the program
    let gl = this.gl;
    if (this.program) {gl.deleteProgram(this.program);}

    this.vertexShaderSource = this._vertexShaderSource();
    this.fragmentShaderSource = this._fragmentShaderSource();

    // the program and shaders
    this.program = gl.createProgram();
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.vertexShader, this.vertexShaderSource);
    gl.compileShader(this.vertexShader);
    if (!gl.getShaderParameter(this.vertexShader, gl.COMPILE_STATUS)) {
      this.logWithLineNumbers(this.vertexShaderSource);
      console.error('Could not compile vertexShader');
      console.log(gl.getShaderInfoLog(this.vertexShader));
      return;
    }
    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(this.fragmentShader, this.fragmentShaderSource);
    gl.compileShader(this.fragmentShader);
    if (!gl.getShaderParameter(this.fragmentShader, gl.COMPILE_STATUS)) {
      this.logWithLineNumbers(this.fragmentShaderSource);
      console.error('Could not compile fragmentShader');
      console.log(gl.getShaderInfoLog(this.fragmentShader));
      return;
    }
    gl.attachShader(this.program, this.vertexShader);
    gl.deleteShader(this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    gl.deleteShader(this.fragmentShader);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      this.logWithLineNumbers(this.fragmentShaderSource);
      console.error('Could not link program');
      console.log(gl.getProgramInfoLog(this.program));
      return;
    }

    // activate the inputs
    this.inputFields.forEach(field => {
      if (field.needsUpdate()) {
        field.fieldToTexture(gl)
      }
    });
  }

  _setUniform(key, uniform) {
    let gl = this.gl;
    let location = gl.getUniformLocation(this.program, key);

    //console.log('setting ' + key + ' to ' + uniform.value);

    if (uniform.type == '3fv') {gl.uniform3fv(location, uniform.value); return;}
    if (uniform.type == '3iv') {gl.uniform3iv(location, uniform.value); return;}
    if (uniform.type == '3fv') {gl.uniform3fv(location, uniform.value); return;}
    if (uniform.type == '1f') {gl.uniform1f(location, uniform.value); return;}
    if (uniform.type == '1ui') {gl.uniform1ui(location, uniform.value); return;}
    if (uniform.type == '1i') {gl.uniform1i(location, uniform.value); return;}
    if (uniform.type == 'Matrix3fv') {gl.uniformMatrix3fv(location, gl.FALSE, uniform.value); return;}
    if (uniform.type == 'Matrix4fv') {gl.uniformMatrix4fv(location, gl.FALSE, uniform.value); return;}
    console.error('Could not set uniform', key, uniform);
  }

  generate() {
    let gl = this.gl;
    let outputField0 = this.outputFields[0];
    let outputDataset = outputField0.dataset;

    gl.useProgram(this.program);

    gl.viewport(0, 0, outputDataset.Columns, outputDataset.Rows);

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
    this.inputFields.forEach(field=>{
      let uniforms = field.uniforms();
      Object.keys(uniforms).forEach(key=>{
        this._setUniform(key, uniforms[key]);
      });
    });

    // activate any field textures
    let textureIndex = 0;
    this.inputFields.forEach(field=>{
      gl.activeTexture(gl.TEXTURE0+textureIndex);
      if (field.texture) {
        gl.bindTexture(gl.TEXTURE_3D, field.texture);
      }
      let textureSymbol = "inputTexture"+textureIndex;
      let samplerLocation = gl.getUniformLocation(this.program, textureSymbol);
      gl.uniform1i(samplerLocation, textureIndex);
      textureIndex++;
    });

    // generate the output by invoking the program once per slice
    let mipmapLevel = 0;
    let sliceUniformLocation = gl.getUniformLocation(this.program, "slice");
    let sharedGroups = outputDataset.SharedFunctionalGroups;
    let sliceSpacing = sharedGroups.PixelMeasures.SpacingBetweenSlices;
    let slice = 0.5 * sliceSpacing;
    let frames = outputDataset.NumberOfFrames;
    for (let sliceIndex = 0; sliceIndex < frames; sliceIndex++) {
      slice = sliceIndex / outputDataset.NumberOfFrames;
      gl.uniform1f(sliceUniformLocation, slice);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      let drawBuffers = [];
      let attachment = 0;
      this.outputFields.forEach(outputField=>{
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, 
                                   gl.COLOR_ATTACHMENT0+attachment,
                                   outputField.texture, 
                                   mipmapLevel, sliceIndex);
        drawBuffers.push(gl.COLOR_ATTACHMENT0+attachment);
        attachment++;
      });
      gl.drawBuffers(drawBuffers);
      let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status != gl.FRAMEBUFFER_COMPLETE) {
        console.error("Incomplete framebuffer: " + status);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      slice += sliceSpacing;
    }
  }
}
