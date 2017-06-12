Orc
===

[![Build Status](https://img.shields.io/travis/orcproject/orc.svg?style=flat-square)](https://travis-ci.org/orcproject/orc)
[![Coverage Status](https://img.shields.io/coveralls/orcproject/orc.svg?style=flat-square)](https://coveralls.io/r/orcproject/orc)
[![NPM](https://img.shields.io/npm/v/@orcproject/orc.svg?style=flat-square)](https://www.npmjs.com/package/@orcproject/orc)
[![License](https://img.shields.io/badge/license-AGPL3.0-blue.svg?style=flat-square)](https://raw.githubusercontent.com/orcproject/orc/master/LICENSE)

The **Onion Routed Cloud**. Orc is a distributed anonymous cloud storage 
network owned and operated by _all of us_.

Docker Installation
-------------------

Pull the [image from Docker Hub](https://hub.docker.com/r/orcproject/orc/).

```
docker pull orcproject/orc
```

Create a data directory on the host.

```
mkdir path/to/orc.data
```

Run the Orc container and mount the data directory.

```
docker run -v path/to/orc.data:/root/.config/orc -t orcproject/orc:latest
```

Modify the created configuration at `path/to/orc.data/config` as desired (see 
[the configuration docs](https://github.com/orcproject/orc/blob/master/doc/config.md))
and restart the container for the changes to take effect. You might wish to 
expose the ports defined for `ControlPort` and `BridgePort` to the host (and 
update `ControlHostname` and `BridgeHostname` to `0.0.0.0`) and map them to the 
host.

```
docker run \
  --publish 127.0.0.1:4444:4444 \
  --publish 127.0.0.1:4445:4445 \
  --expose 4444 \
  --expose 4445 \
  --volume path/to/orc.data:/root/.config/orc \
  --tty orcproject/orc:latest
```

See the [`docker run` documentation](https://docs.docker.com/engine/reference/commandline/run/) 
for more information.

Manual Installation
-------------------

Make sure you have the following prerequisites installed:

* [Zcash](https://z.cash)
* [Tor](https://torproject.org)
* [Git](https://git-scm.org)
* [Node.js LTS + NPM (6.10.x)](https://nodejs.org)
* Python 2.7
* GCC/G++/Make

### Node.js + NPM

#### GNU+Linux & Mac OSX

```
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
```

Close your shell and open an new one. Now that you can call the `nvm` program,
install Node.js (which comes with NPM):

```
nvm install --lts
```

### Build Dependencies

#### GNU+Linux

Debian / Ubuntu / Mint / Trisquel / and Friends

```
apt install git python build-essential
```

Red Hat / Fedora / CentOS

```
yum groupinstall 'Development Tools'
```

You might also find yourself lacking a C++11 compiler - 
[see this](http://hiltmon.com/blog/2015/08/09/c-plus-plus-11-on-centos-6-dot-6/).

#### Mac OSX

```
xcode-select --install
```

Installation
------------

### Daemon + Utilities CLI

This package exposes two command line programs: `orc` and `orctool`. To 
install these, use the `--global` flag.

```
npm install -g @orcproject/orc
```

### Core Library

This package exposes a module providing a complete implementation of the 
protocol. To use it in your project, from your project's root directory, 
install as a dependency.

```
npm install @orcproject/orc --save
```

Usage
-----

### Command Line

Simply run `orc` with an optional [configuration file](https://github.com/orcproject/orc/blob/master/doc/config.md) 
using the `--config <path/to/config>` option.

### Spawning Child

The easiest way to get up and running with orc is to spawn a child process 
from your program and connect to it over the control port. This package exposes 
a convenience method for doing this. 

```js
const orc = require('@orcproject/orc');
const { child, controller } = orc(config);

// The `config` argument can be either a string path to config file to use or 
// a JSON dictionary of config properties. See configuration documentaion.

child.stdout.pipe(process.stdout); // Pipe log out put to stdout

controller.on('ready', () => {
  controller.invoke('ping', [contact], console.log); // Ping a contact
});
```

### Control Interface

You can run `orc` standalone and control it from any other application over 
its TCP control interface. See the _Resources_ section below to read up on the 
control protocol to implement it in the language of your choice. If using 
Node.js, you can use the client bundled in this package.

```js
const orc = require('@orcproject/orc');
const controller = new orc.control.Client();

controller.on('ready', () => {
  controller.invoke('ping', [contact], (err) => { /* handle result */ });
});

controller.connect(port);
```

If you wish to control your `orc` node from another language, simply connect 
to the control port over a TCP socket and use the 
[BOSCAR](https://github.com/bookchin/boscar) protocol to send RPC messages to 
the node. The methods and argument signatures map directly to the `orc.Node` 
API describe in the documentation. See *Resources* below.

### Direct Implementation

Since `orc` exposes all of the internals used to implement it, you can use 
the same classes to directly implement your own Orc node within your project.
Just import the package and construct a node instance with options.

```js
const orc = require('@orcproject/orc');
const node = new orc.Node(options);

node.listen(8443);
node.join(['known_node_id', { /* contact data */ }]);
```

Consult the documentation for a complete reference of the API exposed from the 
`Node` object. Further documentation on usage can be found by reviewing the 
end-to-end test suite in `test/node.e2e.js`. Note that using this package as a 
library provides a very low level interface for the Orc protocol and is not 
intended for casual integration with the Orc network.

Resources
---------

* [Orc Documentation](https://orcproject.github.io/orc/)
* [Orc Protocol Specification](https://raw.githubusercontent.com/orcproject/protocol/master/README.md)

License
-------

Orc - Onion Routed Cloud  
Copyright (C) 2017  Gordon Hall  
Copyright (C) 2016  Storj Labs, Inc

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see
[http://www.gnu.org/licenses/](http://www.gnu.org/licenses/).
