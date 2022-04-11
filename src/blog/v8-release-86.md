---
title: 'V8 release v8.6'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), a keyboard fuzzer'
avatars:
 - 'ingvar-stepanyan'
date: 2020-09-21
tags:
 - release
description: 'V8 release v8.6 brings respectful code, performance improvements, and normative changes.'
tweet: '1308062287731789825'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.6), which is in beta until its release in coordination with Chrome 86 Stable in several weeks. V8 v8.6 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Respectful code

The v8.6 version makes the V8 code base [more respectful](https://v8.dev/docs/respectful-code). The team joined a Chromium-wide effort to follow Google’s commitments to racial equity by replacing some insensitive terms in the project. This is still an ongoing effort and any external contributor is welcome to give a hand! You can see the list of still available tasks [here](https://docs.google.com/document/d/1rK7NQK64c53-qbEG-N5xz7uY_QUVI45sUxinbyikCYM/edit).

## JavaScript

### Open sourced JS-Fuzzer

JS-Fuzzer is a mutation-based JavaScript fuzzer originally authored by Oliver Chang. It has been a cornerstone of V8's [stability](https://bugs.chromium.org/p/chromium/issues/list?q=ochang_js_fuzzer%20label%3AStability-Crash%20label%3AClusterfuzz%20-status%3AWontFix%20-status%3ADuplicate&can=1) and [security](https://bugs.chromium.org/p/chromium/issues/list?q=ochang_js_fuzzer%20label%3ASecurity%20label%3AClusterfuzz%20-status%3AWontFix%20-status%3ADuplicate&can=1) in the past and is now [open source](https://chromium-review.googlesource.com/c/v8/v8/+/2320330).

The fuzzer mutates existing cross-engine test cases using [Babel](https://babeljs.io/) AST transformations configured by extensible [mutator classes](https://chromium.googlesource.com/v8/v8/+/320d98709f/tools/clusterfuzz/js_fuzzer/mutators/). We recently also started running an instance of the fuzzer in differential-testing mode for detecting JavaScript [correctness issues](https://bugs.chromium.org/p/chromium/issues/list?q=blocking%3A1050674%20-status%3ADuplicate&can=1). Contributions are welcome! See the [README](https://chromium.googlesource.com/v8/v8/+/master/tools/clusterfuzz/js_fuzzer/README.md) for more.

### Speed-ups in `Number.prototype.toString`

Converting a JavaScript number to a string can be a surprisingly complex operation in the general case; we have to take into account floating point precision, scientific notation, NaNs, infinities, rounding, and so on. We don’t even know how big the resulting string will be before calculating it. Because of this, our implementation of `Number.prototype.toString` would bail out to a C++ runtime function.

But, a lot of the time, you just want to print a simple, small integer (a “Smi”). This is a much simpler operation, and the overheads of calling a C++ runtime function are no longer worth it. So we’ve worked with our friends at Microsoft to add a simple fast path for small integers to `Number.prototype.toString`, written in Torque, to reduce these overheads for this common case. This improved number printing microbenchmarks by ~75%.

### `Atomics.wake` removed

`Atomics.wake` was renamed to `Atomics.notify` to match a spec change [in v7.3](https://v8.dev/blog/v8-release-73#atomics.notify). The deprecated `Atomics.wake` alias is now removed.

### Small normative changes

- Anonymous classes now have a `.name` property whose value is the empty string `''`. [Spec change](https://github.com/tc39/ecma262/pull/1490).
- The `\8` and `\9` escape sequences are now illegal in template string literals in [sloppy mode](https://developer.mozilla.org/en-US/docs/Glossary/Sloppy_mode) and in all string literals in [strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode). [Spec change](https://github.com/tc39/ecma262/pull/2054).
- The built-in `Reflect` object now has a `Symbol.toStringTag` property whose value is `'Reflect'`. [Spec change](https://github.com/tc39/ecma262/pull/2057).

## WebAssembly

### SIMD on Liftoff

Liftoff is the baseline compiler for WebAssembly, and as of V8 v8.5 is shipped on all platforms. The [SIMD proposal](https://v8.dev/features/simd) enables WebAssembly to take advantage of commonly available hardware vector instructions to accelerate compute-intensive workloads. It is currently in an [Origin Trial](https://v8.dev/blog/v8-release-84#simd-origin-trial), which allows developers to experiment with a feature before it is standardized.

Up until now, SIMD was implemented only in TurboFan, V8's top tier compiler. This is necessary to get maximum performance out of the SIMD instructions. WebAssembly modules that use SIMD instructions will have faster startup, and often faster runtime performance than their scalar equivalents compiled with TurboFan. For example, given a function that takes an array of floats and clamps its values to zero (written here in JavaScript for clarity):

```js
function clampZero(f32array) {
  for (let i = 0; i < f32array.length; ++i) {
    if (f32array[i] < 0) {
      f32array[i] = 0;
    }
  }
}
```

Let’s compare two different implementations of this function, using Liftoff and TurboFan:

1. A scalar implementation, with the loop unrolled 4 times.
2. A SIMD implementation, using the `i32x4.max_s` instruction.

Using the Liftoff scalar implementation as a baseline, we see the following results:

![A graph showing Liftoff SIMD being ~2.8× faster than Liftoff scalar vs. TurboFan SIMD being ~7.5× faster](/_img/v8-release-86/simd.svg)

### Faster Wasm-to-JS calls

If WebAssembly calls an imported JavaScript function, we call through a so-called “Wasm-to-JS wrapper” (or “import wrapper”). This wrapper [translates the arguments](https://webassembly.github.io/spec/js-api/index.html#tojsvalue) to objects that JavaScript understands, and when the call to JavaScript returns, it translates back the return value(s) [to WebAssembly](https://webassembly.github.io/spec/js-api/index.html#towebassemblyvalue).

In order to ensure that the JavaScript `arguments` object reflects exactly the arguments that were passed from WebAssembly, we call through a so-called “arguments adapter trampoline” if a mismatch in the number of arguments is detected.

In many cases though, this is not needed, because the called function does not use the `arguments` object. In v8.6, we landed a [patch](https://crrev.com/c/2317061) by our Microsoft contributors that avoids the call through the arguments adapter in those cases, which makes affected calls significantly faster.

## V8 API

### Detect pending background tasks with `Isolate::HasPendingBackgroundTasks`

The new API function `Isolate::HasPendingBackgroundTasks` allows embedders to check if there is pending background work that will eventually post new foreground tasks, like WebAssembly compilation.

This API should solve the problem where an embedder shuts down V8 even though there is still pending WebAssembly compilation that will eventually kick off further script execution. With `Isolate::HasPendingBackgroundTasks` the embedder can wait for new foreground tasks instead of shutting down V8.

Please use `git log branch-heads/8.5..branch-heads/8.6 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 8.6 -t branch-heads/8.6` to experiment with the new features in V8 v8.6. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
