# v8.dev [![Build status](https://travis-ci.com/v8/v8.dev.svg?branch=master)](https://travis-ci.com/v8/v8.dev)

This repository hosts the source code of [v8.dev, the official website of the V8 project](https://v8.dev/).

## Local setup

1. Clone the repository and `cd` into it.
1. Install and use the [expected](https://github.com/v8/v8.dev/blob/master/.nvmrc) Node.js version: `nvm use`
1. Install dependencies: `npm install`

`npm run` shows the full list of supported commands. Highlights:

- `npm run build` builds the site into `dist`.
- `npm run watch` builds the site into `dist` and watches for changes.
- `npm start` kicks off a local HTTP server.

## Build on Windows

The `package.json` contains Unix-specific commands.
If you are using a Linux environment on Windows like git bash, msys2, or Cygwin, then you can configure `npm` to use it. This replaces the default behavior of using `cmd.exe`.
For example:
```
npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"
```
or
```
 npm config set script-shell "C:\\msys64\\usr\\bin\\sh.exe"
```
You will still need to run npm with a `PATH` that includes Linux utilities like `mkdir` and `rm`. Practically, it should work if you run `npm` from your Linux-compatible shell.
