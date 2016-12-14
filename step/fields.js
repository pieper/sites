class Field {
  constructor(options={}) {
    this.id = Field.nextId;
    this.texture = undefined;
    this.modifiedTime = Number.MAX_VALUE;
    this.updatedTime = 0;
    this.bounds = undefined; // the spatial extent of the field.
                             // undefined means there is no bound, otherwise
                             // an object with min and max
    this.visible = 1;
    this.generator = undefined;

    this.intTextureSupport = INT_TEXTURE_SUPPORT; //TODO
    if (this.intTextureSupport) {
      this.samplerType = "isampler3D";
    } else {
      this.samplerType = "sampler3D";
    }

    Field.nextId++;
  }

  // user of this class is responsible for calling modified
  // after making changes that require updating the gl representation
  modified() {
    this.modifiedTime = performance.now(); // TODO: maybe use incrementing Number
  }

  updated() {
    this.updatedTime = performance.now();
  }

  needsUpdate() {
    return this.updatedTime < this.modifiedTime;
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
      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
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
    let u = {};
    u['visible'+this.id] = {type: '1i', value: this.visible};
    u['textureUnit'+this.id] = {type: '1i', value: this.id};
    return(u);
  }

  fieldToTexture(gl) {
    // ensure the field data is stored in the texture
    // unit associated with this.id in the gl context
    // returns true if subclass also needs to update.
    // Final child class should call this.updated().
    let needsUpdate = this.needsUpdate();
    if (needsUpdate) {
      if (this.texture) {
        gl.deleteTexture(this.texture);
      }
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0+this.id);
      gl.bindTexture(gl.TEXTURE_3D, this.texture);
    }
    return needsUpdate;
  }

}
Field.nextId = 0; // TODO: for now this is texture unit

