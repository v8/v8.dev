---
title: 'V8 release v7.2'
author: 'Andreas Haas, handler of traps'
avatars:
  - andreas-haas
date: 2018-12-18 11:48:21
tags:
  - release
tweet: '1074978755934863361'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.2](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.2), which is in beta until its release in coordination with Chrome 72 Stable in several weeks. V8 v7.2 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Memory

[Embedded builtins](/blog/embedded-builtins) are now supported and enabled by default on the ia32 architecture.

## Performance

### JavaScript parsing

On average web pages spend 9.5% of the V8 time at startup on parsing JavaScript. Thus we have focused on shipping V8's fastest JavaScript parser yet with v7.2. We have drastically improved parsing speed across the board. Since v7.0 the parsing speed improved by roughly 30% on desktop. The following graph documents the impressive improvements on our real-world Facebook loading benchmark over the last months.

<figure>
  <img src="/_img/v8-release-72/facebook-parse-time.png" srcset="/_img/v8-release-72/facebook-parse-time@2x.png 2x" alt="">
  <figcaption>V8 parse time on facebook.com (lower is better)</figcaption>
</figure>

We have focused on the parser on different occasions. The following graphs show the improvements relative to the latest v7.2 release across several popular websites.

<figure>
  <img src="/_img/v8-release-72/relative-parse-times.svg" alt="">
  <figcaption>V8 parse times relative to V8 v7.2 (lower is better)</figcaption>
</figure>

All in all, the recent improvements have reduced the average parse percentage from 9.5% to 7.5% resulting in faster load times and more responsive pages.

### `async`/`await`

V8 v7.2 comes with [a faster `async`/`await` implementation](/blog/fast-async#await-under-the-hood). We have made [a spec proposal](https://github.com/tc39/ecma262/pull/1250) and are currently gathering web compatibility data in order for the change to be officially merged into the ECMAScript specification.

### Spread elements

V8 v7.2 greatly improves the performance of spread elements when they occur at the front of the array literal, for example `[...x]` or `[...x, 1, 2]`. The improvement applies to spreading arrays, primitive strings, sets, map keys, map values, and — by extension — to `Array.from(x)`. For more details, see [our in-depth article on speeding up spread elements](/blog/spread-elements).

### WebAssembly

We analyzed a number of WebAssembly benchmarks and used them to guide improved code generation in the top execution tier. In particular, V8 v7.2 enables node splitting in the optimizing compiler’s scheduler and loop rotation in the backend. We also improved wrapper caching and introduced custom wrappers that reduce overhead in calling imported JavaScript math functions. Additionally, we designed changes to the register allocator that improve performance for many code patterns that will land in a later version.

### Trap handlers

Trap handlers are improving the general throughput of WebAssembly code. They are implemented and available on Windows, macOS and Linux in V8 v7.2. In Chromium they are enabled on Linux. Windows and macOS will follow suit when there is confirmation regarding stability. We’re currently working on making them available on Android too.

## Async stack traces

As [mentioned earlier](/blog/fast-async#improved-developer-experience), we've added a new feature called [zero-cost async stack traces](https://bit.ly/v8-zero-cost-async-stack-traces), which enriches the `error.stack` property with asynchronous call frames. It's currently available behind the `--async-stack-traces` command-line flag.

## JavaScript language features

### Public class fields

V8 v7.2 adds support for [public class fields](https://developers.google.com/web/updates/2018/12/class-fields). Instead of:

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Cat extends Animal {
  constructor(name) {
    super(name);
    this.likesBaths = false;
  }
  meow() {
    console.log('Meow!');
  }
}
```

…you can now write:

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Cat extends Animal {
  likesBaths = false;
  meow() {
    console.log('Meow!');
  }
}
```

Support for [private class fields](https://developers.google.com/web/updates/2018/12/class-fields#private_class_fields) is planned for a future V8 release.

### `Intl.ListFormat`

V8 v7.2 adds support for [the `Intl.ListFormat` proposal](https://developers.google.com/web/updates/2018/12/intl-listformat), enabling localized formatting of lists.

```js
const lf = new Intl.ListFormat('en');
lf.format(['Frank']);
// → 'Frank'
lf.format(['Frank', 'Christine']);
// → 'Frank and Christine'
lf.format(['Frank', 'Christine', 'Flora']);
// → 'Frank, Christine, and Flora'
lf.format(['Frank', 'Christine', 'Flora', 'Harrison']);
// → 'Frank, Christine, Flora, and Harrison'
```

For more information and usage examples, check out [our Web Fundamentals update on `Intl.ListFormat`](https://developers.google.com/web/updates/2018/12/intl-listformat).

### Well-formed `JSON.stringify`

`JSON.stringify` was previously specified to return ill-formed Unicode strings if the input contains any lone surrogates:

```js
JSON.stringify('\uD800');
// → '"�"'
```

V8 now implements [a stage 3 proposal](https://github.com/tc39/proposal-well-formed-stringify) that changes `JSON.stringify` so it outputs escape sequences for lone surrogates, making its output valid Unicode (and representable in UTF-8):

```js
JSON.stringify('\uD800');
// → '"\ud800"'
```

Note that `JSON.parse(stringified)` still produces the same results as before.

### Module namespace exports

In [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules), it was already possible to use the following syntax:

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

## V8 API

Please use `git log branch-heads/7.1..branch-heads/7.2 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.2 -t branch-heads/7.2` to experiment with the new features in V8 v7.1. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
