class Field {
  constructor(options={}) {
    this.id = Field.nextId;
    this.texture = undefined;
    Field.nextId++;
  }

  samplingShaderSource() {
    // return a string with these functions implemented in GLSL
    return(`
      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        return(samplePoint);
      }
      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
      }
      void sampleField${this.id} (const in sampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue,
                                  out vec3 normal,
                                  out float gradientMagnitude)
      {
      }
    `);
  }

  uniforms() {
    // return an object of the current uniform values
    return({});
  }

  fieldToTexture(gl) {
    // unsure the field data is stored in the texture
    // unit associated with this.id in the gl context
  }
}
Field.nextId = 0; // TODO: for now this is texture unit

class Fiducial {
  constructor(options={}) {
    this.point = options.point || [0.,0.,0.];
    this.radius = options.radius || .1;
  }
}

class FiducialField extends Field {
  constructor(options={}) {
    super(options);
    this.rgba = options.rgba || [1., 0., 0., 0.5];
    this.rgba = this.rgba.map(e=>e*1.00001); // hack to make it floating point
    this.opacityScale = options.opacityScale || 1.;
    this.opacityScale *= 1.00001; // hack to make it floating point
    this.fiducials = options.fiducials || [];
  }

  uniforms() {
    let textureUnit = 'textureUnit'+this.id;
    let u = {};
    u['textureUnit'] = {type: '1i', value: textureUnit};
    return(u);
  }

  fiducialsSource() {
    let source = '';
    this.fiducials.forEach(fiducial => {
      source += `

        centerToSample = samplePoint - vec3( ${fiducial.point[0]}, ${fiducial.point[1]}, ${fiducial.point[2]} );
        distance = length(centerToSample);
        if (distance < ${fiducial.radius}) {
          sampleValue += ${this.rgba[3]};
          normal += normalize(centerToSample);
        }

      `;
    });
    return(source);
  }

  samplingShaderSource() {

    let source = `

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
          return samplePoint; // identity by default
      }

      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
          color = vec3( ${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]} );
          opacity = ${this.opacityScale} * sampleValue * ${this.rgba[3]};
      }

      uniform sampler3D textureUnit${this.id};
      void sampleField${this.id} (const in sampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue,
                                  out vec3 normal,
                                  out float gradientMagnitude)
      {
        // TODO: transform should be associated with the sampling, not the ray point
        //       so that gradient is calculated incorporating transform
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);

        vec3 centerToSample;
        float distance;
        float glow = 1.2;

        // default if sampleValue is not in any fiducial
        sampleValue = 0.;
        normal = vec3(0,0,0);
        gradientMagnitude = 1.;

        ${this.fiducialsSource()}

        normal = normalize(normal);

      }
    `;

    return(source);
  }
}

class PixelField extends Field {
  constructor(options={}) {
    super(options);
    this.dataset = options.dataset || {};
  }

  analyze() {
    // examine the dataset and calculate intermediate values needed for rendering
    // TODO: patientToPixel and related matrices should be generalized to functions.
    // TODO: transfer function parameters could be textures.

    // matrix from sampling space (patient, mm) to STP (0 to 1) texture coordinates
    this.patientToPixel = [
      0.5, 0., 0., 0.,
      0., 0.5, 0., 0.,
      0., 0., 0.5, 0.,
      0.5, 0.5, 0.5, 1.,
    ];

    // the inverse transpose of the upper 3x3 of the pixelToPatient matrix,
    // which is the transpose of the upper 3x3 of the patientToPixel matrix
    this.normalPixelToPatient = [
      1., 0., 0.,
      0., 1., 0.,
      0., 0., 1.,
    ];

    this.textureDimensions = [this.dataset.Columns,
                              this.dataset.Rows,
                              this.dataset.NumberOfFrames];
    this.textureDimensions = this.textureDimensions.map(Number);
  }

  uniforms() {
    // TODO: need to be keyed to id (in a struct)
    let u = {
      normalPixelToPatient: {type: "Matrix3fv", value: this.normalPixelToPatient},
    };
    let patientToPixel = 'patientToPixel'+this.id;
    u[patientToPixel] = {type: "Matrix4fv", value: this.patientToPixel};
    let textureUnit = 'textureUnit'+this.id;
    u['textureUnit'] = {type: '1i', value: textureUnit};
    return(u);
  }

  fieldToTexture(gl) {
    if (this.texture) {gl.deleteTexture(this.texture);}
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAX_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }
}

class ImageField extends PixelField {
  constructor(options={}) {
    super(options);
    this.analyze();
  }

  analyze() {
    super.analyze();
    this.windowCenter = Number(this.dataset.WindowCenter[0]);
    this.windowWidth = Number(this.dataset.WindowWidth[0]);

    if (this.dataset.BitsAllocated != 16) {
      console.error('Can only render 16 bit data');
    }
  }

  uniforms() {
    // TODO: need to be keyed to id (in a struct)

    let u = super.uniforms();
    u.windowCenter = {type: "1f", value: this.windowCenter};
    u.windowWidth = {type: "1f", value: this.windowWidth};
    u.textureUnit = {type: '1i', value: 'textureUnit'+this.id};
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp sampler3D textureUnit${this.id};

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        return(samplePoint);
      }

