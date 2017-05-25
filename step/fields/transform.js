class TransformField extends PixelField {
  constructor(options={}) {
    super(options);
    this.analyze();
  }

  analyze() {
    super.analyze();

  }

  uniforms() {
    // TODO: need to be keyed to id (in a struct)

    let u = super.uniforms();
    return(u);
  }

  samplingShaderSource() {
    return(`
      uniform highp ${this.samplerType} textureUnit${this.id};

      void transferFunction${this.id} (const in float sampleValue,
                                       const in float gradientMagnitude,
                                       out vec3 color,
                                       out float opacity)
      {
        color = vec3(0.5);
        opacity = 0.;
      }

      uniform int visible${this.id};
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
      // TODO
        vec3 stpPoint = patientToTexture${this.id}(patientPoint);
        vec3 displacement = texture(textureUnit, stpPoint).xyz;
      }

      void sampleField${this.id} (const in ${this.samplerType} textureUnit,
                                  const in vec3 samplePointPatient,
                                  const in float gradientSize,
                                  out float sampleValue,
                                  out vec3 normal,
                                  out float gradientMagnitude)
      {
        sampleValue = 0.;
        normal = vec3(0.);
        gradientMagnitude = 0.;
      }
    `);
  }

  fieldToTexture(gl) {
    // allocate and fill a float 3D texture for the image data.
    // cannot be subclassed.
    let needsUpdate = super.fieldToTexture(gl);
    if (needsUpdate) {

      let grid = this.dataset.DeformableRegistrationGrid;
      
      let [w,h,d] = this.pixelDimensions;
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGB32F, w, h, d);
      if (!this.generator) {
        // only transfer the data if there's no generator that will fill it in
        gl.texSubImage3D(gl.TEXTURE_3D,
                         0, 0, 0, 0, // level, offsets
                         w, h, d,
                         gl.RGB, gl.FLOAT, grid.VectorGridData);
      }
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      this.updated();
    }
  }
}
