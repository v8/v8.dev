---
title: '`globalThis`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-07-16
tags:
  - ECMAScript
  - ES2020
  - Node.js 12
  - io19
description: 'globalThis introduces a unified mechanism to access the global this in any JavaScript environment, regardless of the script goal.'
tweet: '1151140681374547969'
---
If you’ve written JavaScript for use in a web browser before, you may have used `window` to access the global `this`. In Node.js, you may have used `global`. If you’ve written code that must work in either environment, you may have detected which of these is available, and then used that — but the list of identifiers to check grows with the number of environments and use cases you want to support. It gets out of hand quickly:

```js
// A naive attempt at getting the global `this`. Don’t use this!
const getGlobalThis = () => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  // Note: this might still return the wrong result!
  if (typeof this !== 'undefined') return this;
  throw new Error('Unable to locate global `this`');
};
const theGlobalThis = getGlobalThis();
```

For more details on why the above approach is insufficient (as well as an even more complicated technique), read [_a horrifying `globalThis` polyfill in universal JavaScript_](https://mathiasbynens.be/notes/globalthis).

[The `globalThis` proposal](https://github.com/tc39/proposal-global) introduces a *unified* mechanism to access the global `this` in any JavaScript environment (browser, Node.js, or something else?), regardless of the script goal (classic script or module?).

```js
const theGlobalThis = globalThis;
```

Note that modern code might not need access to the global `this` at all. With JavaScript modules, you can declaratively `import` and `export` functionality instead of messing with global state. `globalThis` is still useful for polyfills and other libraries that need global access.

## `globalThis` support { #support }

<feature-support chrome="71 /blog/v8-release-71#javascript-language-features"
                 firefox="65"
                 safari="12.1"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="yes"></feature-support>
