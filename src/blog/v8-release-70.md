---
title: 'V8 release v7.0'
author: 'Michael Hablich'
avatars:
  - michael-hablich
date: 2018-10-15 17:17:00
tags:
  - release
---
_Every six weeks, we create a new branch of V8 as part of our [release process](https://github.com/v8/v8/wiki/Release-Process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.0](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.0), which is in beta until its release in coordination with Chrome 70 Stable in several weeks. V8 v7.0 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release._

## Embedded built-ins

[Embedded builtins](/blog/embedded-builtins) save memory by sharing generated code across multiple V8 Isolates. Starting with V8 v6.9, we enabled embedded builtins on x64. V8 v7.0 brings these memory savings to all remaining platforms except ia32.

## A preview of WebAssembly Threads

WebAssembly (Wasm) enables compilation of code written in C++ and other languages to run on the web. One very useful feature of native applications is the ability to use threads — a primitive for parallel computation. Most C and C++ developers would be familiar with pthreads, which is a standardized API for application thread management.

The [WebAssembly Community Group](https://www.w3.org/community/webassembly/) has been working on bringing threads to the web to enable real multi-threaded applications. As part of this effort, V8 has implemented necessary support for threads in the WebAssembly engine. To use this feature in Chrome, you can enable it via `chrome://flags/#enable-webassembly-threads`, or your site can sign up for an [Origin Trial](https://github.com/GoogleChrome/OriginTrials). Origin Trials allow developers to experiment with new web features before they are fully standardized, and that helps us gather real-world feedback which is critical to validate and improve new features.

## JavaScript language features

[A `description` property](https://tc39.github.io/proposal-Symbol-description/) is being added to `Symbol.prototype`. This provides a more ergonomic way of accessing the description of a `Symbol`. Previously, the description could be only be accessed indirectly through `Symbol.protoype.toString()`. Thanks to Igalia for contributing this implementation!

`Array.prototype.sort` is now stable in V8 v7.0. Previously, V8 used an unstable QuickSort for arrays with more than 10 elements. Now, we use the stable TimSort algorithm. See [our blog post](/blog/array-sort) for more details.

## V8 API

Please use `git log branch-heads/6.9..branch-heads/7.0 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](https://github.com/v8/v8/wiki/Using-Git) can use `git checkout -b 7.0 -t branch-heads/7.0` to experiment with the new features in V8 v6.9. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
