'use strict';

const { tmpdir } = require('os');
const { randomBytes } = require('crypto');
const async = require('async');
const pem = require('pem');
const path = require('path');
const bunyan = require('bunyan');
const levelup = require('levelup');
const memdown = require('memdown');
const orc = require('../..');
const mkdirp = require('mkdirp');

let startPort = 45000;


module.exports = function(numNodes, callback) {

  const nodes = [];

  function createNode(callback) {
    const shardsPath = path.join(
      tmpdir(),
      `orc.integration-${randomBytes(6).toString('hex')}`
    );

    mkdirp.sync(shardsPath);

    const logger = bunyan.createLogger({
      levels: ['fatal'],
      name: 'node-kademlia'
    });
    const storage = levelup('node-kademlia', { db: memdown });
    const contracts = levelup('node-orc', {
      db: memdown,
      valueEncoding: 'json'
    });
    const contact = {
      hostname: 'localhost',
      port: startPort++,
      protocol: 'https:'
    };
    const shards = new orc.Shards(shardsPath, {
      maxSpaceAllocated: 1024 * 1024 * 1024
    });

    pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
      const transport = new orc.Transport({
        key: keys.serviceKey,
        cert: keys.certificate
      });

      callback(new orc.Node({
        contact,
        contracts,
        storage,
        shards,
        logger,
        transport,
        claims: ['*']
      }));
    });
  }

  async.times(numNodes, function(n, done) {
    createNode((node) => {
      nodes.push(node);
      done();
    });
  }, () => callback(nodes));
};
