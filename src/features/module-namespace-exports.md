---
title: 'Module namespace exports'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2018-12-18
tags:
  - ECMAScript
  - ES2020
description: 'JavaScript modules now support new syntax to re-export all properties within a namespace.'
---
In [JavaScript modules](/features/modules), it was already possible to use the following syntax:

```js
import * as utils from './utils.mjs';
```

However, no symmetric `export` syntax existed… [until now](https://github.com/tc39/proposal-export-ns-from):

```js
export * as utils from './utils.mjs';
```

This is equivalent to the following:

```js
import * as utils from './utils.mjs';
export { utils };
```
