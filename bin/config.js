'use strict';

const { randomBytes } = require('crypto');
const ini = require('ini');
const { existsSync, writeFileSync } = require('fs');
const mkdirp = require('mkdirp');
const { homedir } = require('os');
const { join } = require('path');
const datadir = join(homedir(), '.config/orc');

module.exports = {

  // Identity/Cryptography
  PrivateExtendedKeyPath: join(datadir, 'x_private_key'),
  ChildDerivationIndex: '0',

  // Contract Storage
  ContractStorageBaseDir: datadir,

  // Shard Database
  ShardStorageBaseDir: datadir,
  ShardStorageMaxAllocation: '0GB',

  // Trusted Renter Nodes
  AllowDirectStorageClaims: ['*'],

  // Directory Storage
  DirectoryStorageBaseDir: datadir,

  // Server SSL
  TransportServiceKeyPath: join(datadir, 'service_key.pem'),
  TransportCertificatePath: join(datadir, 'certificate.pem'),

  // Public Addressability
  PublicPort: '443',
  ListenPort: '4443',

  // Network Bootstrapping
  NetworkBootstrapNodes: [
    'https://orcjd7xgshpovm6i.onion:443',
    'https://orcjfg52ty6ljv54.onion:443',
    'https://orce4nqoa6muz3gt.onion:443',
    'https://orcwfkilxjxo63mr.onion:443'
  ],

  // Bandwidth Metering
  BandwidthAccountingEnabled: '0',
  BandwidthAccountingMax: '5GB',
  BandwidthAccountingReset: '24HR',

  // Debugging/Developer
  VerboseLoggingEnabled: '1',
  ControlPort: '4444',
  ControlHostname: '127.0.0.1',

  // Onion Service
  OnionServicePrivateKeyPath: join(datadir, 'onion_key'),

  // Local Bridge
  BridgeEnabled: '0',
  BridgeStorageBaseDir: datadir,
  BridgeHostname: '127.0.0.1',
  BridgePort: '4445',
  BridgeAuthenticationEnabled: '0',
  BridgeAuthenticationUser: 'orc',
  BridgeAuthenticationPassword: randomBytes(16).toString('hex'),

  // Wallet Connection
  WalletHostname: 'localhost',
  WalletPort: '8232',
  WalletUser: 'orc',
  WalletPassword: 'orc',

  // Node Profiles
  ProfilesEnabled: [] // renter, farmer, directory

};

if (!existsSync(join(datadir, 'config'))) {
  mkdirp.sync(datadir);
  writeFileSync(join(datadir, 'config'), ini.stringify(module.exports));
}
