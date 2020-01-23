# v8.dev [![Build status](https://travis-ci.com/v8/v8.dev.svg?branch=master)](https://travis-ci.com/v8/v8.dev)

This repository hosts the source code of [v8.dev, the official website of the V8 project](https://v8.dev/).

## Local setup

1. Clone the repository and `cd` into it.
1. Install and use the [expected](https://github.com/v8/v8.dev/blob/master/.nvmrc) Node.js version: `nvm use`
1. Install dependencies: `npm install`

`npm run` shows the full list of supported commands. Highlights:

- `npm run build` builds the site into `dist`.
- `npm run serve` kicks off a local HTTP server and watches for changes.
- `npm run lint` to run markdownlint.
