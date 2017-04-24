class RasterizerGenerator extends ProgrammaticGenerator {
  // Rasterizes a set if input fields into an output field
  // outputField 0 is the composited image
  // at each pixel, output is the max of all input fields.
  // The rasterizer is meant for combining multiple segment
  // fields into a label map (e.g. as input to GrowCut).
  constructor(options={}) {
    super(options);
    this.outputField = this.outputFields[0];
    let pixelDimensions = this.outputField.pixelDimensions;
    let u = this.uniforms;
    u['pixelDimensions'] = {type: '3iv', value: pixelDimensions};
  }

  _fragmentShaderSource() {
    return (`${this.headerSource()}

      // this block sets up the sampling functions code per input field
      // and the output field to get the transform to patient space
      ${function() {
          let perFieldSamplingShaderSource = '';
          this.inputFields.forEach(field=>{
            perFieldSamplingShaderSource += field.transformShaderSource();
            perFieldSamplingShaderSource += field.samplingShaderSource();
          });
          perFieldSamplingShaderSource += this.outputField.samplingShaderSource();
          return(perFieldSamplingShaderSource);
        }.bind(this)()
      }

      in vec3 interpolatedTextureCoordinate;

      layout(location = 0) out int composited;

      void main()
      {
        vec3 pixelCoordinate = interpolatedTextureCoordinate *
                                vec3(pixelDimensions${this.outputField.id});
        mat4 pixelToPatient = inverse(patientToPixel${this.outputField.id});
        vec3 patientCoordinate = (pixelToPatient * vec4(pixelCoordinate,1.)).xyz;

        // this block samples each input field in its local space
        float compositeValue = 0.;
        float sampleValue;
        float gradientSize = 1.; vec3 normal; float gradientMagnitude; // not used
        ${function() {
            let compositingSource = '';
            this.inputFields.forEach(field=>{
              let fragment = 'sampleField%d(textureUnit%d, patientCoordinate, gradientSize, sampleValue, normal, gradientMagnitude);';
              fragment += 'compositeValue = max(compositeValue, float(1+%d) * sampleValue);';
              compositingSource += fragment.replace(/%d/g, field.id);
            });
            return(compositingSource);
          }.bind(this)()
        }
        composited = int(compositeValue);
      }
    `);
  }
}
