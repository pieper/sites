class BilateralGenerator extends ProgrammaticGenerator {
  // Performs a bilateral filter
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
    console.log ( "Bilateral brute..." );

    return (`${this.headerSource()}

      // Bilateral
      //
      // Filter inputTexture0 using a bilateral filter.  This is a single pass algorithm,
      // with fixed sigmas for intensity and range.
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
      const float sigma_s = 5.0;
      const float sigma_r = 50.0;
      const float sigma_s2 = sigma_s * sigma_s;
      const float sigma_r2 = sigma_r * sigma_r;
      const float pi = 3.1415926535897932384626433832795;

      float gaussian ( float v, float sigma_squared ) {
        return exp ( - 0.5 * v * v / sigma_squared ) / ( 2.0 * pi * sigma_squared );
      }

      // From https://people.csail.mit.edu/sparis/bf_course/course_notes.pdf
      void doFilter()
      {
        float background = float(texture(inputTexture0, interpolatedTextureCoordinate).r);
        float v = 0.0;
        float w = 0.0;
        for (int i = -r; i <= r; i++) {
          for (int j = -r; j <= r; j++) {
            for (int k = -r; k <= r; k++) {

              vec3 offset = vec3(i,j,k) * textureToPixel;
              float neighbor = float(texture(inputTexture0, interpolatedTextureCoordinate + offset).r);

              float ww = 0.0;
              ww = gaussian ( distance(offset, interpolatedTextureCoordinate), sigma_s2 ) ;
              ww *= gaussian ( background - neighbor, sigma_r2 );
              w += w;
              v += ww * neighbor;
            }
          }
        }
        v = v / w;
        value = int(v); 
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
