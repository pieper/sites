class PixelField extends Field {
  constructor(options={}) {
    super(options);
    this.dataset = options.dataset || {};
  }

  analyze() {
    super.analyze();
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

    let pixelMeasures = sharedGroups.PixelMeasures;
    let spacingBetweenColumns = Number(pixelMeasures.PixelSpacing[0]);
    let spacingBetweenRows = Number(pixelMeasures.PixelSpacing[1]);
    let spacingBetweenSlices = Number(pixelMeasures.SpacingBetweenSlices);

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
    let p = this.patientToPixel;
    this.normalPixelToPatient = [
      p[0][0], p[0][1], p[0][2],
      p[1][0], p[1][1], p[1][2],
      p[2][0], p[2][1], p[2][2],
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
    let u = super.uniforms();
    u['normalPixelToPatient'+this.id] = {type: "Matrix3fv", value: this.normalPixelToPatient},
    u['patientToPixel'+this.id] = {type: "Matrix4fv", value: this.patientToPixel};
    u['pixelToPatient'+this.id] = {type: "Matrix4fv", value: this.pixelToPatient};
    u['pixelDimensions'+this.id] = {type: '3iv', value: this.pixelDimensions};
    let pixelToTexture = this.pixelDimensions.map(e=>1./e).reverse();
    u['pixelToTexture'+this.id] = {type: '3fv', value: pixelToTexture};
    return(u);
  }

  fieldToTexture(gl) {
    // common texture operations for all pixel-based fields
    let needsUpdate = super.fieldToTexture(gl);
    if (needsUpdate) {
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_BASE_LEVEL, 0);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAX_LEVEL, 0);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }
    return needsUpdate;
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
    this.rescaleIntercept = Number(this.dataset.RescaleIntercept);
    this.rescaleSlope = Number(this.dataset.RescaleSlope);

    if (this.dataset.BitsAllocated != 16) {
      console.error('Can only render 16 bit data');
    }
  }

  statistics(options={}) {
    let statistics = {};
    statistics.bins = options.bins || 256;
    let samples = options.samples || 1000;

    let imageArray;
    if (this.dataset.PixelRepresentation == 1) {
      imageArray = new Int16Array(this.dataset.PixelData);
    } else {
      imageArray = new Uint16Array(this.dataset.PixelData);
    }

    let min = 3e38;
    let max = -3e38;
    for (let index = 0; index < samples; index++) {
      let sampleIndex = Math.floor(imageArray.length * Math.random());
      min = Math.min(min, imageArray[sampleIndex]);
      max = Math.max(max, imageArray[sampleIndex]);
    }
    statistics.range = {min, max};

    let histogram = new Int32Array(statistics.bins);
    let binScale = statistics.bins / (max - min);
    for (let index = 0; index < samples; index++) {
      let sampleIndex = Math.floor(imageArray.length * Math.random());
      let bin = Math.floor((imageArray[sampleIndex] - min) * binScale);
      histogram[bin] += 1;
    }
    statistics.histogram = histogram;

    statistics.maxBin = 0;
    statistics.maxBinValue = 0;
    for (let bin = 0; bin < statistics.bins; bin++) {
      if (statistics.histogram[bin] > statistics.maxBinValue) {
        statistics.maxBin = bin;
        statistics.maxBinValue = statistics.histogram[bin];
      }
    }

    return(statistics);
  }

  uniforms() {
    // TODO: need to be keyed to id (in a struct)

    let u = super.uniforms();
    u['windowCenter'+this.id] = {type: "1f", value: this.windowCenter};
    u['windowWidth'+this.id] = {type: "1f", value: this.windowWidth};
    u['rescaleSlope'+this.id] = {type: "1f", value: this.rescaleSlope};
    u['rescaleIntercept'+this.id] = {type: "1f", value: this.rescaleIntercept};
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp ${this.samplerType} textureUnit${this.id};

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
        float pixelValue = 0.5 +
                (sampleValue - (windowCenter${this.id}-0.5))
                  / (windowWidth${this.id}-1.);
        pixelValue = clamp( pixelValue, 0., 1. );
        color = vec3(pixelValue);
        opacity = gradientMagnitude * pixelValue / 1000.; // TODO
      }

      uniform int visible${this.id};
      uniform float rescaleIntercept${this.id};
      uniform float rescaleSlope${this.id};
      uniform mat4 patientToPixel${this.id};
      uniform mat4 pixelToPatient${this.id};
      uniform mat3 normalPixelToPatient${this.id};
      uniform ivec3 pixelDimensions${this.id};

      vec3 patientToTexture${this.id}(const in vec3 patientPoint)
      {
        // stpPoint is in 0-1 texture coordinates, meaning that it
        // is the patientToPixel transform scaled by the inverse
        // pixel dimensions.
        vec3 pixelDimensions = vec3(pixelDimensions${this.id});
        vec3 dimensionsInverse = vec3(1.) / pixelDimensions;
        vec3 stpPoint = (patientToPixel${this.id} * vec4(patientPoint, 1.)).xyz;
        stpPoint *= dimensionsInverse;
        return(stpPoint);
      }

      vec3 textureToPatient${this.id}(const in vec3 stpPoint)
      {
        // inverse operation of patientToTexture
        vec3 pixelDimensions = vec3(pixelDimensions${this.id});
        vec3 patientPoint = (pixelToPatient${this.id} * vec4(pixelDimensions * stpPoint, 1.)).xyz;
        return(patientPoint);
      }

      void sampleTexture${this.id}(const in ${this.samplerType} textureUnit,
                                   const in vec3 patientPoint,
                                   const in float gradientSize,
                                   out float sampleValue,
                                   out vec3 normal,
                                   out float gradientMagnitude)
      {

        #define RESCALE(s) (rescaleSlope${this.id} * (s) + rescaleIntercept${this.id})
        #define SAMPLE(p) RESCALE(float( texture(textureUnit, p).r ))

        vec3 stpPoint = patientToTexture${this.id}(patientPoint);
        sampleValue = SAMPLE(stpPoint);

        // central difference sample gradient (P is +1, N is -1)
        // p : point in patient space
        // o : offset vector in patient space along dimension
        vec3 sN = vec3(0.);
        vec3 sP = vec3(0.);
        vec3 offset = vec3(0.);
        for (int i = 0; i < 3; i++) {
          offset[i] = gradientSize;
          sP[i] = SAMPLE(patientToTexture${this.id}(patientPoint + offset));
          offset[i] = -gradientSize;
          sN[i] = SAMPLE(patientToTexture${this.id}(patientPoint + offset));
          offset[i] = 0.;
        }
        vec3 gradient = vec3( (sP[0]-sN[0]),
                              (sP[1]-sN[1]),
                              (sP[2]-sN[2]) );
        gradientMagnitude = length(gradient);
        normal = gradient * 1./gradientMagnitude;

        #undef SAMPLE
        #undef RESCALE
      }

      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
                                  const in vec3 samplePointPatient,
                                  const in float gradientSize,
                                  out float sampleValue,
                                  out vec3 normal,
                                  out float gradientMagnitude)
      {
        // samplePoint is in patient coordinates, stp is texture coordinates
        vec3 samplePoint = transformPoint${this.id}(samplePointPatient);
        vec3 stpPoint = patientToTexture${this.id}(samplePoint);

        // trivial reject outside
        if (any(lessThan(stpPoint, vec3(0.)))
             || any(greaterThan(stpPoint,vec3(1.)))) {
          sampleValue = 0.;
          normal = vec3(0.);
          gradientMagnitude = 0.;
        } else {
          sampleTexture${this.id}(textureUnit, samplePoint, gradientSize,
                                  sampleValue, normal, gradientMagnitude);
        }
      }
    `);
  }

  fieldToTexture(gl) {
    // allocate and fill a float 3D texture for the image data.
    // cannot be subclassed.
    let needsUpdate = super.fieldToTexture(gl);
    if (needsUpdate) {
      let imageArray;
      if (this.dataset.PixelRepresentation == 1) {
        imageArray = new Int16Array(this.dataset.PixelData);
      } else {
        imageArray = new Uint16Array(this.dataset.PixelData);
      }

      let imageTextureArray;
      let pixelInternalFormat; // format of the target texture
      let pixelFormat; // format of the passed array
      let pixelType; // data type of passed array
      let textureFilters;
      if (this.useIntegerTextures) {
        imageTextureArray = new Int16Array(imageArray);
        pixelInternalFormat = gl.R16I;
        pixelFormat = gl.RED_INTEGER;
        pixelType = gl.SHORT;
        textureFilters = gl.NEAREST;
      } else {
        imageTextureArray = new Float32Array(imageArray);
        pixelInternalFormat = gl.R16F;
        pixelFormat = gl.RED;
        pixelType = gl.FLOAT;
        textureFilters = gl.LINEAR;
      }

      let [w,h,d] = this.pixelDimensions;
      gl.texStorage3D(gl.TEXTURE_3D, 1, pixelInternalFormat, w, h, d);
      if (!this.generator) {
        // only transfer the data if there's no generator that will fill it in
        gl.texSubImage3D(gl.TEXTURE_3D,
                         0, 0, 0, 0, // level, offsets
                         w, h, d,
                         pixelFormat, pixelType, imageTextureArray);
      }
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, textureFilters);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, textureFilters);
      this.updated();
    }
  }
}
