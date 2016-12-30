class GaussianGenerator extends ProgrammaticGenerator {
  // Performs a gaussian filter
  // inputFields are:
  // - 0 grayscale image
  // outputFields are:
  // - 0 new filtered image
  constructor(options={}) {
    super(options);
  }

  updateProgram() {
    // recreate the program and textures for the current field list
    super.updateProgram();
    let gl = this.gl;
  }

  _fragmentShaderSource() {
    console.log ( "Half..." );

    return (`${this.headerSource()}

      // Gaussian
      //
      // Filter inputTexture0 using a gaussian filter.  This is a single pass algorithm,
      // with fixed sigma.
      //


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

      // Number of pixels in each dimension
      uniform ivec3 pixelDimensions;

      // scaling between texture coordinates and pixels, i.e. 1/256.0
      uniform vec3 textureToPixel;

      // integer sampler for first input Field
      uniform isampler3D inputTexture0;

      // output into first Field
      layout(location = 0) out int value;

      // Coordinate of input location, could be resampled elsewhere.
      in vec3 interpolatedTextureCoordinate;

      // Radius
      const int r = 3;
      // Gaussian Kernel, sigma = 5
      float kernel[2*r+1] = float[]( 0.12895603354653198, 0.14251845798601478, 0.15133130724683985, 0.15438840244122673, 0.15133130724683985, 0.14251845798601478, 0.12895603354653198 );

      void doFilter()
      {
          int background = texture(inputTexture0, interpolatedTextureCoordinate).r;
          float accumulator = 0.0;
          for (int i = -r; i <= r; i++) {
            float ikernel = kernel[i + r];
            for (int j = -r; j <= r; j++) {
              float jkernel = kernel[j + r];
              for (int k = -r; k <= r; k++) {
                float kkernel = kernel[k + r];

                vec3 offset = vec3(i,j,k) * textureToPixel;
                vec3 neighbor = interpolatedTextureCoordinate + offset;
                float neighborStrength = float(texture(inputTexture0, neighbor).r);

                accumulator = accumulator + neighborStrength * kkernel * jkernel * ikernel;
            }
          }
        }
        value = int(accumulator); 
      }
      void doPassthrough()
      {
        value = texture(inputTexture0, interpolatedTextureCoordinate).r;
      }
      void main()
      {
        if ( interpolatedTextureCoordinate.x > 0.5 ) {          
          doFilter();
        } else {
          value = 0;
          if ( interpolatedTextureCoordinate.y > 0.7 ) {
            doPassthrough();
          }
        }
      }
 
    `);
  }
}
