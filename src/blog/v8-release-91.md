---
title: 'V8 release v9.1'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), testing my private brand'
avatars:
 - 'ingvar-stepanyan'
date: 2021-05-04
tags:
 - release
description: 'V8 release v9.1 brings support for private brand checks, top-level await enabled by default and performance improvements.'
tweet: '1389613320953532417'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.1](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.1), which is in beta until its release in coordination with Chrome 91 Stable in several weeks. V8 v9.1 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### `FastTemplateCache` improvements

The v8 API exposes a `Template` interface to the embedders from which new instances can be created.

Creating and configuring new object instances requires several steps which is why it’s often faster to clone existing objects instead. V8 uses a two level cache strategy (small fast array cache and a large slow dictionary cache) to lookup recently created objects based on the templates and clone them directly.

Previously, the cache index for templates was assigned when the templates were created, rather than when they were inserted into the cache. This resulted in the fast array cache being reserved for the templates that were often never instantiated at all. Fixing this resulted in a 4.5% improvement in the Speedometer2-FlightJS benchmark.

### Top-level `await`

[Top-level `await`](https://v8.dev/features/top-level-await) is enabled by default in V8 starting with v9.1 and is available without `--harmony-top-level-await`.

Please note that for the [Blink rendering engine](https://www.chromium.org/blink), top-level `await` was already [enabled by default](https://v8.dev/blog/v8-release-89#top-level-await) in version 89.

Embedders should note that with this enablement, `v8::Module::Evaluate` always returns a `v8::Promise` object instead of the completion value. The `Promise` is resolved with the completion value if module evaluation succeeds and rejected with the error if evaluation fails. If the evaluated module is not asynchronous (i.e. does not contain top-level `await`) and does not have any asynchronous dependencies, the returned `Promise` will either be fulfilled or rejected. Otherwise the returned `Promise` will be pending.

Please see [our explainer](https://v8.dev/features/top-level-await) for more details.

### Private brand checks a.k.a. `#foo in obj`

The private brands check syntax is enabled by default in v9.1 without requiring `--harmony-private-brand-checks`. This feature extends the [`in` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in) to also work with private fields' `#`-names, such as in the following example.

```javascript
class A {
  static test(obj) {
    console.log(#foo in obj);
  }

  #foo = 0;
}

A.test(new A()); // true
A.test({}); // false
```

For a deeper dive, be sure to check out [our explainer](https://v8.dev/features/private-brand-checks).

### Short builtin calls

In this release we have temporarily turned unembed builtins (undoing [embedded builtins](https://v8.dev/blog/embedded-builtins)) on 64-bit desktop machines. The performance benefit of unembedding builtins on those machines outweighs the memory costs. This is due to architectural as well as micro-achitectural details.

We'll publish a separate blog post with more details soon.

## V8 API

Please use `git log branch-heads/9.0..branch-heads/9.1 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.1 -t branch-heads/9.1` to experiment with the new features in V8 v9.1. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
