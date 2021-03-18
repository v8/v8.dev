---
title: 'V8 release v9.0'
author: 'Ingvar Stepanyan, standing inline'
avatars:
 - 'ingvar-stepanyan'
date: 2021-03-17
tags:
 - release
description: 'V8 release v9.0 brings support for RegExp match indices and various performance improvements.'
tweet: '1372227274712494084'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.0](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.0), which is in beta until its release in coordination with Chrome 90 Stable in several weeks. V8 v9.0 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### RegExp match indices

Starting in v9.0, developers may opt into getting an array of the start and end positions of matched capture groups in regular expression matches. This array is available via the `.indices` property on match objects when the regular expression has the `/d` flag.

```javascript
const re = /(a)(b)/d;        // Note the /d flag.
const m = re.exec('ab');
console.log(m.indices[0]); // Index 0 is the whole match.
// → [0, 2]
console.log(m.indices[1]); // Index 1 is the 1st capture group.
// → [0, 1]
console.log(m.indices[2]); // Index 2 is the 2nd capture group.
// → [1, 2]
```

Please see [our explainer](https://v8.dev/features/regexp-match-indices) for an in-depth dive.

### Faster `super` property access

Accessing `super` properties (for example, `super.x`) has been optimized by using V8’s inline cache system and optimized code generation in TurboFan. With these changes, `super` property access is now closer to being on par with regular property access, as can be seen from the graphs below.

![Compare super property access to regular property access, optimized](/_img/fast-super/super-opt.svg)

Please see [the dedicated blog post](https://v8.dev/blog/fast-super) for more details.

### `for ( async of` disallowed

A [grammar ambiguity](https://github.com/tc39/ecma262/issues/2034) was recently discovered and [fixed](https://chromium-review.googlesource.com/c/v8/v8/+/2683221) in V8 v9.0.

The token sequence `for ( async of` now no longer parses.

## WebAssembly

### Faster JS-to-Wasm calls

V8 uses different representations for the parameters of WebAssembly and JavaScript functions. For this reason, when JavaScript calls an exported WebAssembly function, the call goes through a so-called *JS-to-Wasm wrapper*, responsible for adapting parameters from JavaScript land to WebAssembly land as well as adapting results in the opposite direction.

Unfortunately, this comes with a performance cost, which meant that calls from JavaScript to WebAssembly were not as fast as calls from JavaScript to JavaScript. To minimize this overhead the JS-to-Wasm wrapper can now be inlined at the call site, simplifying the code and removing this extra frame.

Let’s say we have a WebAssembly function to add two double floating point numbers, like this:

```cpp
double addNumbers(double x, double y) {
  return x + y;
}
```

and say we call that from JavaScript to add some vectors (represented as typed arrays):

```javascript
const addNumbers = instance.exports.addNumbers;

function vectorSum(len, v1, v2) {
  const result = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = addNumbers(v1[i], v2[i]);
  }
  return result;
}

const N = 100_000_000;
const v1 = new Float64Array(N);
const v2 = new Float64Array(N);
for (let i = 0; i < N; i++) {
  v1[i] = Math.random();
  v2[i] = Math.random();
}

// Warm up.
for (let i = 0; i < 5; i++) {
  vectorSum(N, v1, v2);
}

// Measure.
console.time();
const result = vectorSum(N, v1, v2);
console.timeEnd();
```

On this simplified microbenchmark, we see the following improvements:

![Microbenchmark comparison](/_img/v8-release-90/js-to-wasm.svg)

The feature is still experimental and can be enabled through the `--turbo-inline-js-wasm-calls` flag.

For more details, see the [design document](https://docs.google.com/document/d/1mXxYnYN77tK-R1JOVo6tFG3jNpMzfueQN1Zp5h3r9aM/edit).

## V8 API

Please use `git log branch-heads/8.9..branch-heads/9.0 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.0 -t branch-heads/9.0` to experiment with the new features in V8 v9.0. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
