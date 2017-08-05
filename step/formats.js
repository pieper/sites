class NRRD {

  static stringToUint8Array(string) {
    let array = new Uint8Array(string.length);
    for (let index of Array(string.length).keys()) {
      array[index] = string.charCodeAt(index);
    }
    return array;
  }

  static parse(nrrdArrayBuffer) {
    // return the header fields and data
    let newline = '\n'.charCodeAt(0); // value is 10
    let header = "";
    let dataOffset = 0;
    let chars = new Uint8Array(nrrdArrayBuffer);
    for (let index = 0; index < nrrdArrayBuffer.byteLength-1; index++) {
      if (chars[index] == newline && chars[index+1] == newline) {
        dataOffset = index + 2;
        break;
      }
      header += String.fromCharCode(chars[index]);
    }

    let nrrd = {
      header: {},
      data: undefined,
    };
    header.split('\n').forEach(line => {
      let [key, value] = line.split(":");
      if (value && key[0] != '#') {
        nrrd.header[key] = value.trim();
      }
    });

    step.nrrdArrayBuffer = nrrdArrayBuffer;
    nrrd.data = new Int16Array(nrrdArrayBuffer.slice(dataOffset));
    return (nrrd);
  }

  static unparse(nrrd) {
    // make an array buffer out of the nrrd

    let nrrdHeader = `NRRD0004
# Complete NRRD file format specification at:
# http://teem.sourceforge.net/nrrd/format.html
  type: short
  dimension: 3
  space: left-posterior-superior
  sizes: ${nrrd.header['sizes']}
  space directions: ${nrrd.header['space directions']}
  kinds: domain domain domain
  endian: little
  encoding: raw
  space origin: ${nrrd.header['space origin']}

  `;
    let headerBytes = stringToUint8Array(nrrdHeader);

    // account for old header values in nrrd data buffer
    let bufferSize = nrrd.data.buffer.byteLength;
    let dataSize = nrrd.data.byteLength;
    let dataBytes = new Uint8Array(nrrd.data.buffer, bufferSize-dataSize);

    let unparsed = new Uint8Array(headerBytes.length + dataBytes.length);
    unparsed.set(headerBytes);
    unparsed.set(dataBytes, headerBytes.length);

    return (unparsed.buffer);
  }

  static nrrdToDICOMDataset(nrrd) {
    // make a rough conversion from nrrd to dicom
    // by filling in only what is needed for filtering
    // TODO: get valid data from nrrd for data type to pixel info

    console.log('converting', nrrd);

    let sizes = nrrd.header['sizes'].split(" ").map(Number);
    let origin = nrrd.header['space origin'].replace('(','').replace(')','').split(",").map(Number);

    let directions = [];
    let directionParts = nrrd.header['space directions'].split(')').slice(0,3)
    directionParts.forEach(directionPart => {
      let part = directionPart.replace('(','').replace(')','').split(',').map(Number);
      directions.push(part);
    });

    let spacings = [];
    let unitDirections = [];
    directions.forEach(d => {
      let spacing = Math.sqrt( d[0]*d[0] + d[1]*d[1] + d[2]*d[2] );
      let unitDirection = [d[0]/spacing, d[1]/spacing, d[2]/spacing];
      spacings.push(spacing);
      unitDirections.push(unitDirection);
    });

    let dataset = {
      "SOPClass": "EnhancedCTImage",
      "Columns": String(sizes[0]),
      "Rows": String(sizes[1]),
      "NumberOfFrames": String(sizes[2]),
      "SamplesPerPixel": 1,
      "BitsStored": 16,
      "HighBit": 15,
      "WindowCenter": [ "84" ],
      "WindowWidth": [ "168" ],
      "BitsAllocated": 16,
      "PixelRepresentation": 1,
      "RescaleSlope": "1",
      "RescaleIntercept": "0",
      "SharedFunctionalGroups": {
        "PlaneOrientation": {
          "ImageOrientationPatient": [
            String(unitDirections[0][0]),
            String(unitDirections[0][1]),
            String(unitDirections[0][2]),
            String(unitDirections[1][0]),
            String(unitDirections[1][1]),
            String(unitDirections[1][2])
          ]
        },
        "PixelMeasures": {
          "PixelSpacing": [ String(spacings[0]), String(spacings[1]) ],
          "SpacingBetweenSlices": String(spacings[2])
        },
        "PixelValueTransformation": {
          "RescaleIntercept": "0",
          "RescaleSlope": "1",
          "RescaleType": "US"
        }
      },
      "PixelData": nrrd.data
    };

    dataset.PerFrameFunctionalGroups = [];
    for (let frameIndex of Array(sizes[2]).keys()) {
      dataset.PerFrameFunctionalGroups.push({
        "PlanePosition": {
          "ImagePositionPatient": [
            String(origin[0] + frameIndex * directions[2][0]),
            String(origin[1] + frameIndex * directions[2][1]),
            String(origin[2] + frameIndex * directions[2][2])
          ]
        },
      });
    }

    return(dataset);
  }

  static nrrdLinearMapPixels(nrrd, slope=1, intercept=0) {
    for (let index = 0; index < nrrd.data.length; index++) {
      nrrd.data[index] = slope * nrrd.data[index] + intercept;
    }
  }

}
