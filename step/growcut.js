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
      uniform int iterations;
      uniform int iteration;

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
      layout(location = 0) out int label;
      layout(location = 1) out int strength;

      uniform isampler3D inputTexture0;
      uniform isampler3D inputTexture1;

      void main()
      {
        vec3 labelSource = interpolatedTextureCoordinate - 
                              float(iteration)*vec3(0., .01, -.01);
        strength = texture(inputTexture0, interpolatedTextureCoordinate).r;
        label = strength + texture(inputTexture1, labelSource).r;
      }
    `);
  }
}
