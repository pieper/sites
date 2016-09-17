//
// Handle DICOM and CIELAB colors
// based on: 
// https://github.com/michaelonken/dcmtk/blob/3c68f0e882e22e6d9e2a42f836332c0ca21b3e7f/dcmiod/libsrc/cielabutil.cc
//
// RGB here refers to sRGB
//
//

class Colors {

  dicomlab2RGB(dicomlab) {
    return lab2RGB(dicomlab2LAB(dicomlab));
  }

  rgb2DICOMLAB(rgb) {
    lab2DICOMLAB(rgb2LAB(rgb));
  }

  dicomlab2LAB(dicomlab) {
    return [
      ((dicomlab[0] * 100.0) / 65535.0)      , // results in 0 <= L <= 100
      ((dicomlab[1] * 255.0) / 65535.0) - 128, // results in -128 <= a <= 127
      ((dicomlab[2] * 255.0) / 65535.0) - 128, // results in -128 <= b <= 127
    ];
  }

  lab2DICOMLAB(lab) {
    return [
      L * 65535.0 / 100.0        , // results in 0 <= L <= 65535
      (a + 128) * 65535.0 / 255.0, // results in 0 <= a <= 65535
      (b + 128) * 65535.0 / 255.0, // results in 0 <= b <= 65535
    ];
  }

  rgb2LAB(rgb) {
    return xyz2LAB(rgb2XYZ(rgb));
  }

  gammaCorrection(n) {
    if ((n) <= 0.0031306684425005883) {
      return 12.92 * (n);
    } else {
      return (1.055*pow((n), 0.416666666666666667) - 0.055);
    }
  }

  invGammaCorrection(n) {
    if ((n) <= 0.0404482362771076) {
      return ((n) / 12.92);
    } else {
      return ( pow(((n) + 0.055)/1.055, 2.4) );
    }
  }

  rgb2XYZ(rgb) {
    let R = invGammaCorrection(rgb[0]);
    let G = invGammaCorrection(rgb[1]);
    let B = invGammaCorrection(rgb[2]);
    return [
      0.4123955889674142161*R + 0.3575834307637148171*G + 0.1804926473817015735*B,
      0.2125862307855955516*R + 0.7151703037034108499*G + 0.07220049864333622685*B,
      0.01929721549174694484*R + 0.1191838645808485318*G + 0.9504971251315797660*B,
    ];
  }

  xyz2LAB(xyz) {
    let X = xyz[0] / D65_WHITEPOINT_X;
    let Y = xyz[1] / D65_WHITEPOINT_Y;
    let Z = xyz[2] / D65_WHITEPOINT_Z;
    X = labf(X);
    Y = labf(Y);
    Z = labf(Z);
    return [
      116*Y - 16,
      500*(X - Y),
      200*(Y - Z),
    ];
  }

  lab2RGB(lab) {
    xyz2RGB(lab2XYZ(lab));
  }

  lab2XYZ(lab) {
    let L = (lab[0] + 16)/116;
    let a = lab[0] + lab[1]/500;
    let b = lab[0] - lab[2]/200;
    return [
      D65_WHITEPOINT_X * labfInv(a),
      D65_WHITEPOINT_Y * labfInv(L),
      D65_WHITEPOINT_Z * labfInv(b),
    ];
  }

  xyz2RGB(xyz) {
    let R1 =  3.2406*xyz[0] - 1.5372*xyz[1] - 0.4986*xyz[2];
    let G1 = -0.9689*xyz[0] + 1.8758*xyz[1] + 0.0415*xyz[2];
    let B1 =  0.0557*xyz[0] - 0.2040*xyz[1] + 1.0570*xyz[2];

    /* Force nonnegative values so that gamma correction is well-defined. */
    let minimumComponent = Math.min(R1, G1);
    minimumComponent = Math.min(minimumComponent, B1);
    if(minimumComponent < 0) {
      R1 -= minimumComponent;
      G1 -= minimumComponent;
      B1 -= minimumComponent;
    }

    /* Transform from RGB to R'G'B' */
    return [
      gammaCorrection(R1),
      gammaCorrection(G1),
      gammaCorrection(B1),
    ];
  }

  labf(n) {
    if (n >= 8.85645167903563082e-3) {
      return ( pow(n, 0.333333333333333) );
    } else {
      return ( (841.0/108.0)*(n) + (4.0/29.0) );
    }
  }

  labfInv(n) {
    if ( (n) >= 0.206896551724137931 ) {
      return (n)*(n)*(n);
    } else {
      return (108.0/841.0)*((n) - (4.0/29.0));
    }
  }
}

// Initialize white points of D65 light point (CIELAB standard white point)
Colors.D65_WHITEPOINT_X = 0.950456;
Colors.D65_WHITEPOINT_Y = 1.0;
Colors.D65_WHITEPOINT_Z = 1.088754;
