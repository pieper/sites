class GaborGenerator extends FilterGenerator {
  // Performs a similarity filter
  // inputFields are:
  // - (None)
  // outputFields are:
  // - 0 new gabor filter based on the parameters
  constructor(options={}) {
    super(options);
    this.options = options.options;
  }

  updateProgram() {
    // recreate the program and textures for the current field list
    super.updateProgram();
    let gl = this.gl;
    this.uniforms.sigma = {type: '1f', value: this.options.sigma};
    this.uniforms.frequency = {type: '1f', value: this.options.frequency};
    this.uniforms.phase = {type: '1f', value: this.options.phase};
    this.uniforms.kernelSize = {type: '1i', value: this.options.kernelSize};
  }

  _fragmentShaderSource() {
    console.log ( "Gabor..." );

    return (`${this.headerSource()}

      // Gabor
      //
      // Implement a 3D Gabor filter
      //

      // consts
      const bool REAL = true;
      const float PI = 3.1415926;

      // output into first Field
      layout(location = 0) out ${this.bufferType} value;

      // Coordinate of input location
      in vec3 interpolatedTextureCoordinate;

      // parameters
      uniform int kernelSize;
      uniform float sigma;
      uniform float frequency;
      uniform float phase;

      // based on http://www.insight-journal.org/browse/publication/150
      float gaborEvaluate(in float u) {
        float envelope = exp( -0.5 * u/sigma * u/sigma );
        float angle = 2.0 * PI * frequency * u + phase;
        if (REAL) {
          return( envelope * cos(angle) );
        } else {
          return( envelope * sin(angle) );
        }
      }

      void main()
      {
        const vec3 center = vec3(0.5);
        float signal, gaussian, waves;

        gaussian = exp( -0.5 * ( pow(interpolatedTextureCoordinate.x - center.x, 2.) +
                               pow(interpolatedTextureCoordinate.y - center.y, 2.) +
                               pow(interpolatedTextureCoordinate.z - center.z, 2.) ) / sigma );

        waves = gaborEvaluate( interpolatedTextureCoordinate.x - center.x );
        
        signal = gaussian * waves;

        value = ${this.bufferType} (1000. * signal);
      }
    `);
  }
}
