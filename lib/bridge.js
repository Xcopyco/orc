'use strict';

const BusBoy = require('busboy');
const ReedSolomon = require('@ronomon/reed-solomon');
const Zcash = require('zcash');
const http = require('http');
const utils = require('./utils');
const fs = require('fs');
const merge = require('merge');
const connect = require('connect');
const auth = require('basic-auth');
const crypto = require('crypto');
const { tmpdir } = require('os');
const path = require('path');
const tiny = require('tiny');
const mkdirp = require('mkdirp');
const uuid = require('uuid');


/**
 * Represents a local HTTP(s) server that abstracts the upload and download
 * of files away to a simple request. Files are encrypted to the given public
 * key, split into shards for erasure codes. Prepped for distribution and
 * queued for storing in the network. Bridge exposes a simple API for getting
 * status of transfers and previously stored objects.
 *
 * GET    /       (List objects as JSON)
 * GET    /{hash} (Download object)
 * DELETE /{hash} (Delete object)
 * POST   /       (Upload object - Multipart)
 */
class Bridge {

  static get DEFAULTS() {
    return {
      auth: {
        user: null,
        pass: null
      },
      store: path.join(
        tmpdir(),
        `objects.${crypto.randomBytes(16).toString('hex')}`
      ),
      stage: path.join(
        tmpdir(),
        `staging.${crypto.randomBytes(16).toString('hex')}`
      ),
      capacityCache: null,
      auditInterval: 432000000 // 5 days
    };
  }

  /**
   * @constructor
   * @param {Node} node
   */
  constructor(node, options) {
    this.options = merge(Bridge.DEFAULTS, options);
    this.objects = tiny(this.options.store);
    this.node = node;
    this.server = http.createServer(this.createRequestHandler());

    if (!fs.existsSync(this.options.stage)) {
      mkdirp.sync(this.options.stage);
    }

    setInterval(() => this.audit(), 21600000); // 6 hours
  }

  /**
   * Listens on the given port and hostname
   * @param {number} port
   * @param {string} hostname
   * @param {function} callback
   */
  listen() {
    this.server.listen(...arguments);
  }

  /**
   * Creates request router and handler stack
   * @returns {function}
   */
  createRequestHandler() {
    const handler = connect();

    handler.use(this.authenticate.bind(this));
    handler.use('/', this.route.bind(this));
    handler.use(this.error.bind(this));

    return handler;
  }

  /**
   * Handles request authentication if defined
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  authenticate(req, res, next) {
    const { user, pass } = this.options.auth;
    const error = new Error('Not authorized');

    error.code = 401;

    if (user && pass) {
      const creds = auth(req);

      if (!(creds.name === user && creds.pass === pass)) {
        return next(error);
      }
    }

    next();
  }

  /**
   * Responds to requests with error code and message
   * @param {error} error
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  error(err, req, res, next) {
    if (!err) {
      return next();
    }

    res.writeHead(err.code);
    res.write(err.message);
    res.end();
  }

  /**
   * Handles routing requests to their appropriate handler
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  route(req, res, next) {
    const { method, url } = req;

    function badRequest() {
      let error = new Error(`Cannot ${method} ${url}`);
      error.code = 400;
      next(error);
    }

    if (method === 'POST') {
      if (url !== '/') {
        badRequest();
      } else {
        this.upload(req, res, next);
      }
    } else if (method === 'GET') {
      if (url === '/') {
        this.list(req, res, next);
      } else {
        this.download(req, res, next);
      }
    } else if (method === 'DELETE') {
      if (url === '/') {
        badRequest();
      } else {
        this.destroy(req, res, next);
      }
    } else {
      badRequest();
    }
  }

  /**
   * Scans the object database and returns all index entries
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  list(req, res, next) {
    let written = 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('[')

    this.objects.each((obj) => {
      res.write((written === 0 ? '' : ',') + JSON.stringify(obj));
      written++;
    });

    res.write(']');
    res.end();
  }

  /**
   * Queues the object for upload to the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  upload(req, res, next) {
    res.writeHead(501);
    res.end('Not Implemented');

    const busboy = new BusBoy({ headers: req.headers });
    const objects = [];

    busboy.on('file', (field, file, name, encoding, mime) => {
      const tmp = path.join(this.options.stage, uuid.v4());
      mkdirp.sync(tmp);

      const hash = crypto.createHash('sha256');
      const hasher = new stream.Transform({
        transform: (data, enc, cb) => {
          hash.update(data);
          cb(null, data);
        }
      });
      const writer = fs.createWriteStream(path.join(tmp, 'ciphertext'));
      const cipher = utils.createCipher(this.node.spartacus.publicKey,
                                        this.node.spartacus.privateKey);

      file.pipe(hasher).pipe(cipher).pipe(writer).on('finish', () => {
        const digest = hash.digest('hex');
        const stage = path.join(this.options.stage, digest);
        const ciphertext = path.join(stage, 'ciphertext');

        fs.renameSync(tmp, stage);
        objects.push({ hash: digest, encoding, mimetype: mime });
        this.distribute(ciphertext, { encoding, mimetype: mime });
      });
    });

    busboy.on('finish', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(objects));
    });

    req.pipe(busboy);
  }

  /**
   * Takes the supplied file path and applies erasure codes, then attempts to
   * distribute the shards across the network
   * @param {string} filepath - Path to the file to distribute
   * @param {object} metadata
   * @param {string} metadata.encoding
   * @param {string} metadata.mimetype
   * @param {string} metadata.hash
   * @returns {EventEmitter}
   */
  distribute(filepath, metadata) {
    const stat = fs.statSync(filepath);
    const rsparams = utils.getErasureParameters(stat.size);

    // TODO: Load object and apply RS erasure codes
    // TODO: Write individual shards as parts to staging area
    // TODO: Unlink original non-sharded file
    // TODO: Generate challenges for each shard
    // TODO: Publish or claim a contract for each shard
    // TODO: Upload each shard to respective farmer node
    // TODO: Keep object pointer updated for retrieval later
  }

  /**
   * Downloads the object from the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  download(req, res, next) {
    res.writeHead(501);
    res.end('Not Implemented');
    // TODO: Lookup object and get shard pointers
    // TODO: Request a download token for each shard
    // TODO: Download each shard (minimum RS?)
    // TODO: Respond to request with decrypted stream
  }

  /**
   * Ends contracts with farmers for the object parts and removes
   * reference to them
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  destroy(req, res, next) {
    res.writeHead(501);
    res.end('Not Implemented');
    // TODO: For each shard referenced by the object
    // TODO: Set the store_end time in the contract to now
    // TODO: Issue a RENEW message to the associated farmer node
    // TODO: Issue any final payment for storage
    // TODO: Remove the object reference
    // TODO: Respond immediately after queuing the destroy
    // TODO: (Status can be checked with GET /)
  }

  /**
   * Periodically call this to scan the object store for shards that need to
   * be audited, perform audit, and issue payment
   * @param {function} callback
   */
  audit(callback) {
    callback(new Error('Auditor not implemented'));
  }

}

module.exports = Bridge;
