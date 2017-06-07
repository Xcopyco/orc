/**
 * @module orc/version
 */

'use strict';

var semver = require('semver');
var assert = require('assert');
var postfix = process.env.ORC_NETWORK ? `-${process.env.ORC_NETWORK}` : '';

module.exports = {
  /**
   * @constant {string} protocol - The supported protocol version
   */
  protocol: '2.0.0' + postfix,
  /**
   * @constant {string} software - The current software version
   */
  software: require('../package').version,
  /**
   * Returns human readable string of versions
   * @function
   * @returns {string}
   */
  toString: function() {
    let { software, protocol } = module.exports;
    return `orc v${software} protocol v${protocol}`;
  }
};

assert(
  semver.valid(module.exports.protocol),
  'Invalid protocol version specified'
);
