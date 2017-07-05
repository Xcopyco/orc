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

