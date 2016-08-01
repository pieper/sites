
class Field {
  constructor(options={}) {
    this.id = Field.nextId;
    Field.nextId++;
  }

  samplingShaderSource() {
    return("");
  }
}
Field.nextId = 0;

class Fiducial {
  constructor(options={}) {
    this.point = options.point || [0.,0.,0.];
    this.radius = options.radius || .1;
  }
}

class FiducialField extends Field {
  constructor(options={}) {
    super(options);
    this.rgba = options.rgba || [1., 0., 0., 0.5];
    this.rgba = this.rgba.map(e=>e*1.00001); // hack to make it floating point
    this.opacityScale = options.opacityScale || 1.;
    this.opacityScale *= 1.00001; // hack to make it floating point
    this.fiducials = options.fiducials || [];
  }

  uniforms() {
    let samplerName = 'sampler'+this.id;
    return({
      samplerName: {type: '1i', value: this.id},
    });
  }

  fiducialsSource() {
    let source = '';
    this.fiducials.forEach(fiducial => {
      source += `

        centerToSample = samplePoint - vec3( ${fiducial.point[0]}, ${fiducial.point[1]}, ${fiducial.point[2]} );
        distance = length(centerToSample);
        /*
        if (distance < glow * ${fiducial.radius}) {
          sampleValue += smoothstep(distance/glow, distance*glow, distance);
          normal += normalize(centerToSample);
        }
        */
        if (abs(distance - ${fiducial.radius}) < 0.01) {
          sampleValue += ${this.rgba[3]};
          normal += normalize(centerToSample);
        }

      `;
    });
    return(source);
  }

  samplingShaderSource() {

    let source = `

      vec3 transformPoint${this.id}(const in vec3 samplePoint)
      {
          return samplePoint; // identity by default
      }

      void transferFunction${this.id} (const in float sampleValue, const in float gradientMagnitude, out vec3 color, out float opacity)
      {
          color = vec3( ${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]} );
          opacity = ${this.opacityScale} * sampleValue * ${this.rgba[3]};
      }

      uniform sampler3D sampler${this.id};
      void sampleVolume${this.id} (const in sampler3D volumeTextureUnit, const in vec3 samplePointIn, const in float gradientSize, out float sampleValue, out vec3 normal, out float gradientMagnitude)
      {
        // TODO: transform should be associated with the sampling, not the ray point
        //       so that gradient is calculated incorporating transform
        vec3 samplePoint = transformPoint${this.id}(samplePointIn);

        vec3 centerToSample;
        float distance;
        float glow = 1.2;

        // default if sampleValue is not in fiducial
        sampleValue = 0.;
        normal = vec3(0,0,0);
        gradientMagnitude = 1.;

        ${this.fiducialsSource()}

        normal = normalize(normal);

      }
    `;

    return(source);
  }
}

class FieldShader {
  constructor(options={}) {
    this.fields = options.fields || [];
  }

  perFieldSamplingShaderSource() {
    let perFieldSamplingShaderSource = '';
    this.fields.forEach(field=>{
      perFieldSamplingShaderSource += field.samplingShaderSource();
    });
    return(perFieldSamplingShaderSource);
  }

  perFieldCompositingShaderSource() {
    let source = '';
    this.fields.forEach(field=>{
      source += `
          // accumulate per-field opacities and lit colors
          sampleVolume${field.id}(sampler${field.id}, 
                                  samplePoint, gradientSize, sampleValue, normal, gradientMagnitude);
          transferFunction${field.id}(sampleValue, gradientMagnitude, color, fieldOpacity);
          litColor += fieldOpacity * lightingModel(samplePoint, normal, color, eyeRayOrigin);
          opacity += fieldOpacity;
      `;
    });
    return(source);
  }

  fieldCompositingShaderSource() {
    let fieldCompositingShaderSource = ` 
          vec3 normal;
          float gradientMagnitude;
          vec3 color;
          float opacity = 0.;
          vec3 litColor = vec3(0.);
          float fieldOpacity = 0.;
          vec3 fieldLitColor = vec3(0.);

          ${this.perFieldCompositingShaderSource()}

          // normalize back so that litColor is mean of all fields weighted by opacity
          litColor /= opacity;
    `;

    return(fieldCompositingShaderSource);
  }

  headerSource() {
    return(`#version 300 es
      precision highp float;
      precision highp int;
      precision highp sampler3D;
      precision highp isampler3D;
    `);
  }

  vertexShaderSource() {
    return (`${this.headerSource()}
      in vec3 coordinate;
      in vec2 textureCoordinate;
      out vec3 interpolatedTextureCoordinate;
      void main()
      {
        interpolatedTextureCoordinate = vec3(textureCoordinate, .5);
        gl_Position = vec4(coordinate, 1.);
      }
    `);
  }

