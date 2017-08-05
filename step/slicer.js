class Slicer {

  constructor(options={}) {
    this.url = options.url || 'http://localhost:2016/slicer';
  }

  request(endpoint, options={}) {
    return new Promise( (resolve, reject) => {
      let request = new XMLHttpRequest();
      request.responseType = options.responseType;
      request.onload = options.onload || function (event) {
        resolve(event.target.response);
      };
      request.onerror = options.onerror || function() {
        reject({
          status: request.status,
          statusText: request.statusText,
        });
      };
      let command = options.command || "GET";
      let url = `${this.url}/${endpoint}`;
      request.open(command, url, true);
      request.send(options.payload || null);
    });
  }

  volumes() {
    return this.request('volumes', {
      responseType: 'json'
    });
  }

  volume(id, dataset) {
    return new Promise( (resolve,reject) => {
      this.request(`volume?id=${id}`, {
        responseType: 'arraybuffer'
      })
      .then(arrayBuffer => {
        let nrrd = NRRD.parse(arrayBuffer);
        resolve(NRRD.nrrdToDICOMDataset(nrrd));
      })
      .catch(reject);
    });
  }

}
