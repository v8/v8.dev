---
title: 'V8 release v6.4'
author: 'the V8 team'
date: 2017-12-19 13:33:37
tags:
  - release
description: 'V8 v6.4 includes performance improvements, new JavaScript language features, and more.'
tweet: '943057597481082880'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.4](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.4), which is in beta until its release in coordination with Chrome 64 Stable in several weeks. V8 v6.4 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Speed

V8 v6.4 [improves](https://bugs.chromium.org/p/v8/issues/detail?id=6971) the performance of the `instanceof` operator by 3.6×. As a direct result, [uglify-js](http://lisperator.net/uglifyjs/) is now 15–20% faster according to [V8’s Web Tooling Benchmark](https://github.com/v8/web-tooling-benchmark).

This release also addresses some performance cliffs in `Function.prototype.bind`. For example, TurboFan now [consistently inlines](https://bugs.chromium.org/p/v8/issues/detail?id=6946) all monomorphic calls to `bind`. In addition, TurboFan also supports the _bound callback pattern_, meaning that instead of the following:

```js
doSomething(callback, someObj);
```

You can now use:

```js
doSomething(callback.bind(someObj));
```

This way, the code is more readable, and you still get the same performance.

Thanks to [Peter Wong](https://twitter.com/peterwmwong)’s latest contributions, [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) and [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet) are now implemented using the [CodeStubAssembler](/blog/csa), resulting in performance improvements of up to 5× across the board.

![](/_img/v8-release-64/weak-collection.svg)

As part of V8’s [on-going effort](https://bugs.chromium.org/p/v8/issues/detail?id=1956) to improve the performance of array built-ins, we improved `Array.prototype.slice` performance ~4× by reimplementing it using the CodeStubAssembler. Additionally, calls to `Array.prototype.map` and `Array.prototype.filter` are now inlined for many cases, giving them a performance profile competitive with hand-written versions.

We worked to make out-of-bounds loads in arrays, typed arrays, and strings [no longer incur a ~10× performance hit](https://bugs.chromium.org/p/v8/issues/detail?id=7027) after noticing [this coding pattern](/blog/elements-kinds#avoid-reading-beyond-length) being used in the wild.

## Memory

V8’s built-in code objects and bytecode handlers are now deserialized lazily from the snapshot, which can significantly reduce memory consumed by each Isolate. Benchmarks in Chrome show savings of several hundred KB per tab when browsing common sites.

![](/_img/v8-release-64/codespace-consumption.svg)

Look out for a dedicated blog post on this subject early next year.

## ECMAScript language features

This V8 release includes support for two new exciting regular expression features.

In regular expressions with the `/u` flag, [Unicode property escapes](https://mathiasbynens.be/notes/es-unicode-property-escapes) are now enabled by default.

```js
const regexGreekSymbol = /\p{Script_Extensions=Greek}/u;
regexGreekSymbol.test('π');
// → true
```

Support for [named capture groups](https://developers.google.com/web/updates/2017/07/upcoming-regexp-features#named_captures) in regular expressions is now enabled by default.

```js
const pattern = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/u;
const result = pattern.exec('2017-12-15');
// result.groups.year === '2017'
// result.groups.month === '12'
// result.groups.day === '15'
```

More details about these features are available in our blog post titled [Upcoming regular expression features](https://developers.google.com/web/updates/2017/07/upcoming-regexp-features).

Thanks to [Groupon](https://twitter.com/GrouponEng), V8 now implements [`import.meta`](https://github.com/tc39/proposal-import-meta), which enables embedders to expose host-specific metadata about the current module. For example, Chrome 64 exposes the module URL via `import.meta.url`, and Chrome plans to add more properties to `import.meta` in the future.

To assist with local-aware formatting of strings produced by internationalization formatters, developers can now use [`Intl.NumberFormat.prototype.formatToParts()`](https://github.com/tc39/proposal-intl-formatToParts) to format a number to a list of tokens and their type. Thanks to [Igalia](https://twitter.com/igalia) for implementing this in V8!

## V8 API

Please use `git log branch-heads/6.3..branch-heads/6.4 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.4 -t branch-heads/6.4` to experiment with the new features in V8 v6.4. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
