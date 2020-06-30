---
title: 'V8 release v8.3'
author: 'Victor Gomes, safely working from home'
avatars:
 - 'victor-gomes'
date: 2020-05-04
tags:
 - release
description: 'V8 v8.3 features faster ArrayBuffers, bigger Wasm memories and deprecated APIs.'
tweet: '1257333120115847171'
---

Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.3](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.3), which is in beta until its release in coordination with Chrome 83 Stable in several weeks. V8 v8.3 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Performance

### Faster `ArrayBuffer` tracking in the garbage collector

Backing stores of `ArrayBuffer`s are allocated outside V8’s heap using  `ArrayBuffer::Allocator` provided by the embedder. These backing stores need to be released when their `ArrayBuffer` object is reclaimed by the garbage collector. V8 v8.3 has a new mechanism for tracking `ArrayBuffer`s and their backing stores that allows the garbage collector to iterate and free the backing store concurrently to the application. More details are available in [this design document](https://docs.google.com/document/d/1-ZrLdlFX1nXT3z-FAgLbKal1gI8Auiaya_My-a0UJ28/edit#heading=h.gfz6mi5p212e). This reduced total GC pause time in `ArrayBuffer` heavy workloads by 50%.

### Bigger Wasm memories

In accordance with an update to the [WebAssembly specification](https://webassembly.github.io/spec/js-api/index.html#limits), V8 v8.3 now allows modules to request memories up to 4GB in size, allowing more memory-heavy use cases to be brought to platforms powered by V8. Please keep in mind that this much memory might not always be available on a user’s system; we recommend creating memories at smaller sizes, growing them as needed, and gracefully handling failures to grow.

## Fixes

### Stores to objects with typed arrays on the prototype chain

According to the JavaScript specification, when storing a value to the specified key we need to lookup the prototype chain to see if the key already exists on the prototype. More often than not these keys don’t exist on the prototype chain, and so V8 installs fast lookup handlers to avoid these prototype chain walks when it is safe to do so.

However, we recently identified a particular scenario where V8 incorrectly installed this fast lookup handler, leading to incorrect behaviour. When `TypedArray`s are on the prototype chain, all stores to keys which are OOB of the `TypedArray` should be ignored. For example, in the case below `v[2]` shouldn’t add a property to `v` and the subsequent reads should return undefined.

```javascript
v = {};
v.__proto__ = new Int32Array(1);
v[2] = 123;
return v[2]; // Should return undefined
```

V8’s fast lookup handlers don’t handle this case, and we would instead return `123` in the above example. V8 v8.3 fixes this issue by not using fast lookup handlers when `TypedArray`s are on the prototype chain. Given that this isn’t a common case, we haven’t seen any performance regression on our benchmarks.

## V8 API

### Experimental WeakRefs and FinalizationRegistry APIs deprecated

The following experimental WeakRefs-related APIs are deprecated:

- `v8::FinalizationGroup`
- `v8::Isolate::SetHostCleanupFinalizationGroupCallback`

`FinalizationRegistry` (renamed from `FinalizationGroup`) is part of the [JavaScript weak references proposal](https://v8.dev/features/weak-references) and provides a way for JavaScript programmers to register finalizers. These APIs are for the embedder to schedule and run `FinalizationRegistry` cleanup tasks where the registered finalizers are invoked; they are deprecated because they are no longer needed. `FinalizationRegistry` cleanup tasks are now scheduled automatically by V8 using the foreground task runner provided by the embedder’s `v8::Platform` and do not require any additional embedder code.

### Other API changes

Please use `git log branch-heads/8.1..branch-heads/8.3 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 8.3 -t branch-heads/8.3` to experiment with the new features in V8 v8.3. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