      uniform float windowCenter;
      uniform float windowWidth;
      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
        float pixelValue = clamp( (sampleValue - (windowCenter-0.5)) / (windowWidth-1.) + .5, 0., 1. );
        color = vec3(pixelValue);
        opacity = 20. * pixelValue;
      }

      uniform mat4 patientToPixel${this.id};
      void sampleField${this.id} (const in sampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue, out vec3 normal,
                                  out float gradientMagnitude)
      {
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);
        //vec3 stpPoint = patientToPixel${this.id}(samplePoint); TODO
        vec3 stpPoint = (patientToPixel${this.id} * vec4(samplePoint, 1.)).xyz;

        if (any(lessThan(stpPoint, vec3(0))) || any(greaterThan(stpPoint,vec3(1)))) {
            sampleValue = 0.;
            gradientMagnitude = 0.;
            return;
        }

        sampleValue = texture(textureUnit, stpPoint).r;

        normal = vec3(0., 0., -1.);
        gradientMagnitude = 0.;
      }
    `);
  }

  fieldToTexture(gl) {

    super.fieldToTexture(gl);
    let imageArray;
    if (this.dataset.PixelRepresentation == 1) {
      imageArray = new Int16Array(this.dataset.PixelData);
    } else {
      imageArray = new Uint16Array(this.dataset.PixelData);
    }
    let imageFloat32Array = Float32Array.from(imageArray);

    let [w,h,d] = this.textureDimensions;
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R32F, w, h, d);
    gl.texSubImage3D(gl.TEXTURE_3D,
                     0, 0, 0, 0, // level, offsets
                     w, h, d,
                     gl.RED, gl.FLOAT, imageFloat32Array);
  }
}

class SegmentationField extends PixelField {
  constructor(options={}) {
    super(options);
    this.analyze();
  }

  analyze() {
    super.analyze();

    if (this.dataset.BitsAllocated != 1) {
      console.warn(this, 'Can only render 1 bit data');
    }
    this.textureDimensions[0] /= 8;
  }

  uniforms() {
    let u = super.uniforms();
    u.packingFactor = {type: '1ui', value: this.textureDimensions[0]};
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp isampler3D textureUnit${this.id};

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        return(samplePoint);
      }

      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
        color = vec3(0., 0., 0.);
        opacity = 0.;
        if (sampleValue > 0.) {
          color = vec3(1., 1., 0.);
          opacity = 10.;
        }
      }

      uniform mat4 patientToPixel${this.id};
      uniform uint packingFactor;
      void sampleField${this.id} (const in isampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue, out vec3 normal,
                                  out float gradientMagnitude)
      {
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);
        //vec3 stpPoint = patientToPixel${this.id}(samplePoint); TODO
        vec3 stpPoint = (patientToPixel${this.id} * vec4(samplePoint, 1.)).xyz;

        if (any(lessThan(stpPoint, vec3(0.))) ||
            any(greaterThan(stpPoint,vec3(1.)))) {
          sampleValue = 0.;
          gradientMagnitude = 0.;
          return;
        }

        uint bitIndex = uint(floor(8.*fract(stpPoint.x*float(packingFactor))));
        uint uintSampleValue = uint(texture(textureUnit, stpPoint).r);
        uint bitValue = (uintSampleValue >> bitIndex) & uint(1);
        sampleValue = float(bitValue);

        normal = vec3(0., 0., -1.);
        gradientMagnitude = 0.;
      }
    `);
  }

  fieldToTexture(gl) {

    let byteArray;
    byteArray = new Uint8Array(this.dataset.PixelData);

    super.fieldToTexture(gl);
    let [w,h,d] = this.textureDimensions;
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8UI, w, h, d);
    gl.texSubImage3D(gl.TEXTURE_3D,
                     0, 0, 0, 0, // level, offsets
                     w, h, d,
                     gl.RED_INTEGER, gl.UNSIGNED_BYTE, byteArray);
  }
}

        /* TODO:
         * use columns of patientToPixel to map gradient sample vectors
         * into pixel (texture) space
         *
        #define S(point) texture(%(textureUnit)s(textureUnit, point)
        // read from 3D texture
        sample = S(stpPoint);
        // central difference sample gradient (P is +1, N is -1)
        float sP00 = S(stpPoint + vec3(%(mmToS)f * gradientSize,0,0));
        float sN00 = S(stpPoint - vec3(%(mmToS)f * gradientSize,0,0));
        float s0P0 = S(stpPoint + vec3(0,%(mmToT)f * gradientSize,0));
        float s0N0 = S(stpPoint - vec3(0,%(mmToT)f * gradientSize,0));
        float s00P = S(stpPoint + vec3(0,0,%(mmToP)f * gradientSize));
        float s00N = S(stpPoint - vec3(0,0,%(mmToP)f * gradientSize));
        #undef S
        // TODO: add Sobel option to filter gradient
        // https://en.wikipedia.org/wiki/Sobel_operator#Extension_to_other_dimensions
        vec3 gradient = vec3( (sP00-sN00),
                              (s0P0-s0N0),
                              (s00P-s00N) );
        gradientMagnitude = length(gradient);
        // https://en.wikipedia.org/wiki/Normal_(geometry)#Transforming_normals
        mat3 normalSTPToRAS = mat3(%(normalSTPToRAS)s);
        vec3 localNormal;
        localNormal = (-1. / gradientMagnitude) * gradient;
        normal = normalize(normalSTPToRAS * localNormal);
         */
