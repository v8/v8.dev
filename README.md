# v8.dev [![Build status](https://github.com/v8/v8.dev/actions/workflows/deploy.yml/badge.svg)](https://github.com/v8/v8.dev/actions/workflows/deploy.yml)

This repository hosts the source code of [v8.dev, the official website of the V8 project](https://v8.dev/).

## Local setup

1. Clone the repository and `cd` into it.
1. Install and use the [expected](https://github.com/v8/v8.dev/blob/main/.nvmrc) Node.js version: `nvm use`
1. Install dependencies: `npm install`

`npm run` shows the full list of supported commands. Highlights:

- `npm run build` builds the site into `dist`.
- `npm run watch` builds the site into `dist` and watches for changes.
- `npm start` kicks off a local HTTP server.
