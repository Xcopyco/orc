'use strict';

const merge = require('merge');
const assert = require('assert');
const fs = require('fs');
const df = require('@sindresorhus/df');
const path = require('path');


/**
 * Convenience wrapper for storing shards scoped to a directory
 */
class Shards {

  static get DEFAULTS() {
    return {
      maxSpaceAllocated: 0
    };
  }

  /**
   * @constructor
   * @param {string} directory - Directory path to shard storage
   */
  constructor(directory, options) {
    assert.ok(directory, 'Invalid directory supplied');
    assert(fs.existsSync(directory), 'Supplied directory does not exist');
    this.directory = directory;
    this.options = merge(Shards.DEFAULTS, options);
  }

  /**
   * Wraps read stream with error handling/callback
   * @param {string} key - The file key or hash
   * @param {Shards~createReadStreamCallback} callback
   */
  createReadStream(key, callback) {
    let rs = null;

    try {
      rs = fs.createReadStream(path.join(this.directory, key));
    } catch (err) {
      return callback(err);
    }

    callback(null, rs);
  }
  /**
   * @callback Shards~createReadStreamCallback
   * @param {error|null} error
   * @param {object} stream
   */

  /**
   * Wraps write stream with error handling/callback
   * @param {string} key - The file key or hash
   * @param {Shards~createWriteStreamCallback} callback
   */
  createWriteStream(key, callback) {
    let ws = null;

    try {
      ws = fs.createWriteStream(path.join(this.directory, key));
    } catch (err) {
      return callback(err);
    }

    callback(null, ws);
  }
  /**
   * @callback Shards~createWriteStreamCallback
   * @param {error|null} error
   * @param {object} stream
   */

  /**
   * Unlink the shard from the file system
   * @param {string} key
   * @param {Shards~unlinkCallback} callback
   */
  unlink(key, callback) {
    fs.unlink(path.join(this.directory, key), callback);
  }
  /**
   * @callback Shards~unlinkCallback
   * @param {error|null} error
   */

  /**
   * Check if the shard exists
   * @param {string} key
   * @param {Shards~existsCallback} callback
   */
  exists(key, callback) {
    callback(null, fs.existsSync(path.join(this.directory, key)));
  }
  /**
   * @callback Shards~existsCallback
   * @param {error|null} error
   * @param {boolean} exists
   */

  /**
   * Get used space and remaining allocation
   * @param {Shards~sizeCallback} callback
   */
  size(callback) {
    df.file(this.directory).then(data => {
      data.available = this.options.maxSpaceAllocated - data.used;
      callback(null, data);
    }, err => callback(err));
  }
  /**
   * @callback Shards~sizeCallback
   * @param {error|null} error
   * @param {object} size
   */

}

module.exports = Shards;
