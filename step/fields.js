
class Field {
  constructor(options={}) {
    this.id = Field.nextId;
    Field.nextId++;
  }

  shaderSource() {
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
    this.fiducials = options.fiducials || [];
  }

  fiducialsSource() {
    let source = '';
    this.fiducials.forEach(fiducial => {
      source += `

        centerToSample = samplePoint - vec3( ${fiducial.point[0]}, ${fiducial.point[1]}, ${fiducial.point[2]} );
        distance = length(centerToSample);
        if (distance < glow * ${fiducial.radius}) {
          sample += smoothstep(distance/glow, distance*glow, distance);
          normal += normalize(centerToSample);
        }

      `;
    });
    return(source);
  }

  shaderSource() {

    let source = `

      void transferFunction${this.id} (const in float sample, const in float gradientMagnitude, out vec3 color, out float opacity)
      {
          color = vec3( ${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]} );
          opacity = sample * ${this.rgba[3]};
      }

      void sampleVolume${this.id} (const in sampler3D volumeTextureUnit, const in vec3 samplePointIn, const in float gradientSize, out float sample, out vec3 normal, out float gradientMagnitude)
      {
        // TODO: transform should be associated with the sampling, not the ray point
        //       so that gradient is calculated incorporating transform
        vec3 samplePoint = transformPoint(samplePointIn);

        vec3 centerToSample;
        float distance;
        float glow = 1.2;

        // default if sample is not in fiducial
        sample = 0.;
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
  }

  shaderSource() {
    return(`
      ${this.headerSource()}
      ${this.intersectBoxSource()}
      ${this.rayCastVertexShaderSource()}
      ${this.rayCastFragmentSource()}
    `);
  }

  headerSource() {
    return(`#version 300 es
    `);
  }

  rayCastVertexShaderSource() {
    return (`${this.headerSource()}
      attribute vec3 vertexAttribute;
      attribute vec2 textureCoordinateAttribute;
      varying vec3 interpolatedTextureCoordinate;
      void main()
      {
        interpolatedTextureCoordinate = vec3(textureCoordinateAttribute, .5);
        gl_Position = vec4(vertexAttribute, 1.);
      }
    `);
  }

  rayCastFragmentSource() {
    return(`
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
        vec3 pointLight = vec3(200., 2500., 1000.); // TODO - lighting model

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

      // field ray caster - starts from the front and collects color and opacity
      // contributions until fully saturated.
      // Sample coordinate is 0->1 texture space
      vec4 rayCast( in vec3 sampleCoordinate )
      {
        vec4 backgroundRGBA = vec4(0.,0.,.5,1.); // TODO: mid blue background for now

        // TODO aspect: float aspect = imageW / (1.0 * imageH);
        vec2 normalizedCoordinate = 2. * (sampleCoordinate.st -.5);

        // calculate eye ray in world space
        vec3 eyeRayOrigin = vec3(%(eyeRayOrigin)s);
        vec3 eyeRayDirection;

        // ||viewNormal + u * viewRight + v * viewUp||

        eyeRayDirection = normalize (                            vec3( %(viewNormal)s )
                                      + ( %(halfSinViewAngle)s * normalizedCoordinate.x * vec3( %(viewRight)s ) )
                                      + ( %(halfSinViewAngle)s * normalizedCoordinate.y * vec3( %(viewUp)s    ) ) );



        // find intersection with box, possibly terminate early
        float tNear, tFar;
        vec3 rasBoxMin = vec3( %(rasBoxMin)s );
        vec3 rasBoxMax = vec3( %(rasBoxMax)s );
        bool hit = intersectBox( eyeRayOrigin, eyeRayDirection, rasBoxMin, rasBoxMax, tNear, tFar );
        if (!hit) {
          return (backgroundRGBA);
        }

        if (tNear < 0.) tNear = 0.;     // clamp to near plane

        // march along ray from front, accumulating color and opacity
        vec4 integratedPixel = vec4(0.);
        float gradientSize = %(gradientSize)f;
        float tCurrent = tNear;
        float sample;
        int rayStep;
        for(rayStep = 0; rayStep < %(rayMaxSteps)d; rayStep++) {

          vec3 samplePoint = eyeRayOrigin + eyeRayDirection * tCurrent;

          %(compositeSource)s

          // http://graphicsrunner.blogspot.com/2009/01/volume-rendering-101.html
          opacity *= %(sampleStep)f;
          integratedPixel.rgb += (1. - integratedPixel.a) * opacity * litColor;
          integratedPixel.a += (1. - integratedPixel.a) * opacity;
          integratedPixel = clamp(integratedPixel, 0., 1.);

          tCurrent += %(sampleStep)f;
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
    `);
  }

  intersectBoxSource() {
    return (`
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
    `);
  }
}
