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
    this.uniforms.iteration = { type: '1i', value: 0 };
    this.uniforms.iterations = { type: '1i', value: 0 };
  }

  updateProgram() {
    // recreate the program and textures for the current field list
    super.updateProgram();
    let gl = this.gl;
  }

  _fragmentShaderSource() {
    return (`${this.headerSource()}
      // these are the function definitions for sampleVolume*
      // and transferFunction*
      // that define a field at a sample point in space
      ${function() {
          let perFieldSamplingShaderSource = '';
          this.inputFields.forEach(field=>{
            perFieldSamplingShaderSource += field.samplingShaderSource();
          });
          return(perFieldSamplingShaderSource);
        }.bind(this)()
      }

      #define MAX_STRENGTH 10000

      uniform int iterations;
      uniform int iteration;
      uniform ivec3 pixelDimensions;
      uniform vec3 textureToPixel;

      uniform isampler3D inputTexture0; // background
      uniform isampler3D inputTexture1; // label
      uniform isampler3D inputTexture2; // strength

      in vec3 interpolatedTextureCoordinate;

      layout(location = 0) out int label;
      layout(location = 1) out int strength;

      void main()
      {
        int background =
              texture(inputTexture0, interpolatedTextureCoordinate).r;
        if (iteration == 0) {
          if (background < 0) {
            label = 100;
            strength = MAX_STRENGTH;
          } else if (background > 500) {
            label = 2000;
            strength = MAX_STRENGTH;
          } else {
            label = 0;
            strength = 0;
          }
        } else {
          int currentLabel =
                texture(inputTexture1, interpolatedTextureCoordinate).r;
          int currentStrength =
                texture(inputTexture2, interpolatedTextureCoordinate).r;
          for (int k = -1; k <= 1; k++) {
            for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                vec3 offset = vec3(k,j,i) * textureToPixel;
                vec3 neighbor = interpolatedTextureCoordinate + offset;
                int neighborStrength =
                      texture(inputTexture2, neighbor).r;
                int strengthCost = abs(neighborStrength - currentStrength);
                if (neighborStrength - strengthCost > currentStrength) {
                  strength = neighborStrength - strengthCost;
                  label = texture(inputTexture1, neighbor).r;
                } else {
                  strength = currentStrength;
                  label = currentLabel;
                }
              }
            }
          }
        }
      }
    `);
  }
}
