/**
 * @module orc/profiles
 */

'use strict';

const Contract = require('./contract');
const Audit = require('./audit');
const Proof = require('./proof');
const Bridge = require('./bridge');
const constants = require('./constants');
const utils = require('./utils');
const Zcash = require('zcash');


/**
 * Applies the farmer profile to the supplied node. A farmer publishes capacity
 * announcements, subscribes to contract publications, and reaps stale shards.
 * @function
 * @param {Node} node
 * @param {object} config
 */
module.exports.farmer = function(node, config) {
  // TODO
};

/**
 * Applies the renter profile to the supplied node. A renter listens for
 * capacity announcements and keeps a cache, exposes a local bridge for
 * upload/download, handles auditing, mirroring, and payments.
 * @function
 * @param {Node} node
 * @param {object} config
 */
module.exports.renter = function(node, config) {
  // TODO
};

/**
 * Applies the directory profile to the supplied node. A directory listens for
 * contracts and capacity but does not act on them instead exposing an API to
 * get network statistics.
 * @function
 * @param {Node} node
 * @param {object} config
 */
module.exports.directory = function(node, config) {
  // TODO
};
