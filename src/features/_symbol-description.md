---
title: '`Symbol.prototype.description`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-05-20
tags:
  - ECMAScript
  - ES2019
tweet: 'TODO'
---
JavaScript `Symbol`s can be given a description upon creation:

```js
const symbol = Symbol('foo');
//                    ^^^^^
```

Previously, the only way to access this description programmatically was indirectly through `Symbol.prototype.toString()`:

```js
const symbol = Symbol('foo');
//                    ^^^^^
symbol.toString();
// → 'Symbol(foo)'
//           ^^^
```

[The new `Symbol.prototype.description` getter](https://tc39.es/proposal-Symbol-description/) provides a more ergonomic way of accessing the description of a `Symbol`:

```js
const symbol = Symbol('foo');
//                    ^^^^^
symbol.description;
// → 'foo'
```

For `Symbol`s without a description, the getter returns `undefined`:

```js
const symbol = Symbol();
symbol.description;
// → undefined
```

## `Symbol.prototype.description` support { #support }

<feature-support chrome="70 /blog/v8-release-70#javascript-language-features"
                 firefox="63"
                 safari="12.1"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="no"></feature-support>
