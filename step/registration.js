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
    this.uniforms.neighborSearchStepSize = { type: '1f', value: 1 };
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

      uniform float neighborSearchStepSize;

      uniform ${this.samplerType} inputTexture0; // fixed
      uniform ${this.samplerType} inputTexture1; // moving
      uniform ${this.samplerType} inputTexture2; // current deformation

      in vec3 interpolatedTextureCoordinate;

      layout(location = 0) out vec3 deformation; // new deformation

      void main()
      {
        ivec3 size = textureSize(inputTexture0, 0);
        ivec3 texelIndex = ivec3(floor(interpolatedTextureCoordinate * vec3(size)));
        ${this.bufferType} movingValue = texelFetch(inputTexture0, texelIndex, 1).r;
        ${this.bufferType} neighborValue;
        float minNeighborDifference = 1e100; // effectively inf
        vec3 minNeighborDirection = vec3(0);

        // first, average the displacements at all neighbors to get current averaged step
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

        // second, look at neighborhood of fixed image around where moving point is currently displaced to
        // to see if there is a neighbor that better matches the moving value
        // - for now, just look at image intensity
        vec3 patientMovingPoint = textureToPatient${this.inputFields[0].id}(interpolatedTextureCoordinate);
        vec3 movedPoint = patientMovingPoint + accumulatedDisplacement;

        for (int k = -1; k <= 1; k++) {
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec3 neighorDirection = neighborSearchStepSize * vec3(i,j,k);
              vec3 neighorPoint = neighorDirection + movedPoint;
              vec3 neighborTextureCoordinate = patientToTexture${this.inputFields[1].id}(neighorPoint);
              neighborValue = texture(inputTexture1, neighborTextureCoordinate).r;
              float neighborDifference = abs(neighborValue - movingValue);
              if (neighborDifference < minNeighborDifference) {
                minNeighborDifference = neighborDifference;
                minNeighborDirection = neighorDirection;
              }
            }
          }
        }

        //deformation = accumulatedDisplacement + minNeighborDirection;
        deformation = minNeighborDirection;

        if (iteration == 0) {
          // ignore any initial deformation
          deformation = vec3(0.);
        }

      }
    `);
  }
}
