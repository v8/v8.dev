---
title: 'V8 release v6.1'
author: 'the V8 team'
date: 2017-08-03 13:33:37
tags:
  - release
description: 'V8 v6.1 comes with a reduced binary size and includes performance improvements. In addition, asm.js is now validated and compiled to WebAssembly.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.1](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.1), which is in beta until its release in coordination with Chrome 61 Stable in several weeks. V8 v6.1 is filled with all sorts of developer-facing goodies. We’d like to give you a preview of some of the highlights in anticipation of the release.

## Performance improvements

Visiting all the elements of the Maps and Sets — either via [iteration](http://exploringjs.com/es6/ch_iteration.html) or the [`Map.prototype.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach) / [`Set.prototype.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/forEach) methods — became significantly faster, with a raw performance improvement of up to 11× since V8 version 6.0. Check the [dedicated blog post](https://benediktmeurer.de/2017/07/14/faster-collection-iterators/) for additional information.

![](/_img/v8-release-61/iterating-collections.svg)

In addition to that, work continued on the performance of other language features. For example, the [`Object.prototype.isPrototypeOf`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf) method, which is important for constructor-less code using mostly object literals and `Object.create` instead of classes and constructor functions, is now always as fast and often faster than using [the `instanceof` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof).

![](/_img/v8-release-61/checking-prototype.svg)

Function calls and constructor invocations with variable number of arguments also got significantly faster. Calls made with [`Reflect.apply`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/apply) and [`Reflect.construct`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct) received an up to 17× performance boost in the latest version.

![](/_img/v8-release-61/call-construct.svg)

`Array.prototype.forEach` is now inlined in TurboFan and optimized for all major non-holey [elements kinds](/blog/elements-kinds).

## Binary size reduction

The V8 team has completely removed the deprecated the Crankshaft compiler, giving a significant reduction in binary size. Alongside the removal of the builtins generator, this reduces the deployed binary size of V8 by over 700 KB, depending on the exact platform.

## asm.js is now validated and compiled to WebAssembly

If V8 encounters asm.js code it now tries to validate it. Valid asm.js code is then transpiled to WebAssembly. According to V8’s performance evaluations, this generally boosts throughput performance. Due to the added validation step, isolated regressions in startup performance might happen.

Please note that this feature was switched on by default on the Chromium side only. If you are an embedder and want to leverage the asm.js validator, enable the flag `--validate-asm`.

## WebAssembly

When debugging WebAssembly, it is now possible to display local variables in DevTools when a breakpoint in WebAssembly code is hit.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.1 -t branch-heads/6.1` to experiment with the new features in V8 v6.1. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
