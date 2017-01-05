class Chronicle {
  constructor(options={}) {
    this.url = options.url || 'http://quantome.org:5984/chronicle';
    this.chronicle = new PouchDB(this.url);
  }

  seriesOperation(options) {
    let chronicle = options.database.chronicle || this.chronicle;
    let endKey = options.key.slice(0);
    endKey.push({});
    chronicle.query("instances/context", {
      start_key : options.key,
      end_key : endKey,
      reduce : true,
      group_level : 4,
      stale : 'update_after',
    }).then(function(data) {
      let instanceURLs = [];
      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex += 1) {
        let row = data.rows[rowIndex].key;
        let instanceUID = row[3];
        let instanceURL = chronicle._db_name + "/" + instanceUID + '/object.dcm';
        instanceURLs.push(instanceURL);
      };
      options.operation(instanceURLs);
    }).catch(function (err) {
      console.error(err);
    });
  }
}
