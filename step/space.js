class Space {
  constructor(options={}) {

    // required
    this.canvasSelector = options.canvasSelector;

    // optional
    this.uniforms = options.uniforms || [];
    this.fields = options.fields || [];
    this.clearColor = options.clearColor || [0., 0., 0., 1.];
    this.renderRequestTimeout = options.renderRequestTimeout || 100.;

    // state
    this.pendingRenderRequest = false;

    this.spaceShader = new SpaceShader({fields: this.fields});

    this.canvas = document.querySelector(options.canvasSelector);
    this.gl = this.canvas.getContext('webgl2');
    let gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // buffers for the textured plane in normalized (clip) space
    this.renderImageCoordinatesBuffer = gl.createBuffer();
    this.renderImageTexureCoordinatesBuffer = gl.createBuffer();
    let renderImageVertices = [ -1., -1., 0.,
                                 1., -1., 0.,
                                -1.,  1., 0.,
                                 1.,  1., 0., ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageVertices), gl.STATIC_DRAW);
    let renderImageTextureCoordinates = [ 0, 0,
                                          1, 0,
                                          0, 1,
                                          1, 1 ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderImageTexureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageTextureCoordinates), gl.STATIC_DRAW);

    this.updateFields();
  }

  logWithLineNumbers(string) {
    let lineNumber = 1;
    string.split("\n").forEach(line=>{
      console.log(lineNumber, line);
      lineNumber += 1;
    });
  }

  updateFields() {
    // recreate the program and textures for the current field list
    let gl = this.gl;
    if (this.program) {gl.deleteProgram(this.program);}

    this.vertexShaderSource = this.spaceShader.vertexShaderSource();
    this.fragmentShaderSource = this.spaceShader.fragmentShaderSource();

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

    // activate any field textures
    this.spaceShader.fields.forEach(field=>field.fieldToTexture(gl));
  }

  requestRender(view) {
    this.view = view;
    if (this.pendingRenderRequest) {
      console.log('skipping render - pending request');
      return;
    }
    this.pendingRenderRequest = window.requestAnimationFrame(this._render.bind(this));
  }

  _setUniform(key, uniform) {
    let gl = this.gl;
    let location = gl.getUniformLocation(this.program, key);
    if (uniform.type == '3fv') {gl.uniform3fv(location, uniform.value); return;}
    if (uniform.type == '3iv') {gl.uniform3iv(location, uniform.value); return;}
    if (uniform.type == '1f') {gl.uniform1f(location, uniform.value); return;}
    if (uniform.type == '1ui') {gl.uniform1ui(location, uniform.value); return;}
    if (uniform.type == '1i') {gl.uniform1i(location, uniform.value); return;}
    if (uniform.type == 'Matrix3fv') {gl.uniformMatrix3fv(location, gl.FALSE, uniform.value); return;}
    if (uniform.type == 'Matrix4fv') {gl.uniformMatrix4fv(location, gl.FALSE, uniform.value); return;}
    console.error('Could not set uniform', key, uniform);
  }

  _render() {

    this.pendingRenderRequest = false;
    if (!this.gl) {
      console.log('skipping render - no gl context');
      return;
    }
    if (!this.view) {
      console.log('skipping render - no view');
      return;
    }

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
    let uniforms = this.view.uniforms();
    Object.keys(uniforms).forEach(key=>{
      this._setUniform(key, uniforms[key]);
    });
    this.spaceShader.fields.forEach(field=>{
      let uniforms = field.uniforms();
      Object.keys(uniforms).forEach(key=>{
        this._setUniform(key, uniforms[key]);
      });
    });

    // activate any field textures
    this.spaceShader.fields.forEach(field=>{
      gl.activeTexture(gl.TEXTURE0+field.id);
      if (field.texture) {
        gl.bindTexture(gl.TEXTURE_3D, field.texture);
      }
    });

    // draw to the main framebuffer!
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

class SpaceShader {
  constructor(options={}) {
    this.fields = options.fields || [];
  }

  perFieldSamplingShaderSource() {
    let perFieldSamplingShaderSource = '';
    this.fields.forEach(field=>{
      perFieldSamplingShaderSource += field.samplingShaderSource();
    });
    return(perFieldSamplingShaderSource);
  }

  perFieldCompositingShaderSource() {
    let source = '';
    this.fields.forEach(field=>{
      source += `
          // accumulate per-field opacities and lit colors
          sampleField${field.id}(textureUnit${field.id},
                                  samplePoint, gradientSize, sampleValue, normal, gradientMagnitude);
          transferFunction${field.id}(sampleValue, gradientMagnitude, color, fieldOpacity);
          litColor += fieldOpacity * lightingModel(samplePoint, normal, color, viewPoint);
          opacity += fieldOpacity;
      `;
    });
    return(source);
  }

  fieldCompositingShaderSource() {
    let fieldCompositingShaderSource = `
          vec3 normal;
          float gradientMagnitude;
          vec3 color;
          float opacity = 0.;
          vec3 litColor = vec3(0.);
          float fieldOpacity = 0.;
          vec3 fieldLitColor = vec3(0.);

          ${this.perFieldCompositingShaderSource()}

          // normalize back so that litColor is mean of all fields weighted by opacity
          litColor /= opacity;
    `;

    return(fieldCompositingShaderSource);
  }

  headerSource() {
    return(`#version 300 es
      precision highp float;
      precision highp int;
      precision highp sampler3D;
      precision highp isampler3D;
    `);
  }

  vertexShaderSource() {
    return (`${this.headerSource()}
      in vec3 coordinate;
      in vec2 textureCoordinate;
      out vec3 interpolatedTextureCoordinate;
      void main()
      {
        interpolatedTextureCoordinate = vec3(textureCoordinate, .5);
        gl_Position = vec4(coordinate, 1.);
      }
    `);
  }

  fragmentShaderSource() {
    return (`${this.headerSource()}

      uniform vec3 pointLight;
      uniform vec3 viewPoint;
      uniform vec3 viewNormal;
      uniform vec3 viewRight;
      uniform vec3 viewUp;
      uniform float halfSinViewAngle;
      uniform vec3 viewBoxMin;
      uniform vec3 viewBoxMax;
      uniform float viewNear;
      uniform float viewFar;
      uniform float gradientSize;
      uniform int rayMaxSteps;
      uniform float sampleStep;

      bool intersectBox(const in vec3 rayOrigin, const in vec3 rayDirection,
                        const in vec3 boxMin, const in vec3 boxMax,
                        out float tNear, out float tFar)
        // intersect ray with a box
        // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rtinter3.htm
      {
          // compute intersection of ray with all six bbox planes
          vec3 invRay = vec3(1.) / rayDirection;
          vec3 tBot = invRay * (boxMin - rayOrigin);
          vec3 tTop = invRay * (boxMax - rayOrigin);

          // re-order intersections to find smallest and largest on each axis
          vec3 tMin = min(tTop, tBot);
          vec3 tMax = max(tTop, tBot);

          // find the largest tMin and the smallest tMax
          float largest_tMin = max(max(tMin.x, tMin.y), max(tMin.x, tMin.z));
          float smallest_tMax = min(min(tMax.x, tMax.y), min(tMax.x, tMax.z));

          tNear = largest_tMin;
          tFar = smallest_tMax;

          return smallest_tMax > largest_tMin;
      }

      vec3 lightingModel( in vec3 samplePoint, in vec3 normal, in vec3 color, in vec3 viewPoint )
      {
        // Phong lighting
        // http://en.wikipedia.org/wiki/Phong_reflection_model
        vec3 Cambient = color;
        vec3 Cdiffuse = color;
        vec3 Cspecular = vec3(1.,1.,1.);
        float Kambient = .30;
        float Kdiffuse = .95;
        float Kspecular = .80;
        float Shininess = 10.;

        vec3 litColor = Kambient * Cambient;
        vec3 pointToEye = normalize(viewPoint - samplePoint);

        if (dot(pointToEye, normal) > 0.) {
          vec3 pointToLight = normalize(pointLight - samplePoint);
          float lightDot = dot(pointToLight,normal);
          vec3 lightReflection = reflect(pointToLight,normal);
          float reflectDot = dot(lightReflection,pointToEye);
          if (lightDot > 0.) {
            litColor += Kdiffuse * lightDot * Cdiffuse;
            litColor += Kspecular * pow( abs(reflectDot), Shininess ) * Cspecular;
          }
        }
        return clamp(litColor, 0., 1.);
      }

      // these are the function definitions for sampleVolume* and transferFunction*
      // that define a field at a sample point in space
      ${this.perFieldSamplingShaderSource()}

      // field ray caster - starts from the front and collects color and opacity
      // contributions until fully saturated.
      // Sample coordinate is 0->1 texture space
      //
      vec4 rayCast( in vec3 sampleCoordinate )
      {
        vec4 backgroundRGBA = vec4(0.2,0.,.5,1.); // TODO: mid blue background for now

        // TODO aspect: float aspect = imageW / (1.0 * imageH);
        // normalized to -1 to 1
        vec2 normalizedCoordinate = 2. * (sampleCoordinate.st -.5);

        // calculate eye ray in world space
        vec3 eyeRayDirection;

        // ||viewNormal + u * viewRight + v * viewUp||
        eyeRayDirection = normalize ( viewNormal
                                    + viewRight * halfSinViewAngle * normalizedCoordinate.x
                                    + viewUp * halfSinViewAngle * normalizedCoordinate.y );

        // find intersection with box, possibly terminate early
        float tNear, tFar;
        bool hit = intersectBox( viewPoint, eyeRayDirection, viewBoxMin, viewBoxMax, tNear, tFar );
        if (!hit) {
          return (backgroundRGBA);
        }

        tNear = max(tNear, 0.);
        tNear = max(tNear, viewNear); // near clipping plane

        // march along ray from front, accumulating color and opacity
        vec4 integratedPixel = vec4(0.);
        float tCurrent = tNear;
        float sampleValue;
        int rayStep;
        for(rayStep = 0; rayStep < rayMaxSteps; rayStep++) {

          vec3 samplePoint = viewPoint + eyeRayDirection * tCurrent;

          // this is the code that composites together samples
          // from all the fields in the space
          ${this.fieldCompositingShaderSource()}

          // http://graphicsrunner.blogspot.com/2009/01/volume-rendering-101.html
          if (opacity > 0.) {
            opacity *= sampleStep;
            integratedPixel.rgb += (1. - integratedPixel.a) * opacity * litColor;
            integratedPixel.a += (1. - integratedPixel.a) * opacity;
            integratedPixel = clamp(integratedPixel, 0.0001, 0.9999);
          }

          tCurrent += sampleStep;
          if (
              tCurrent >= tFar  // stepped out of the volume
                ||
              tCurrent >= viewFar // far clip plane
                ||
              integratedPixel.a >= .99  // pixel is saturated
          ) {
            break; // we can stop now
          }
        }
        return(vec4(mix(backgroundRGBA.rgb, integratedPixel.rgb, integratedPixel.a), 1.));
      }

      in vec3 interpolatedTextureCoordinate;
      out vec4 fragmentColor;
      void main()
      {
        fragmentColor = rayCast(interpolatedTextureCoordinate);
      }

    `);
  }
}
