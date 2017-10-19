class SimilarityGenerator extends FilterGenerator {
  // Performs a similarity filter
  // inputFields are:
  // - 0 grayscale image
  // outputFields are:
  // - 0 new similarity map image
  constructor(options={}) {
    super(options);
    this.options = options.options;
  }

  updateProgram() {
    // recreate the program and textures for the current field list
    super.updateProgram();
    let gl = this.gl;
    this.uniforms.kernelSize = {type: '1i', value: this.options.kernelSize};
    this.uniforms.rotationSamples = {type: '1i', value: this.options.rotationSamples};
  }

  _fragmentShaderSource() {
    console.log ( "Similarity..." );

    return (`${this.headerSource()}

      // Similarity
      //
      // Perform rotation invariant image similarity of kernel sized sample at each pixel
      // - compares 'kernelSize' rectangular patch around 'referenceTextureCoordinate'
      //   to a set of 'rotationSamples' rotated patches around each voxel and creates
      //   a map of the maximum summed differene across the patches.
      // - goal is to create a parametric map where brighter voxels are more likely to
      //   be rididly transformed version of the reference pixel.
      //


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

      // Number of pixels in each dimension
      uniform ivec3 pixelDimensions;

      // scaling between texture coordinates and pixels, i.e. 1/256.0
      uniform vec3 pixelToTexture;

      // integer sampler for first input Field
      uniform ${this.samplerType} inputTexture0;

      // output into first Field
      layout(location = 0) out ${this.bufferType} value;

      // Coordinate of input location
      in vec3 interpolatedTextureCoordinate;

      // parameters
      uniform int kernelSize;
      uniform int rotationSamples;
      uniform vec3 referenceTextureCoordinate;

      // from:
      // https://stackoverflow.com/questions/9600801/evenly-distributing-n-points-on-a-sphere
      vec3 fibonacciSphere(in int rotationSample)
      {
        const float pi = 3.1415926535897932384626433832795;
        const float increment = pi * (3. - sqrt(5.));
        float offset = 2. / float(rotationSamples);
        float offsetOverTwo = offset / 2.;

        float y = ((float(rotationSample) * offset) -1.) + offsetOverTwo;
        float r = sqrt(1. - pow(y,2.));
        float phi = float(rotationSample) * increment;

        return(vec3( r*cos(phi), y, r*sin(phi) ));
      }

      void main()
      {
        // find max across a set of rotation samples
        float maxSimilarity = 0.;
        for (int rotationSample = 0; rotationSample <= rotationSamples; rotationSample++) {
          // make a rotation matrix for each unit sphere surface sample
          vec3 sampleRotation = fibonacciSphere(rotationSample);
          vec3 axis = vec3(1.,0.,0.);
          if (dot(sampleRotation, axis) > .9) {
            vec3 axis = vec3(0., 1., 0.);
          }
          vec3 crossAxis = cross(sampleRotation, axis);
          vec3 crossAxis2 = cross(crossAxis, sampleRotation);
          mat3 rotation = mat3(sampleRotation, crossAxis, crossAxis2);
          // calculate summed absolute difference of rotated patch to reference
          float rotationSampleSimilarity = 0.;
          for (int i = -kernelSize; i <= kernelSize; i++) {
            for (int j = -kernelSize; j <= kernelSize; j++) {
              for (int k = -kernelSize; k <= kernelSize; k++) {
                vec3 offset = vec3(i,j,k) * pixelToTexture;
                vec3 neighbor = interpolatedTextureCoordinate + offset;
                vec3 referenceNeighbor = referenceTextureCoordinate + rotation * offset;
                float neighborStrength = float(texture(inputTexture0, neighbor).r);
                float referenceNeighborStrength = float(texture(inputTexture0, referenceNeighbor).r);
                rotationSampleSimilarity += abs(referenceNeighborStrength - neighborStrength);
              }
            }
          }
          maxSimilarity = max(maxSimilarity, rotationSampleSimilarity);
        }
        value = ${this.bufferType} ( maxSimilarity / 1000. ); // rescale and cast if needed
      }
    `);
  }
}
