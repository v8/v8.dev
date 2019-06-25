---
title: '`Symbol.prototype.description`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-06-25
tags:
  - ECMAScript
  - ES2019
tweet: '1143432835665211394'
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
symbol.toString().slice(7, -1); // 🤔
// → 'foo'
```

However, the code is slightly magical-looking, not very self-explanatory, and violates the “express intent, not implementation” principle. The above technique also doesn’t let you distinguish between a symbol with no description (i.e. `Symbol()`) and a symbol with the empty string as its description (i.e. `Symbol('')`).

[The new `Symbol.prototype.description` getter](https://tc39.es/ecma262/#sec-symbol.prototype.description) provides a more ergonomic way of accessing the description of a `Symbol`:

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
                 babel="yes"></feature-support>
