class RegistrationGenerator extends ProgrammaticGenerator {
  // Performs on iteration of deformable registration
  // inputFields are:
  // - 0 fixed image
  // - 1 moving image
  // - 2 current deformation of moving image
  // outputFields are:
  // - 0 new deformation
  constructor(options={}) {
    super(options);
    this.uniforms.iteration = { type: '1i', value: 0 };
    this.uniforms.iterations = { type: '1i', value: 0 };
  }

  headerSource() {
    return (`${super.headerSource()}
      const int sliceMode = 1; // used for texture sampling (get value not transfer function)
    `);
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
            perFieldSamplingShaderSource += field.transformShaderSource();
            perFieldSamplingShaderSource += field.samplingShaderSource();
          });
          return(perFieldSamplingShaderSource);
        }.bind(this)()
      }

      uniform int iteration;
      uniform int iterations;

      uniform float stepSize;

      uniform ${this.samplerType} inputTexture0; // fixed
      uniform ${this.samplerType} inputTexture1; // moving
      uniform ${this.samplerType} inputTexture2; // current deformation

      in vec3 interpolatedTextureCoordinate;

      layout(location = 0) out vec3 deformation; // new deformation

      void main()
      {
        ivec3 size = textureSize(inputTexture0, 0);
        ivec3 texelIndex = ivec3(floor(interpolatedTextureCoordinate * vec3(size)));
        ${this.bufferType} background = texelFetch(inputTexture0, texelIndex, 0).r;

        // first, average the displacements at all neighbors to get estimated step
        vec3 accumulatedDisplacement = vec3(0.);
        for (int k = -1; k <= 1; k++) {
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              ivec3 neighborIndex = texelIndex + ivec3(i,j,k);
              accumulatedDisplacement += texelFetch(inputTexture2, neighborIndex, 0).xyz;
            }
          }
        }
        accumulatedDisplacement /= 27.;

        // second, look at neighborhood around estimated step to see if there is a place you match better
        // - for now, just look at image intensity

        //deformation = vec3(accumulatedDisplacement + vec3(texelIndex)).r; // stub for testing
        deformation = float(iteration)/float(iterations) * 50. * interpolatedTextureCoordinate;

      }
    `);
  }
}
