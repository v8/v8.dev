---
title: 'V8 release v7.3'
author: 'Clemens Hammacher, compiler wrangler'
avatars:
  - clemens-hammacher
date: 2019-02-07 11:30:42
tags:
  - release
tweet: '1093457099441561611'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.3](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.3), which is in beta until its release in coordination with Chrome 73 Stable in several weeks. V8 v7.3 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Async stack traces

We are turning on [the `--async-stack-traces` flag](/blog/fast-async#improved-developer-experience) by default. [Zero-cost async stack traces](https://bit.ly/v8-zero-cost-async-stack-traces) make it easier to diagnose problems in production with heavily asynchronous code, as the `error.stack` property that is usually sent to log files/services now provides more insight into what caused the problem.

## Faster `await`

Related to the above-mentioned `--async-stack-traces` flag, we’re also enabling the `--harmony-await-optimization` flag by default, which is a prerequisite for the `--async-stack-traces`. See [faster async functions and promises](/blog/fast-async#await-under-the-hood) for more details.

## Faster Wasm startup

Via optimizations to the internals of Liftoff, we improved WebAssembly compilation speed significantly without regressing the quality of the generated code. For most workloads, compilation time reduced by 15–25%.

<figure>
  <img src="/_img/v8-release-73/liftoff-epic.svg" alt="">
  <figcaption>Liftoff compile time on <a href="https://s3.amazonaws.com/mozilla-games/ZenGarden/EpicZenGarden.html">the Epic ZenGarden demo</a></figcaption>
</figure>

## JavaScript language features

V8 v7.3 comes with several new JavaScript language features.

### `Object.fromEntries`

The `Object.entries` API is nothing new:

```js
const object = { x: 42, y: 50 };
const entries = Object.entries(object);
// → [['x', 42], ['y', 50]]
```

Unfortunately, there’s no easy way to go from the `entries` result back to an equivalent object… until now!

V8 v7.3 supports `Object.fromEntries()`, a new built-in API that performs the inverse of `Object.entries`:

```js
const result = Object.fromEntries(entries);
// → { x: 42, y: 50 }
```

With both `Object.entries` and `Object.fromEntries` in the language, it’s now easier than ever to [convert between `Map`s and ordinary objects in JavaScript](https://github.com/tc39/proposal-object-from-entries#when-is-this-useful).

### `String.prototype.matchAll`

A common use case of global (`g`) or sticky (`y`) regular expressions is applying it to a string and iterating through all of the matches. The new `String.prototype.matchAll` API makes this easier than ever before, especially for regular expressions with capture groups:

```js
const string = 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev';
const regex = /\b(?<owner>[a-z0-9]+)\/(?<repo>[a-z0-9\.]+)\b/g;

for (const match of string.matchAll(regex)) {
  console.log(`${match[0]} at ${match.index} with '${match.input}'`);
  console.log(`→ owner: ${match.groups.owner}`);
  console.log(`→ repo: ${match.groups.repo}`);
}

// Output:
//
// tc39/ecma262 at 23 with 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev'
// → owner: tc39
// → repo: ecma262
// v8/v8.dev at 36 with 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev'
// → owner: v8
// → repo: v8.dev
```

For more details, read [our Web Fundamentals article on `String.prototype.matchAll`](https://developers.google.com/web/updates/2019/02/string-matchall).

### `Atomics.notify`

`Atomics.wake` has been renamed to `Atomics.notify`, matching [a recent spec change](https://github.com/tc39/ecma262/pull/1220).

## V8 API

Please use `git log branch-heads/7.2..branch-heads/7.3 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.3 -t branch-heads/7.3` to experiment with the new features in V8 v7.3. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
