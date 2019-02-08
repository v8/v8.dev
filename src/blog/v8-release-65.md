---
title: 'V8 release v6.5'
author: 'the V8 team'
date: 2018-02-01 13:33:37
tags:
  - release
tweet: '959174292406640640'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.5](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.5), which is in beta until its release in coordination with Chrome 65 Stable in several weeks. V8 v6.5 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Untrusted code mode

In response to the latest speculative side-channel attack called Spectre, V8 introduced an [untrusted code mode](/docs/untrusted-code-mitigations). If you embed V8, consider leveraging this mode in case your application processes user-generated, not-trustworthy code. Please note that the mode is enabled by default, including in Chrome.

## Streaming compilation for WebAssembly code

The WebAssembly API provides a special function to support streaming compilation in combination with the `fetch()` API:

```js
const module = await WebAssembly.compileStreaming(fetch('foo.wasm'));
```

This API has been available since V8 v6.1 and Chrome 61, although the initial implementation didn’t actually use streaming compilation. However, with V8 v6.5 and Chrome 65 we take advantage of this API and compile WebAssembly modules already while we are still downloading the module bytes. As soon as we download all bytes of a single function, we pass the function to a background thread to compile it.

Our measurements show that with this API, the WebAssembly compilation in Chrome 65 can keep up with up to 50 Mbit/sec download speed on high-end machines. This means that if you download WebAssembly code with 50 Mbit/sec, compilation of that code finishes as soon as the download finishes.

For the graph below we measure the time it takes to download and compile a WebAssembly module with 67 MB and about 190,000 functions. We do the measurements with 25 Mbit/sec, 50 Mbit/sec, and 100 Mbit/sec download speed.

<figure>
  <img src="/_img/v8-release-65/wasm-streaming-compilation.png" intrinsicsize="1200x742" alt="">
</figure>

When the download time is longer than the compile time of the WebAssembly module, e.g. in the graph above with 25 Mbit/sec and 50 Mbit/sec, then `WebAssembly.compileStreaming()` finishes compilation almost immediately after the last bytes are downloaded.

When the download time is shorter than the compile time, then `WebAssembly.compileStreaming()` takes about as long as it takes to compile the WebAssembly module without downloading the module first.

## Speed

We continued to work on widening the fast-path of JavaScript builtins in general, adding a mechanism to detect and prevent a ruinous situation called a “deoptimization loop.” This occurs when your optimized code deoptimizes, and there is _no way to learn what went wrong_. In such scenarios, TurboFan just keeps trying to optimize, finally giving up after about 30 attempts. This would happen if you did something to alter the shape of the array in the callback function of any of our second order array builtins. For example, changing the `length` of the array — in v6.5, we note when that happens, and stop inlining the array builtin called at that site on future optimization attempts.

We also widened the fast-path by inlining many builtins that were formerly excluded because of a side-effect between the load of the function to call and the call itself, for example a function call. And `String.prototype.indexOf` got a [10× performance improvement in function calls](https://bugs.chromium.org/p/v8/issues/detail?id=6270).

In V8 v6.4, we’d inlined support for `Array.prototype.forEach`, `Array.prototype.map`, and `Array.prototype.filter`. In V8 v6.5 we’ve added inlining support for:

- `Array.prototype.reduce`
- `Array.prototype.reduceRight`
- `Array.prototype.find`
- `Array.prototype.findIndex`
- `Array.prototype.some`
- `Array.prototype.every`

Furthermore, we’ve widened the fast path on all these builtins. At first we would bail out on seeing arrays with floating-point numbers, or (even more bailing out) [if the arrays had “holes” in them](/blog/elements-kinds), e.g. `[3, 4.5, , 6]`. Now, we handle holey floating-point arrays everywhere except in `find` and `findIndex`, where the spec requirement to convert holes into `undefined` throws a monkey-wrench into our efforts (_for now…!_).

The following image shows the improvement delta compared to V8 v6.4 in our inlined builtins, broken down into integer arrays, double arrays, and double arrays with holes. Time is in milliseconds.

<figure>
  <img src="/_img/v8-release-65/performance-improvements.png" intrinsicsize="1598x988" alt="">
</figure>

## V8 API

Please use `git log branch-heads/6.4..branch-heads/6.5 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.5 -t branch-heads/6.5` to experiment with the new features in V8 v6.5. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
