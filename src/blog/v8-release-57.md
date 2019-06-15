---
title: 'V8 release v5.7'
author: 'the V8 team'
date: 2017-02-06 13:33:37
tags:
  - release
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.7), which will be in beta until it is released in coordination with Chrome 57 Stable in several weeks. V8 5.7 is filled with all sorts of developer-facing goodies. We’d like to give you a preview of some of the highlights in anticipation of the release.

## Performance improvements

### Native async functions as fast as promises

Async functions are now approximately as fast as the same code written with promises. The execution performance of async functions quadrupled according to our [microbenchmarks](https://codereview.chromium.org/2577393002). During the same period, overall promise performance also doubled.

<figure>
  <img src="/_img/v8-release-57/async.png" intrinsicsize="1200x742" alt="">
  <figcaption>Async performance improvements in V8 on Linux x64</figcaption>
</figure>

### Continued ES2015 improvements

V8 continues to make ES2015 language features faster so that developers use new features without incurring performance costs. The spread operator, destructuring and generators are now [approximately as fast as their naive ES5 equivalents](https://fhinkel.github.io/six-speed/).

### RegExp 15% faster

Migrating RegExp functions from a self-hosted JavaScript implementation to one that hooks into TurboFan’s code generation architecture has yielded ~15% faster overall RegExp performance. More details can be found in [the dedicated blog post](/blog/speeding-up-regular-expressions).

## New library features

Several recent additions to the ECMAScript standard library are included in this release. Two String methods, [`padStart`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart) and [`padEnd`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd), provide helpful string formatting features, while [`Intl.DateTimeFormat.prototype.formatToParts`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/formatToParts) gives authors the ability to customize their date/time formatting in a locale-aware manner.

## WebAssembly enabled

Chrome 57 (which includes V8 v5.7) will be the first release to enable WebAssembly by default. For more details, see the getting started documents on [webassembly.org](http://webassembly.org/) and the API documentation on [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/API).

## V8 API additions

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document is regularly updated a few weeks after each major release.
Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.7 -t branch-heads/5.7` to experiment with the new features in V8 5.7. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.

### PromiseHook

This C++ API allows users to implement profiling code that traces through the lifecycle of promises. This enables Node’s upcoming [AsyncHook API](https://github.com/nodejs/node-eps/pull/18) which lets you build [async context propagation](https://docs.google.com/document/d/1tlQ0R6wQFGqCS5KeIw0ddoLbaSYx6aU7vyXOkv-wvlM/edit#).

The PromiseHook API provides four lifecycle hooks: init, resolve, before, and after. The init hook is run when a new promise is created; the resolve hook is run when a promise is resolved; the pre & post hooks are run right before and after a [`PromiseReactionJob`](https://tc39.es/ecma262/#sec-promisereactionjob). For more information please check out the [tracking issue](https://bugs.chromium.org/p/v8/issues/detail?id=4643) and [design document](https://docs.google.com/document/d/1rda3yKGHimKIhg5YeoAmCOtyURgsbTH_qaYR79FELlk/edit).
