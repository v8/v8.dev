---
title: 'V8 release v9.3'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
 - 'ingvar-stepanyan'
date: 2021-08-09
tags:
 - release
description: 'V8 release v9.3 brings support for Object.hasOwn and Error causes, improves compilation performance and disables untrusted codegen mitigations on Android.'
tweet: ''
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s main Git branch immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.3](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.3), which is in beta until its release in coordination with Chrome 93 Stable in several weeks. V8 v9.3 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### Sparkplug batch compilation

We released our super-fast new mid-tier JIT compiler [Sparkplug](https://v8.dev/blog/sparkplug) in v9.1. For security reasons V8 [write-protects](https://en.wikipedia.org/wiki/W%5EX) code memory that it generates, requiring it to flip permissions between writable (during compilation) and executable. This is currently implemented using `mprotect` calls. However, since Sparkplug generates code so quickly, the cost of calling `mprotect` for each individual compiled function became a major bottleneck in the compilation time. In V8 v9.3 we’re introducing batch compilation for Sparkplug: Instead of compiling each function individually, we compile multiple functions in a batch. This amortises the cost of flipping memory page permissions by doing it only once per batch.

Batch compilation reduces overall compilation time (Ignition + Sparkplug) by up to 44% without regressing JavaScript execution. If we only look at the cost of compiling Sparkplug code the impact is obviously larger, e.g. a reduction of 82% for the `docs_scrolling` benchmark (see below) on Win 10. Surprisingly enough, batch compilation improved compilation performance by even more than the cost of W^X, since batching similar operations together tends to be better for the CPU anyway. In the chart below you can see the impact of W^X on compile time (Ignition + Sparkplug), and how well batch compilation mitigated that overhead.

![Benchmarks](/_img/v8-release-93/sparkplug.svg)

### `Object.hasOwn`

`Object.hasOwn` is an easier-to-reach-for alias for `Object.prototype.hasOwnProperty.call`.

For example:

```javascript
Object.hasOwn({ prop: 42 }, 'prop')
// → true
```

Slightly more (but not much more!) details are available in our [feature explainer](https://v8.dev/features/object-has-own).

### Error cause

Starting in v9.3, the various built-in `Error` constructors are extended to accept an options bag with a `cause` property for the second parameter. If such an options bag is passed, the value of the `cause` property is installed as an own property on the `Error` instance. This provides a standardized way to chain errors.

For example:

```javascript
const parentError = new Error('parent');
const error = new Error('parent', { cause: parentError });
console.log(error.cause === parentError);
// → true
```

As usual, please see our more in-depth [feature explainer](https://v8.dev/features/error-cause).

## Untrusted code mitigations disabled on Android

Three years ago we introduced a set of [code generation mitigations](https://v8.dev/blog/spectre) to defend against Spectre attacks. We always realized that this was a temporary stop-gap that only provided partial protection against [Spectre](https://spectreattack.com/spectre.pdf) attacks. The only effective protection is to isolate websites via [Site Isolation](https://blog.chromium.org/2021/03/mitigating-side-channel-attacks.html).  Site Isolation has been enabled on Chrome on desktop devices for some time, however enabling full Site Isolation on Android has been more of a challenge due to resource constraints. However, as of Chrome 92, [Site Isolation on Android](https://security.googleblog.com/2021/07/protecting-more-with-site-isolation.html) has been enabled on many more sites that contain sensitive data.

Thus, we have decided to disable V8’s code generation mitigations for Spectre on Android. These mitigations are less effective than Site Isolation and impose a performance cost. Disabling them brings Android on par with desktop platforms, where they have been turned off since V8 v7.0. By disabling these mitigations we have seen some significant improvements in benchmark performance on Android.

![Performance improvements](/_img/v8-release-93/code-mitigations.svg)

## V8 API

Please use `git log branch-heads/9.2..branch-heads/9.3 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.3 -t branch-heads/9.3` to experiment with the new features in V8 v9.3. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
