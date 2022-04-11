---
title: 'V8 release v8.7'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), a V8 flag bearer'
avatars:
 - 'ingvar-stepanyan'
date: 2020-10-23
tags:
 - release
description: 'V8 release v8.7 brings new API for native calls, Atomics.waitAsync, bug fixes and performance improvements.'
tweet: '1319654229863182338'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.7), which is in beta until its release in coordination with Chrome 87 Stable in several weeks. V8 v8.7 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### Unsafe fast JS calls

V8 v8.7 comes with an enhanced API for doing native calls from JavaScript.

The feature is still experimental and can be enabled through the `--turbo-fast-api-calls` flag in V8 or the corresponding `--enable-unsafe-fast-js-calls` flag in Chrome. It is designed to improve performance of some native graphics APIs in Chrome, but can also be used by other embedders. It provides new means for developers to create instances of `v8::FunctionTemplate`, as is documented in this [header file](https://source.chromium.org/chromium/chromium/src/+/master:v8/include/v8-fast-api-calls.h). Functions created using the original API will remain unaffected.

For more information and a list of available features, please see [this explainer](https://docs.google.com/document/d/1nK6oW11arlRb7AA76lJqrBIygqjgdc92aXUPYecc9dU/edit?usp=sharing).

### `Atomics.waitAsync`

[`Atomics.waitAsync`](https://github.com/tc39/proposal-atomics-wait-async/blob/master/PROPOSAL.md) is now available in V8 v8.7.

[`Atomics.wait`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait) and [`Atomics.notify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/notify) are low-level synchronization primitives useful for implementing mutexes and other means of synchronization. However, since `Atomics.wait` is blocking, it’s not possible to call it on the main thread (trying to do so will throw a TypeError). The non-blocking version, [`Atomics.waitAsync`](https://github.com/tc39/proposal-atomics-wait-async/blob/master/PROPOSAL.md), is usable also on the main thread.

Check out [our explainer on `Atomics` APIs](https://v8.dev/features/atomics) for more details.

## V8 API

Please use `git log branch-heads/8.6..branch-heads/8.7 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 8.7 -t branch-heads/8.7` to experiment with the new features in V8 v8.7. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
