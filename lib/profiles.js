/**
 * @module orc/profiles
 */

'use strict';

const async = require('async');
const ms = require('ms');
const bytes = require('bytes');
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
  const wallet = new Zcash({
    username: config.WalletUser,
    password: config.WalletPassword,
    port: parseInt(config.WalletPort),
    host: config.WalletHostname
  });

  function getNewAddress(callback) {
    if (parseInt(config.WalletShieldedTransactions)) {
      wallet.z_getnewaddress().then((addr) => callback(null, addr), callback);
    } else {
      wallet.getnewaddress().then((addr) => callback(null, addr), callback);
    }
  }

  function handleContract(contract, contact) {
    contract = Contract.from(contract);

    getNewAddress((err, addr) => {
      if (err) {
        node.logger.error(err.message);
        return node.logger.warn(
          'cannot send offer for shard, failed to get new address from wallet'
        );
      }

      contract.set('farmer_id', node.identity.toString('hex'));
      contract.set('farmer_hd_key', node.contact.xpub);
      contract.set('farmer_hd_index', node.contact.index);
      contract.set('payment_destination', addr);
      contract.sign('farmer', node.spartacus.privateKey);
      node.offerShardAllocation(contact, contract.toObject(), (err, result) => {
        if (err) {
          node.logger.info(`offer rejected, reason: ${err.message}`);
        } else {
          node.logger.info(
            `acquired storage contract ${contract.get('data_hash')} ` +
            `from renter node ${contact[0]}`
          );
        }
      });
    });
  }

  function announceCapacity() {
    node.shards.size((err, space) => {
      if (err) {
        return node.logger.warn('cannot announce capacity, failed to measure');
      }

      const { available } = space;

      async.eachSeries(config.FarmerAdvertiseTopics, (topic, next) => {
        node.publishCapacityAnnouncement(topic, available, (err) => {
          if (err) {
            node.logger.error(err.message);
            node.logger.warn('failed to publish capacity announcement');
          } else {
            node.logger.info(
              `published capacity announcement of ${available} for ${topic}`
            );
          }

          next();
        });
      });
    });
  }

  function reapExpiredShards() {
    const time = Date.now();
    const rs = node.contracts.createReadStream();

    node.logger.info('starting contract database scan for stale shards');
    rs.on('data', ({ key, value }) => {
      let contract = Contract.from(value);

      if (contract.get('end_time') < (time + ms('24h'))) {
        node.shards.unlink(contract.get('data_hash'), (err) => {
          if (err) {
            node.logger.warn(`failed to reap stale shard ${value.data_hash}`);
          } else {
            node.logger.info(`unlinked stale shard ${value.data_hash}`);
            node.contracts.del(key, () => rs.resume());
          }
        });
      } else {
        rs.resume();
      }
    });
    rs.on('end', () => {
      node.logger.info('finished reaping stale shards');
    });
    rs.on('error', (err) => {
      node.logger.error(err.message);
      node.logger.warn('did not complete reaping stale shards');
    });
  }

  node.logger.info(
    `subscribing to ${config.FarmerAdvertiseTopics.length} topic codes`
  );
  node.subscribeShardDescriptor(config.FarmerAdvertiseTopics, (err, rs) => {
    if (err) {
      return node.logger.warn(err.message);
    }

    rs.on('data', ([contract, contact]) => handleContract(contract, contact));
  });
  announceCapacity();
  setInterval(() => announceCapacity(), ms('15m'));
  setInterval(() => reapExpiredShards(), ms(config.FarmerShardReaperInterval));
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