// array of fields from dataset
Field.fromDataset = function(dataset) {
  let fields = [];
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
      fields = [new ImageField({dataset})];
      }
      break;
    case "Segmentation": {
      fields = SegmentationField.fieldsFromDataset({dataset});
    }
    break;
    default: {
      console.error('Cannot process this dataset type ', dataset);
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
  return (fields);
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
    let u = super.uniforms();
    return(u);
  }

  fiducialsSource() {
    let source = '';
    this.fiducials.forEach(fiducial => {
      source += `

        centerToSample = samplePoint - vec3(
                ${fiducial.point[0]}, ${fiducial.point[1]}, ${fiducial.point[2]} );
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

      uniform ${this.samplerType} textureUnit${this.id};
      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
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
    let needsUpdate = super.fieldToTexture(gl);

    if (needsUpdate) {
      let imageFloat32Array = Float32Array.from([0]);

      let [w,h,d] = [1,1,1];
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R32F, w, h, d);
      gl.texSubImage3D(gl.TEXTURE_3D,
                       0, 0, 0, 0, // level, offsets
                       w, h, d,
                       gl.RED, gl.FLOAT, imageFloat32Array);
      this.updated();
    }
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
    u['pixelDimensions'+this.id] = {type: '3iv', value: this.pixelDimensions};
    let textureToPixel = this.pixelDimensions.map(e=>1./e).reverse();
    u['textureToPixel'+this.id] = {type: '3fv', value: textureToPixel};
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
        float pixelValue = clamp( (sampleValue - (windowCenter${this.id}-0.5)) / (windowWidth${this.id}-1.) + .5, 0., 1. );
        color = vec3(pixelValue);
        opacity = 20. * pixelValue;
      }

      uniform int visible${this.id};
      uniform float rescaleIntercept${this.id};
      uniform float rescaleSlope${this.id};
      uniform mat4 patientToPixel${this.id};
      uniform mat3 normalPixelToPatient${this.id};
      uniform ivec3 pixelDimensions${this.id};
      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
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

        sampleValue = float(texture(textureUnit, stpPoint).r);
        sampleValue = rescaleSlope${this.id} * sampleValue + rescaleIntercept${this.id};

        #define V(point, offset, column) float(texture(textureUnit, point+offset*patientToPixel${this.id}[column].xyz).r)
        #define S(point, offset, column) rescaleSlope${this.id} * V(point,offset,column) + rescaleIntercept${this.id}
        // central difference sample gradient (P is +1, N is -1)
        float sP00 = S(stpPoint, 1. * gradientSize, 0);
        float sN00 = S(stpPoint, -1. * gradientSize, 0);
        float s0P0 = S(stpPoint, 1. * gradientSize, 1);
        float s0N0 = S(stpPoint, -1. * gradientSize, 1);
        float s00P = S(stpPoint, 1. * gradientSize, 2);
        float s00N = S(stpPoint, -1. * gradientSize, 2);
        #undef V
        #undef S

        // TODO: add Sobel and/or multiscale gradients
        vec3 gradient = vec3( (sP00-sN00),
                              (s0P0-s0N0),
                              (s00P-s00N) );
        gradientMagnitude = length(gradient);
        // https://en.wikipedia.org/wiki/Normal_(geometry)#Transforming_normals
        vec3 localNormal = (-1. / gradientMagnitude) * gradient;
        normal = normalize(normalPixelToPatient${this.id} * localNormal);
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
      let pixelFormat;
      let pixelTarget;
      let pixelType;
      if (this.intTextureSupport) {
        imageTextureArray = new Int16Array(imageArray);
        pixelFormat = gl.R16I;
        pixelTarget = gl.RED_INTEGER;
        pixelType = gl.SHORT;
      } else {
        imageTextureArray = new Float32Array(imageArray);
        pixelFormat = gl.R32F;
        pixelTarget = gl.RED;
        pixelType = gl.FLOAT;
      }

      let [w,h,d] = this.pixelDimensions;
      gl.texStorage3D(gl.TEXTURE_3D, 1, pixelFormat, w, h, d);
      if (!this.generator) {
        // only transfer the data if there's no generator that will fill it in
        gl.texSubImage3D(gl.TEXTURE_3D,
                         0, 0, 0, 0, // level, offsets
                         w, h, d,
                         pixelTarget, pixelType, imageTextureArray);
      }
      this.updated();
    }
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
    let sharedGroups = this.dataset.SharedFunctionalGroups;
    let pixelMeasures = sharedGroups.PixelMeasures;
    if (pixelMeasures.SpacingBetweenSlices != pixelMeasures.SliceThickness) {
      console.warn('SpacingBetweenSlices and SliceThickness should be equal for SEG');
      console.warn(pixelMeasures.SpacingBetweenSlices + ' != ' + pixelMeasures.SliceThickness);
    }
    this.pixelDimensions[0] /= 8; // the array size is smaller due to packing
    this.rgb = Colors.dicomlab2RGB(this.dataset.Segment[0].RecommendedDisplayCIELabValue);
  }

  uniforms() {
    let u = super.uniforms();
    u['packingFactor'+this.id] = {type: '1ui', value: this.pixelDimensions[0]};
    u['rgb'+this.id] = {type: '3fv', value: this.rgb};
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp ${this.samplerType} textureUnit${this.id};

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        return(samplePoint);
      }

      uniform vec3 rgb${this.id};
      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
        color = vec3(0., 0., 0.);
        opacity = 0.;
        if (sampleValue > 0.) {
          color = rgb${this.id};
          opacity = 10.;
        }
      }

      uniform int visible${this.id};
      uniform mat4 patientToPixel${this.id};
      uniform ivec3 pixelDimensions${this.id};
      uniform uint packingFactor${this.id};
      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
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
    // cannot be subclassed.
    let needsUpdate = super.fieldToTexture(gl);

    if (needsUpdate) {
      let [w,h,d] = this.pixelDimensions;
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8UI, w, h, d);
      // Each row of the texture needs to be a mulitple of the
      // unpack size, which is typically 4 and cannot be changed
      // in webgl.  So we load the texture a row at a time
      // using the first part of the next row as padding.
      // For the last row we need to copy over the contents
      // into a new buffer of the correct size.
      //https://groups.google.com/forum/#!topic/webgl-dev-list/wuUZP7iTr9Q
      // TODO: this could be needed for any texture but it's not likely.
      let unpackAlignment = gl.getParameter(gl.UNPACK_ALIGNMENT);
      let paddedRowSize = Math.floor((w + unpackAlignment - 1) / unpackAlignment)
                            * unpackAlignment;
      let rowByteArray;
      for (let slice = 0; slice < d; slice++) {
        for (let row = 0; row < h; row++) {
          let rowStart = slice * (w*h) + row * w;
          if (slice == d-1 && row == h-1) {
            let lastRow = new Uint8Array(w);
            rowByteArray = new Uint8Array(paddedRowSize);
            for (let column = 0; column < w; column++) {
              rowByteArray[column] = lastRow[column];
            }
          } else {
            rowByteArray = new Uint8Array(this.dataset.PixelData, rowStart, paddedRowSize);
          }
          gl.texSubImage3D(gl.TEXTURE_3D,
                           0, // level, offsets
                           0, row, slice,
                           w, 1, 1,
                           gl.RED_INTEGER, gl.UNSIGNED_BYTE, rowByteArray);
        }
      }
      this.updated();
    }
  }
}

SegmentationField.fieldsFromDataset = function(options) {
  // make one dataset per segment and a corresponding field
  // Always use 1-based indexing for segmentNumber
  if (!options.dataset) {
    return [];
  }
  if (options.dataset.NumberOfFrames != options.dataset.PerFrameFunctionalGroups.length) {
    console.error('Number of frames does not match number of functional groups');
  }
  let fields = [];
  // first, make a new dataset per segment
  let segmentDatasets = ["Empty Dataset 0"];
  let jsonDataset = JSON.stringify(options.dataset);
  let segments = options.dataset.Segment;
  if (!(segments.length > 0)) {
    segments = [options.dataset.Segment];
  }
  segments.forEach(segment => {
    let segmentDataset = JSON.parse(jsonDataset);
    segmentDataset.Segment = [segment];
    segmentDatasets.push(segmentDataset);
  });
  // next make a list of frames per segment
  let segmentGroupLists = ["Empty GroupList 0"];
  options.dataset.PerFrameFunctionalGroups.forEach(functionalGroup => {
    let segmentNumber = functionalGroup.SegmentIdentification.ReferencedSegmentNumber;
    if (!segmentGroupLists[segmentNumber]) {
      segmentGroupLists[segmentNumber] = [];
    }
    // this will be segment 1 of new dataset
    functionalGroup.SegmentIdentification.ReferencedSegmentNumber = 1;
    segmentGroupLists[segmentNumber].push(functionalGroup);
  });
  // determine per-segment index into the pixel data
  // TODO: only handles one-bit-per pixel, last byte padded
  let frameSize = Math.ceil(options.dataset.Rows * options.dataset.Columns / 8);
  let segmentOffsets = ["Empty offset 0", 0];
  let segmentSizes = ["Empty size 0"];
  segmentGroupLists.slice(1).forEach(segmentGroupList => {
    let previousOffset = segmentOffsets[segmentOffsets.length-1];
    let numberOfFrames = segmentGroupList.length;
    segmentOffsets.push(previousOffset + frameSize * numberOfFrames);
    segmentSizes.push(frameSize * numberOfFrames);
  });
  // Now make new per-frame functional groups and pixel data for each dataset
  // (skipping the first known-to-be-empty segment)
  // TODO: assumes frames are sorted and first frame is origin WRT slice direction
  let segmentNumber = 1;
  segmentGroupLists.slice(1).forEach(segmentGroupList => {
    let dataset = segmentDatasets[segmentNumber];
    dataset.PerFrameFunctionalGroups = segmentGroupList;
    let begin = segmentOffsets[segmentNumber];
    let end = begin + segmentSizes[segmentNumber];
    dataset.NumberOfFrames = segmentGroupLists[segmentNumber].length;
    dataset.PixelData = options.dataset.PixelData.slice(begin, end);
    fields.push(new SegmentationField({dataset}));
    segmentNumber++;
  });
  return (fields);
}
