---
title: 'V8 release v6.9'
author: 'the V8 team'
date: 2018-08-07 13:33:37
tags:
  - release
tweet: '1026825606003150848'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.9), which is in beta until its release in coordination with Chrome 69 Stable in several weeks. V8 v6.9 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Memory savings through embedded built-ins

V8 ships with an extensive library of built-in functions. Examples are methods on built-in objects such as `Array.prototype.sort` and `RegExp.prototype.exec`, but also a wide range of internal functionality. Because their generation takes a long time, built-in functions are compiled at build-time and serialized into a [snapshot](/blog/custom-startup-snapshots), which is later deserialized at runtime to create the initial JavaScript heap state.

Built-in functions currently consume 700 KB in each Isolate (an Isolate roughly corresponds to a browser tab in Chrome). This is quite wasteful, and last year we began working on reducing this overhead. In V8 v6.4, we shipped [lazy deserialization](/blog/lazy-deserialization), ensuring that each Isolate only pays for the built-ins that it actually needs (but each Isolate still had its own copy).

[Embedded built-ins](/blog/embedded-builtins) go one step further. An embedded built-in is shared by all Isolates, and embedded into the binary itself instead of copied onto the JavaScript heap. This means that built-ins exist in memory only once regardless of how many Isolates are running, an especially useful property now that [Site Isolation](https://developers.google.com/web/updates/2018/07/site-isolation) has been enabled by default. With embedded built-ins, we’ve seen a median _9% reduction of the V8 heap size_ over the top 10k websites on x64. Of these sites, 50% save at least 1.2 MB, 30% save at least 2.1 MB, and 10% save 3.7 MB or more.

V8 v6.9 ships with support for embedded built-ins on x64 platforms. Other platforms will follow soon in upcoming releases. For more details, see our [dedicated blog post](/blog/embedded-builtins).

## Performance

### Liftoff, WebAssembly’s new first-tier compiler

WebAssembly got a new baseline compiler for much faster startup of complex websites with big WebAssembly modules (such as Google Earth and AutoCAD). Depending on the hardware we are seeing speedups of more than 10×. For more details, refer to [the detailed Liftoff blog post](/blog/liftoff).

<figure>
  <img src="/_img/v8-liftoff.svg" width="256" height="256" intrinsicsize="187x187" alt="">
  <figcaption>Logo for Liftoff, V8’s baseline compiler for WebAssembly</figcaption>
</figure>

### Faster `DataView` operations

[`DataView`](https://tc39.es/ecma262/#sec-dataview-objects) methods have been reimplemented in V8 Torque, which spares a costly call to C++ compared to the former runtime implementation. Moreover, we now inline calls to `DataView` methods when compiling JavaScript code in TurboFan, resulting in even better peak performance for hot code. Using `DataView`s is now as efficient as using `TypedArray`s, finally making `DataView`s a viable choice in performance-critical situations. We’ll be covering this in more detail in an upcoming blog post about `DataView`s, so stay tuned!

### Faster processing of `WeakMap`s during garbage collection

V8 v6.9 reduces Mark-Compact garbage collection pause times by improving `WeakMap` processing. Concurrent and incremental marking are now able to process `WeakMap`s, whereas previously all this work was done in the final atomic pause of Mark-Compact GC. Since not all work can be moved outside of the pause, the GC now also does more work in parallel to further reduce pause times. These optimizations essentially halved the average pause time for Mark-Compact GCs in [the Web Tooling Benchmark](https://github.com/v8/web-tooling-benchmark).

`WeakMap` processing uses a fixed-point iteration algorithm that can degrade to quadratic runtime behavior in certain cases. With the new release, V8 is now able to switch to another algorithm that is guaranteed to finish in linear time if the GC does not finish within a certain number of iterations. Previously, worst-case examples could be constructed that took the GC a few seconds to finish even with a relatively small heap, while the linear algorithm finishes within a few milliseconds.

## JavaScript language features

V8 v6.9 supports [`Array.prototype.flat` and `Array.prototype.flatMap`](/features/array-flat-flatmap).

`Array.prototype.flat` flattens a given array recursively up to the specified `depth`, which defaults to `1`:

```js
// Flatten one level:
const array = [1, [2, [3]]];
array.flat();
// → [1, 2, [3]]

// Flatten recursively until the array contains no more nested arrays:
array.flat(Infinity);
// → [1, 2, 3]
```

`Array.prototype.flatMap` is like `Array.prototype.map`, except it flattens the result into a new array.

```js
[2, 3, 4].flatMap((x) => [x, x * 2]);
// → [2, 4, 3, 6, 4, 8]
```

For more details, see [our `Array.prototype.{flat,flatMap}` explainer](/features/array-flat-flatmap).

## V8 API

Please use `git log branch-heads/6.8..branch-heads/6.9 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.9 -t branch-heads/6.9` to experiment with the new features in V8 v6.9. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
