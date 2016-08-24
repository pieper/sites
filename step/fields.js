class Field {
  constructor(options={}) {
    this.id = Field.nextId;
    this.texture = undefined;
    this.bounds = undefined; // the spatial extent of the field.
                             // undefined means there is no bound, otherwise
                             // an object with min and max
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
    // ensure the field data is stored in the texture
    // unit associated with this.id in the gl context
    if (this.texture) {gl.deleteTexture(this.texture);}
    this.texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0+this.id);
    gl.bindTexture(gl.TEXTURE_3D, this.texture);
  }

}
Field.nextId = 0; // TODO: for now this is texture unit

Field.fromDataset = function(dataset) {
  switch (dataset.SOPClass) {
    case "CTImage":
    case "MRImage":
    case "EnhancedCTImage":
    case "LegacyConvertedEnhancedCTImage":
    case "UltrasoundMultiframeImage":
    case "MRImage":
    case "EnhancedMRImage":
    case "MRSpectroscopy":
    case "EnhancedMRColorImage":
    case "LegacyConvertedEnhancedMRImage":
    case "UltrasoundImage":
    case "EnhancedUSVolume":
    case "SecondaryCaptureImage":
    case "USImage":
    case "PETImage":
    case "EnhancedPETImage":
    case "LegacyConvertedEnhancedPETImage": {
      return (new ImageField({dataset}));
      }
      break;
    case "Segmentation": {
      return (new SegmentationField({dataset}));
    }
    break;
    default: {
      console.warn('Cannot process this dataset type ', dataset.SOPClass);
    }

   /* TODO
     "Raw Data",
     "Spatial Registration",
     "Spatial Fiducials",
     "Deformable Spatial Registration",
     "Real World Value Mapping",
     "BasicTextSR",
     "EnhancedSR",
     "ComprehensiveSR",
   */
  }
}

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
    u[textureUnit] = {type: '1i', value: this.id};
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

  fieldToTexture(gl) {
    // allocate and fill a dummy texture
    super.fieldToTexture(gl);
    let imageFloat32Array = Float32Array.from([0]);

    let [w,h,d] = [1,1,1];
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R32F, w, h, d);
    gl.texSubImage3D(gl.TEXTURE_3D,
                     0, 0, 0, 0, // level, offsets
                     w, h, d,
                     gl.RED, gl.FLOAT, imageFloat32Array);
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

    this.pixelDimensions = [this.dataset.Columns,
                              this.dataset.Rows,
                              this.dataset.NumberOfFrames].map(Number);

    // matrix from sampling space (patient, mm) to STP (0 to 1) texture coordinates
    let sharedGroups = this.dataset.SharedFunctionalGroups;
    let orientation = sharedGroups.PlaneOrientation.ImageOrientationPatient;
    let columnStepToPatient = vec3.fromValues(...orientation.slice(0,3).map(Number));
    let rowStepToPatient = vec3.fromValues(...orientation.slice(3,6).map(Number));
    let sliceStepToPatient = vec3.create();
    vec3.cross(sliceStepToPatient, rowStepToPatient, columnStepToPatient);

    let spacingBetweenColumns = Number(sharedGroups.PixelMeasures.PixelSpacing[0]);
    let spacingBetweenRows = Number(sharedGroups.PixelMeasures.PixelSpacing[1]);
    let spacingBetweenSlices = Number(sharedGroups.PixelMeasures.SpacingBetweenSlices);

    vec3.scale(columnStepToPatient, columnStepToPatient, spacingBetweenColumns);
    vec3.scale(rowStepToPatient, rowStepToPatient, spacingBetweenRows);
    vec3.scale(sliceStepToPatient, sliceStepToPatient, spacingBetweenSlices);

    let perFrameGroups = this.dataset.PerFrameFunctionalGroups;
    let position0 = perFrameGroups[0].PlanePosition.ImagePositionPatient;
    let origin = vec3.fromValues(...position0.map(Number));
    if (perFrameGroups.length > 1) {
      let position1 = perFrameGroups[1].PlanePosition.ImagePositionPatient;
      position1 = vec3.fromValues(...position1.map(Number));
      let originToPosition1 = vec3.create();
      vec3.subtract(originToPosition1, position1, origin);
      if (vec3.dot(sliceStepToPatient, originToPosition1) < 0) {
        vec3.scale(sliceStepToPatient, sliceStepToPatient, -1.);
      }
    }

    this.pixelToPatient = mat4.fromValues(...columnStepToPatient, 0,
                                          ...rowStepToPatient, 0,
                                          ...sliceStepToPatient, 0,
                                          ...origin, 1);
    let patientToPixel = mat4.create();
    mat4.invert(patientToPixel, this.pixelToPatient);
    this.patientToPixel = patientToPixel.valueOf();

    // TODO:
    // the inverse transpose of the upper 3x3 of the pixelToPatient matrix,
    // which is the transpose of the upper 3x3 of the patientToPixel matrix
    this.normalPixelToPatient = [
      1., 0., 0.,
      0., 1., 0.,
      0., 0., 1.,
    ];


    // the bounds are the outer corners of the very first and very last
    // pixels of the dataset measured in pixel space
    let halfSpacings = vec4.fromValues(0.5, 0.5, 0.5, 0.);
    vec4.transformMat4(halfSpacings, halfSpacings, this.pixelToPatient);
    let firstCorner = vec3.create();
    vec3.subtract(firstCorner, origin, halfSpacings);
    let dimensions = vec4.fromValues(...this.pixelDimensions,1);
    let secondCorner4 = vec4.create();
    vec4.transformMat4(secondCorner4, dimensions, this.pixelToPatient);
    vec4.subtract(secondCorner4, secondCorner4, halfSpacings);
    let secondCorner = vec3.fromValues(...secondCorner4.valueOf().slice(0,3));
    let min = vec3.create();
    let max = vec3.create();
    vec3.min(min, firstCorner, secondCorner);
    vec3.max(max, firstCorner, secondCorner);
    this.bounds = {min : min.valueOf(), max : max.valueOf()};
    let center = vec3.create();
    vec3.add(center, min, max);
    vec3.scale(center, center, 0.5);
    this.center = center.valueOf();
  }

  uniforms() {
    // TODO: need to be keyed to id (in a struct)
    let u = {
      normalPixelToPatient: {type: "Matrix3fv", value: this.normalPixelToPatient},
    };
    let patientToPixel = 'patientToPixel'+this.id;
    u[patientToPixel] = {type: "Matrix4fv", value: this.patientToPixel};
    let textureUnit = 'textureUnit'+this.id;
    u[textureUnit] = {type: '1i', value: this.id};
    let pixelDimensions = 'pixelDimensions'+this.id;
    u[pixelDimensions] = {type: '3iv', value: this.pixelDimensions};
    return(u);
  }

  fieldToTexture(gl) {
    // common texture operations for all pixel-based fields
    super.fieldToTexture(gl);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAX_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
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
    u['windowCenter'+this.id] = {type: "1f", value: this.windowCenter};
    u['windowWidth'+this.id] = {type: "1f", value: this.windowWidth};
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp sampler3D textureUnit${this.id};

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        return(samplePoint);
      }

      uniform float windowCenter${this.id};
      uniform float windowWidth${this.id};
      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
        float pixelValue = clamp( (sampleValue - (windowCenter${this.id}-0.5)) / (windowWidth${this.id}-1.) + .5, 0., 1. );
        color = vec3(pixelValue);
        opacity = 20. * pixelValue;
      }

      uniform mat4 patientToPixel${this.id};
      uniform ivec3 pixelDimensions${this.id};
      void sampleField${this.id} (const in sampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue, out vec3 normal,
                                  out float gradientMagnitude)
      {
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);
        vec3 stpPoint = (patientToPixel${this.id} * vec4(samplePoint, 1.)).xyz;
        stpPoint /= vec3(pixelDimensions${this.id});
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
    // allocate and fill a float 3D texture for the image data
    super.fieldToTexture(gl);
    let imageArray;
    if (this.dataset.PixelRepresentation == 1) {
      imageArray = new Int16Array(this.dataset.PixelData);
    } else {
      imageArray = new Uint16Array(this.dataset.PixelData);
    }
    let imageFloat32Array = new Float32Array(imageArray);

    let [w,h,d] = this.pixelDimensions;
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
    this.pixelDimensions[0] /= 8; // the array size is smaller due to packing
  }

  uniforms() {
    let u = super.uniforms();
    u['packingFactor'+this.id] = {type: '1ui', value: this.pixelDimensions[0]};
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
      uniform ivec3 pixelDimensions${this.id};
      uniform uint packingFactor${this.id};
      void sampleField${this.id} (const in isampler3D textureUnit,
                                  const in vec3 samplePointIn,
                                  const in float gradientSize,
                                  out float sampleValue, out vec3 normal,
                                  out float gradientMagnitude)
      {
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);
        vec3 stpPoint = (patientToPixel${this.id} * vec4(samplePoint, 1.)).xyz;
        stpPoint /= vec3(pixelDimensions${this.id});
        stpPoint.x /= 8.;
        if (any(lessThan(stpPoint, vec3(0.))) ||
            any(greaterThan(stpPoint,vec3(1.)))) {
          sampleValue = 0.;
          gradientMagnitude = 0.;
          return;
        }

        uint bitIndex = uint(floor(8.*fract(stpPoint.x*float(packingFactor${this.id}))));
        uint uintSampleValue = uint(texture(textureUnit, stpPoint).r);
        uint bitValue = (uintSampleValue >> bitIndex) & uint(1);
        sampleValue = float(bitValue);

        normal = vec3(0., 0., -1.);
        gradientMagnitude = 0.;
      }
    `);
  }

  fieldToTexture(gl) {
    // allocate and fill a byte texture of packed mask bits
    super.fieldToTexture(gl);
    let byteArray;
    byteArray = new Uint8Array(this.dataset.PixelData);
    let [w,h,d] = this.pixelDimensions;
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
