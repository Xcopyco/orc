#!/usr/bin/env node

'use strict';

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
const kfs = require('kfs');
const bunyan = require('bunyan');
const levelup = require('levelup');
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const manifest = require('../package');
const orc = require('..');
const options = require('./_config');
const { execFileSync } = require('child_process');
const { Transform } = require('stream');
const config = require('rc')('orc', options);
const boscar = require('boscar');


program.version(`
  orc       1.0.0
  core      ${orc.version.software}
  protocol  ${orc.version.protocol}
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
if (!fs.existsSync(config.OnionServiceKeyPath)) {
  let key = orctool('generate-onion');
  fs.writeFileSync(config.OnionServiceKeyPath, key);
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

// Initialize the shard storage database
const shards = kfs(path.join(config.ShardStorageBaseDir, 'shards'), {
  sBucketOpts: {
    maxOpenFiles: parseInt(config.ShardStorageMaxOpenFiles)
  },
  maxTableSize: bytes.parse(config.ShardStorageMaxAllocation)
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
  agent: `orc-${manifest.version}/core-${orc.version.software}`
};

// Initialize network seed contacts
const seeds = config.NetworkBootstrapNodes.map((str) => {
  let { protocol, hostname, port } = url.parse(str);

  // TODO: Load identity string from GET /

  return [identity, { hostname, protocol, port }];
});

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

// Establish onion hidden service
node.plugin(onion({
  rsaPrivateKey: fs.readFileSync(config.OnionServiceKeyPath).toString()
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
  logger.info(`joining network from ${seeds.length} bootstrap nodes`);
  async.detectSeries(seeds, (contact, done) => {
    node.join(contact, (err) => done(null, !err));
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
  join();
});

// Establish control server and wrap node instance
control.listen(parseInt(config.ControlPort), config.ControlHostname, () => {
  logger.info(
    `control server bound to ${config.ControlHostname}:${config.ControlPort}`
  );
});
