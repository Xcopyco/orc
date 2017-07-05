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
the same classes to directly implement your own ORC node within your project.
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
library provides a very low level interface for the ORC protocol and is not 
intended for casual integration with the ORC network.
