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
                                  const in vec3 samplePointPatient,
                                  const in float gradientSize,
                                  out float sampleValue, out vec3 normal,
                                  out float gradientMagnitude)
      {
        vec3 samplePoint = transformPoint${this.id}(samplePointPatient);
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
