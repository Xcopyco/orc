#!/usr/bin/env node

'use strict';

const os = require('os');
const url = require('url');
const async = require('async');
const program = require('commander');
const assert = require('assert');
const bytes = require('bytes');
const hdkey = require('hdkey');
const hibernate = require('kad-hibernate');
const traverse = require('kad-traverse');
const spartacus = require('kad-spartacus');
const onion = require('kad-onion');
const ms = require('ms');
const bunyan = require('bunyan');
const levelup = require('levelup');
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const manifest = require('../package');
const orc = require('..');
const options = require('./config');
const { execFileSync } = require('child_process');
const { Transform } = require('stream');
const config = require('rc')('orc', options);
const boscar = require('boscar');


program.version(`
  orc      ${orc.version.software}
  protocol ${orc.version.protocol}
`);

program.description(`
  Copyright (c) 2017 Storj Labs, Inc
  Licensed under the GNU Affero General Public License Version 3
`);

program.option('--config <file>', 'path to a orc configuration file');
program.parse(process.argv);

function orctool() {
  return execFileSync(
    path.join(__dirname, 'orctool.js'),
    [...arguments]
  ).toString().trim();
}

// Generate a private extended key if it does not exist
if (!fs.existsSync(config.PrivateExtendedKeyPath)) {
  fs.writeFileSync(
    config.PrivateExtendedKeyPath,
    orctool('generate-key', '--extended')
  );
}

// Generate self-signed ssl certificate if it does not exist
if (!fs.existsSync(config.TransportServiceKeyPath)) {
  let [key, cert] = orctool('generate-cert').split('\r\n\r\n');
  fs.writeFileSync(config.TransportServiceKeyPath, key);
  fs.writeFileSync(config.TransportCertificatePath, cert);
}

// Generate self-signed ssl certificate if it does not exist
if (!fs.existsSync(config.OnionServicePrivateKeyPath)) {
  let key = orctool('generate-onion');
  fs.writeFileSync(config.OnionServicePrivateKeyPath, key);
}

// Initialize private extended key
const xprivkey = fs.readFileSync(config.PrivateExtendedKeyPath).toString();
const parentkey = hdkey.fromExtendedKey(xprivkey);
const childkey = parentkey.deriveChild(parseInt(config.ChildDerivationIndex));

// Initialize the contract storage database
const contracts = levelup(
  path.join(config.ContractStorageBaseDir, 'contracts.db'),
  { valueEncoding: 'json' }
);

// Create the shards directory if it does not exist
if (!fs.existsSync(path.join(config.ShardStorageBaseDir, 'shards'))) {
  mkdirp.sync(path.join(config.ShardStorageBaseDir, 'shards'));
}

// Initialize the shard storage database
const shards = new orc.Shards(path.join(config.ShardStorageBaseDir, 'shards'), {
  maxSpaceAllocated: bytes.parse(config.ShardStorageMaxAllocation)
});

// Initialize the directory storage database
const storage = levelup(
  path.join(config.DirectoryStorageBaseDir, 'directory.db'),
  { valueEncoding: 'json' }
);

// Initialize logging
const logger = bunyan.createLogger({
  name: spartacus.utils.toPublicKeyHash(childkey.publicKey).toString('hex')
});

// Initialize transport adapter with SSL
const transport = new orc.Transport({
  key: fs.readFileSync(config.TransportServiceKeyPath),
  cert: fs.readFileSync(config.TransportCertificatePath)
});

// Initialize public contact data
const contact = {
  protocol: 'https:',
  port: parseInt(config.PublicPort),
  xpub: parentkey.publicExtendedKey,
  index: parseInt(config.ChildDerivationIndex),
  agent: `orc-${manifest.version}/${os.platform()}`
};

// Initialize protocol implementation
const node = new orc.Node({
  contracts,
  shards,
  storage,
  logger,
  transport,
  contact,
  claims: !!parseInt(config.AllowDirectStorageClaims),
  privateExtendedKey: xprivkey,
  keyDerivationIndex: parseInt(config.ChildDerivationIndex)
});

// Handle any fatal errors
node.on('error', (err) => {
  logger.error(err.message);
  process.exit(1);
});

const rsa = fs.readFileSync(config.OnionServicePrivateKeyPath)
              .toString().split('\n');

// Establish onion hidden service
node.plugin(onion({
  rsaPrivateKey: rsa.slice(1, rsa.length - 1).join('')
}));

// Intialize control server
const control = new boscar.Server(node);

// Plugin bandwidth metering if enabled
if (!!parseInt(config.BandwidthAccountingEnabled)) {
  node.plugin(hibernate({
    limit: config.BandwidthAccountingMax,
    interval: config.BandwidthAccountingReset,
    reject: ['CLAIM', 'FIND_VALUE', 'STORE', 'CONSIGN']
  }));
}

// Use verbose logging if enabled
if (!!parseInt(config.VerboseLoggingEnabled)) {
  node.rpc.deserializer.append(new Transform({
    transform: (data, enc, callback) => {
      let [rpc, ident] = data;

      if (rpc.payload.method) {
        logger.info(
          `received ${rpc.payload.method} (${rpc.payload.id}) from ` +
          `${ident.payload.params[0]} ` +
          `(https://${ident.payload.params[1].hostname}:` +
          `${ident.payload.params[1].port})`
        );
      } else {
        logger.info(
          `received response from ${ident.payload.params[0]} to ` +
          `${rpc.payload.id}`
        );
      }

      callback(null, data);
    },
    objectMode: true
  }));
  node.rpc.serializer.prepend(new Transform({
    transform: (data, enc, callback) => {
      let [rpc, sender, recv] = data;

      if (rpc.method) {
        logger.info(
          `sending ${rpc.method} (${rpc.id}) to ${recv[0]} ` +
          `(https://${recv[1].hostname}:${recv[1].port})`
        );
      } else {
        logger.info(
          `sending response to ${recv[0]} for ${rpc.id}`
        );
      }

      callback(null, data);
    },
    objectMode: true
  }));
}

let retry = null;

function join() {
  logger.info(
    `joining network from ${config.NetworkBootstrapNodes.length} seeds`
  );
  async.detectSeries(config.NetworkBootstrapNodes, (seed, done) => {
    logger.info(`requesting identity information from ${seed}`);
    node.identifyService(seed, (err, contact) => {
      if (err) {
        logger.error(`failed to identify seed ${seed} (${err.message})`);
        done(null, false);
      } else {
        node.join(contact, (err) => done(null, !err));
      }
    });
  }, (err, result) => {
    if (!result) {
      logger.error('failed to join network, will retry in 1 minute');
      retry = setTimeout(() => join(), ms('1m'));
    } else {
      logger.info(
        `connected to network via ${result[0]} ` +
        `(https://${result[1].hostname}:${result[1].port}})`
      );
    }
  });
}

// Bind to listening port and join the network
node.listen(parseInt(config.ListenPort), () => {
  logger.info(`node listening on port ${config.ListenPort}`);
  logger.info('giving tor a moment to bootstrap...');
  setTimeout(() => join(), 5000);
});

// Establish control server and wrap node instance
control.listen(parseInt(config.ControlPort), config.ControlHostname, () => {
  logger.info(
    `control server bound to ${config.ControlHostname}:${config.ControlPort}`
  );
});
