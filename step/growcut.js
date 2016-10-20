class GrowCutGenerator extends ProgrammaticGenerator {
  // Performs on iteration of GrowCut.
  // inputFields are:
  // - 0 grayscale image
  // - 1 current label image
  // - 2 current strength image
  // outputFields are:
  // - 0 new label image
  // - 1 new strength image
  constructor(options={}) {
    super(options);
  }

  updateProgram() {
    // recreate the program and textures for the current field list
    super.updateProgram();
    let gl = this.gl;
  }

  _fragmentShaderSource() {
    return (`${this.headerSource()}
      uniform int iterations;

      // these are the function definitions for sampleVolume* and transferFunction*
      // that define a field at a sample point in space
      ${function() {
          let perFieldSamplingShaderSource = '';
          this.inputFields.forEach(field=>{
            perFieldSamplingShaderSource += field.samplingShaderSource();
          });
          return(perFieldSamplingShaderSource);
        }.bind(this)()
      }

      in vec3 interpolatedTextureCoordinate;
      out int fragmentColor;

      uniform float gradientSize;
      uniform float squiggle;
      uniform isampler3D inputTexture;

      float sampleValue;
      float gradientMagnitude;
      vec3 normal;

      void main()
      {
        fragmentColor = texture(textureUnit${this.inputFields[0].id}, interpolatedTextureCoordinate).r;
        fragmentColor *= int(squiggle * (sin(20.*interpolatedTextureCoordinate.s) + cos(20.*interpolatedTextureCoordinate.t)));
      }
    `);
  }
}