  fragmentShaderSource() {
    return (`${this.headerSource()}

      uniform vec3 pointLight;
      uniform vec3 eyeRayOrigin;
      uniform vec3 viewNormal;
      uniform vec3 viewRight;
      uniform vec3 viewUp;
      uniform float halfSinViewAngle;
      uniform vec3 rasBoxMin;
      uniform vec3 rasBoxMax;
      uniform float gradientSize;
      uniform int rayMaxSteps;
      uniform float sampleStep;

      bool intersectBox(const in vec3 rayOrigin, const in vec3 rayDirection,
                        const in vec3 boxMin, const in vec3 boxMax,
                        out float tNear, out float tFar)
        // intersect ray with a box
        // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rtinter3.htm
      {
          // compute intersection of ray with all six bbox planes
          vec3 invRay = vec3(1.) / rayDirection;
          vec3 tBot = invRay * (boxMin - rayOrigin);
          vec3 tTop = invRay * (boxMax - rayOrigin);

          // re-order intersections to find smallest and largest on each axis
          vec3 tMin = min(tTop, tBot);
          vec3 tMax = max(tTop, tBot);

          // find the largest tMin and the smallest tMax
          float largest_tMin = max(max(tMin.x, tMin.y), max(tMin.x, tMin.z));
          float smallest_tMax = min(min(tMax.x, tMax.y), min(tMax.x, tMax.z));

          tNear = largest_tMin;
          tFar = smallest_tMax;

          return smallest_tMax > largest_tMin;
      }

      vec3 lightingModel( in vec3 samplePoint, in vec3 normal, in vec3 color, in vec3 eyeRayOrigin )
      {
        // Phong lighting
        // http://en.wikipedia.org/wiki/Phong_reflection_model
        vec3 Cambient = color;
        vec3 Cdiffuse = color;
        vec3 Cspecular = vec3(1.,1.,1.);
        float Kambient = .30;
        float Kdiffuse = .95;
        float Kspecular = .90;
        float Shininess = 15.;

        vec3 litColor = Kambient * Cambient;
        vec3 pointToEye = normalize(eyeRayOrigin - samplePoint);

        if (dot(pointToEye, normal) > 0.) {
          vec3 pointToLight = normalize(pointLight - samplePoint);
          float lightDot = dot(pointToLight,normal);
          vec3 lightReflection = reflect(pointToLight,normal);
          float reflectDot = dot(lightReflection,pointToEye);
          if (lightDot > 0.) {
            litColor += Kdiffuse * lightDot * Cdiffuse;
            litColor += Kspecular * pow( reflectDot, Shininess ) * Cspecular;
          }
        }
        return litColor;
      }

      // these are the function definitions for sampleVolume* and transferFunction*
      // that define a field at a sample point in space
      ${this.perFieldSamplingShaderSource()}

      // field ray caster - starts from the front and collects color and opacity
      // contributions until fully saturated.
      // Sample coordinate is 0->1 texture space
      //
      vec4 rayCast( in vec3 sampleCoordinate )
      {
        vec4 backgroundRGBA = vec4(0.,0.,.5,1.); // TODO: mid blue background for now

        // TODO aspect: float aspect = imageW / (1.0 * imageH);
        vec2 normalizedCoordinate = 2. * (sampleCoordinate.st -.5);

        // calculate eye ray in world space
        vec3 eyeRayDirection;

        // ||viewNormal + u * viewRight + v * viewUp||
        eyeRayDirection = normalize ( viewNormal
                                    + viewRight * halfSinViewAngle * normalizedCoordinate.x
                                    + viewUp * halfSinViewAngle * normalizedCoordinate.y );

        // find intersection with box, possibly terminate early
        float tNear, tFar;
        bool hit = intersectBox( eyeRayOrigin, eyeRayDirection, rasBoxMin, rasBoxMax, tNear, tFar );
        if (!hit) {
          return (backgroundRGBA);
        }

        if (tNear < 0.) tNear = 0.;     // clamp to near plane

        // march along ray from front, accumulating color and opacity
        vec4 integratedPixel = vec4(0.);
        float tCurrent = tNear;
        float sampleValue;
        int rayStep;
        for(rayStep = 0; rayStep < rayMaxSteps; rayStep++) {

          vec3 samplePoint = eyeRayOrigin + eyeRayDirection * tCurrent;

          // this is the code that composites together samples
          // from all the fields in the space
          ${this.fieldCompositingShaderSource()}

          // http://graphicsrunner.blogspot.com/2009/01/volume-rendering-101.html
          opacity *= sampleStep;
          integratedPixel.rgb += (1. - integratedPixel.a) * opacity * litColor;
          integratedPixel.a += (1. - integratedPixel.a) * opacity;
          integratedPixel = clamp(integratedPixel, 0., 1.);

          tCurrent += sampleStep;
          if (
              tCurrent >= tFar  // stepped out of the volume
                ||
              integratedPixel.a >= 1.  // pixel is saturated
          ) {
            break; // we can stop now
          }
        }
        return(vec4(mix(backgroundRGBA.rgb, integratedPixel.rgb, integratedPixel.a), 1.));
      }

      in vec3 interpolatedTextureCoordinate;
      out vec4 fragmentColor;
      void main()
      {
        fragmentColor = rayCast(interpolatedTextureCoordinate);
      }

    `);
  }

}
