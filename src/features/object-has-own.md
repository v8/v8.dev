---
title: '`Object.hasOwn`'
author: 'Victor Gomes ([@VictorBFG](https://twitter.com/VictorBFG))'
avatars:
  - 'victor-gomes'
date: 2021-07-01
tags:
  - ECMAScript
description: '`Object.hasOwn` makes `Object.prototype.hasOwnProperty` more accessible.'
tweet: '1410577516943847424'
---

Today, it is very common to write code like this:

```js
const hasOwnProperty = Object.prototype.hasOwnProperty;

if (hasOwnProperty.call(object, 'foo')) {
  // `object` has property `foo`.
}
```

Or to use libraries that expose a simple version of `Object.prototype.hasOwnProperty`, such as [has](https://www.npmjs.com/package/has) or [lodash.has](https://www.npmjs.com/package/lodash.has).

With the [`Object.hasOwn` proposal](https://github.com/tc39/proposal-accessible-object-hasownproperty), we can simply write:

```js
if (Object.hasOwn(object, 'foo')) {
  // `object` has property `foo`.
}
```

`Object.hasOwn` is already available in V8 v9.3 behind the `--harmony-object-has-own` flag, and we’ll be rolling it out in Chrome soon.

## `Object.hasOwn` support { #support }

<feature-support chrome="yes https://chromium-review.googlesource.com/c/v8/v8/+/2922117"
                 firefox="yes https://hg.mozilla.org/try/rev/94515f78324e83d4fd84f4b0ab764b34aabe6d80"
                 safari="yes https://bugs.webkit.org/show_bug.cgi?id=226291"
                 nodejs="no"
                 babel="yes https://github.com/zloirock/core-js#accessible-objectprototypehasownproperty"></feature-support>
