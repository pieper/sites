class Field {
  constructor(options={}) {
    this.useIntegerTextures = Field.useIntegerTextures;
    this.id = Field.nextId;
    this.texture = undefined;
    this.modifiedTime = Number.MAX_VALUE;
    this.updatedTime = 0;
    this.bounds = undefined; // the spatial extent of the field.
                             // undefined means there is no bound, otherwise
                             // an object with min and max
    this.visible = 1; // integer so it can be passed as a uniform
    this.spinMultiplier = 0.1; // for transform testing
    this.generator = undefined; // the generator that populates the texture
    this.transformField = undefined; // the field that defines the deformation

    if (this.useIntegerTextures) {
      this.samplerType = "isampler3D";
    } else {
      this.samplerType = "sampler3D";
    }

    Field.nextId++; // keep track of IDs statically for class
  }

  analyze() {
    // calculate things like bounds from the constructor input
    // - this method is called by the final concrete subtype and
    //   every subclass calls the superclass
  }

  // user of this class is responsible for calling modified
  // after making changes that require updating the gl representation
  modified() {
    this.modifiedTime = window.performance.now(); // TODO: maybe use incrementing Number
  }

  updated() {
    this.updatedTime = window.performance.now();
  }

  needsUpdate() {
    return this.updatedTime < this.modifiedTime;
  }

  // ShaderSources return a string with these functions implemented in GLSL
  transformShaderSource() {
    return(`
    uniform float spinMultiplier${this.id};
    mat4 rotationMatrix${this.id}(vec3 ax, float angle)
    {
      ax = normalize(ax);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;

      return mat4(
        oc * ax.x * ax.x + c, oc * ax.x * ax.y - ax.z * s,  oc * ax.z * ax.x + ax.y * s,  0.0,
        oc * ax.x * ax.y + ax.z * s,  oc * ax.y * ax.y + c, oc * ax.y * ax.z - ax.x * s,  0.0,
        oc * ax.z * ax.x - ax.y * s,  oc * ax.y * ax.z + ax.x * s,  oc * ax.z * ax.z + c, 0.0,
        0.0,  0.0,  0.0,  1.0);
    }

    vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
        mat4 spin = rotationMatrix${this.id}(vec3(1.), spinMultiplier${this.id} * samplePoint.z);
        vec3 newPoint = (spin * vec4(samplePoint,1.)).xyz;
        return(newPoint);
      }
    `);
  }

  samplingShaderSource() {
    // return a string with these functions implemented in GLSL
    return(`
      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
      }
      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
                                  const in vec3 samplePointPatient,
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
    u['spinMultiplier'+this.id] = {type: '1f', value: this.spinMultiplier};
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
Field.useIntegerTextures = false; // default, but possibly overridden based on gl env

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
    case "DeformableSpatialRegistration": {
      fields = [new TransformField({dataset})];
    }
    break;
    default: {
      console.error('Cannot process this dataset type ', dataset);
    }

   /* TODO
     "Raw Data",
     "Spatial Registration",
     "Spatial Fiducials",
     "Real World Value Mapping",
     "BasicTextSR",
     "EnhancedSR",
     "ComprehensiveSR",
   */
  }
  return (fields);
}
