class CommonGL {

  static fibonacciSphere() {
    return (`
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
    `);
  }

  // returns a 3x3 rotation matrix where the first column
  // is the normized vector
  // and the second and third columns are mutually perpendicular
  // to the first.  Meant to be used as the direction cosines
  // for 3D convolutions
  static rotationFromVector() {
    return (`
      mat3 rotationFromVector(in vec3 vector) {
        vec3 normalizedVector = normalize(vector);
        vec3 axis = vec3(1.,0.,0.);
        if (dot(normalizedVector, axis) > .9) {
          vec3 axis = vec3(0., 1., 0.);
        }
        vec3 crossAxis = cross(normalizedVector, axis);
        vec3 crossAxis2 = cross(crossAxis, normalizedVector);
        return(mat3(normalizedVector, normalize(crossAxis), normalize(crossAxis2)));
      }
    `);
  }
}
