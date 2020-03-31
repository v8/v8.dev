---
title: 'V8 release v5.6'
author: 'the V8 team'
date: 2016-12-02 13:33:37
tags:
  - release
description: 'V8 v5.6 comes with a new compiler pipeline, performance improvements, and increased support for ECMAScript language features.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.6), which will be in beta until it is released in coordination with Chrome 56 Stable in several weeks. V8 5.6 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release.

## Ignition and TurboFan pipeline for ES.next (and more) shipped

Starting with 5.6, V8 can optimize the entirety of the JavaScript language. Moreover, many language features are sent through a new optimization pipeline in V8. This pipeline uses V8’s [Ignition interpreter](/blog/ignition-interpreter) as a baseline and optimizes frequently executed methods with V8’s more powerful [TurboFan optimizing compiler](/docs/turbofan). The new pipeline activates for new language features (e.g. many of the new features from the ES2015 and ES2016 specifications) or whenever Crankshaft ([V8’s “classic” optimizing compiler](https://blog.chromium.org/2010/12/new-crankshaft-for-v8.html)) cannot optimize a method (e.g. try-catch, with).

Why are we only routing some JavaScript language features through the new pipeline? The new pipeline is better-suited to optimizing the whole spectrum of the JS language (past and present). It’s a healthier, more modern codebase, and it has been designed specifically for real-world use cases including running V8 on low-memory devices.

We’ve started using the Ignition/TurboFan with the newest ES.next features we’ve added to V8 (ES.next = JavaScript features as specified in ES2015 and later) and will route more features through it as we continue improving its performance. In the middle term, the V8 team is aiming to switch all JavaScript execution in V8 to the new pipeline. However, as long as there are still real-world use cases where Crankshaft runs JavaScript faster than the new Ignition/TurboFan pipeline, for the short term we’ll support both pipelines to ensure that JavaScript code running in V8 is as fast as possible in all situations.

So, why does the new pipeline use both the new Ignition interpreter and the new TurboFan optimizing compiler? Running JavaScript fast and efficiently requires having multiple mechanisms, or tiers, under the hood in a JavaScript virtual machine to do the low-level busywork of execution. For example, it’s useful to have a first tier that starts executing code quickly, and then a second optimizing tier that spends longer compiling hot functions in order to maximize performance for longer-running code.

Ignition and TurboFan are V8’s two new execution tiers that are most effective when used together. Due to efficiency, simplicity and size considerations, TurboFan is designed to optimize JavaScript methods starting from the [bytecode](https://en.wikipedia.org/wiki/Bytecode) produced by V8’s Ignition interpreter. By designing both components to work closely together, there are optimizations that can be made to both because of the presence of the other. As a result, starting with 5.6 all functions which will be optimized by TurboFan first run through the Ignition interpreter. Using this unified Ignition/TurboFan pipeline enables the optimization of features that were not optimizable in the past, since they now can take advantage of TurboFan’s optimizations passes. For example, by routing [Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) through both Ignition and TurboFan, Generators runtime performance has nearly tripled.

For more information on V8’s journey to adopt Ignition and TurboFan please have a look at [Benedikt’s dedicated blog post](https://benediktmeurer.de/2016/11/25/v8-behind-the-scenes-november-edition/).

## Performance improvements

V8 v5.6 delivers a number of key improvements in memory and performance footprint.

### Memory-induced jank

[Concurrent remembered set filtering](https://bugs.chromium.org/p/chromium/issues/detail?id=648568) was introduced: One step more towards [Orinoco](/blog/orinoco).

### Greatly improved ES2015 performance

Developers typically start using new language features with the help of transpilers because of two challenges: backwards-compatibility and performance concerns.

V8’s goal is to reduce the performance gap between transpilers and V8’s “native” ES.next performance in order to eliminate the latter challenge. We’ve made great progress in bringing the performance of new language features on-par with their transpiled ES5 equivalents. In this release you will find the performance of ES2015 features is significantly faster than in previous V8 releases, and in some cases ES2015 feature performance is approaching that of transpiled ES5 equivalents.

Particularly the [spread](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Operators/Spread_operator) operator should now be ready to be used natively. Instead of writing…

```js
// Like Math.max, but returns 0 instead of -∞ for no arguments.
function specialMax(...args) {
  if (args.length === 0) return 0;
  return Math.max.apply(Math, args);
}
```

…you can now write…

```js
function specialMax(...args) {
  if (args.length === 0) return 0;
  return Math.max(...args);
}
```

…and get similar performance results. In particular V8 v5.6 includes speed-ups for the following micro-benchmarks:

- [destructuring](https://github.com/fhinkel/six-speed/tree/master/tests/destructuring)
- [destructuring-array](https://github.com/fhinkel/six-speed/tree/master/tests/destructuring-array)
- [destructuring-string](https://github.com/fhinkel/six-speed/tree/master/tests/destructuring-string)
- [for-of-array](https://github.com/fhinkel/six-speed/tree/master/tests/for-of-array)
- [generator](https://github.com/fhinkel/six-speed/tree/master/tests/generator)
- [spread](https://github.com/fhinkel/six-speed/tree/master/tests/spread)
- [spread-generator](https://github.com/fhinkel/six-speed/tree/master/tests/spread-generator)
- [spread-literal](https://github.com/fhinkel/six-speed/tree/master/tests/spread-literal)

See the chart below for a comparison between V8 v5.4 and v5.6.

![Comparing the ES2015 feature performance of V8 v5.4 and v5.6 with [SixSpeed](https://fhinkel.github.io/six-speed/)](/_img/v8-release-56/perf.png)

This is just the beginning; there’s a lot more to follow in upcoming releases!

## Language features

### `String.prototype.padStart` / `String.prototype.padEnd`

[`String.prototype.padStart`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart) and [`String.prototype.padEnd`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd) are the latest stage 4 additions to ECMAScript. These library functions are officially shipped in v5.6.

:::note
**Note:** Unshipped again.
:::

## WebAssembly browser preview

Chromium 56 (which includes V8 v5.6) is going to ship the WebAssembly browser preview. Please refer to [the dedicated blog post](/blog/webassembly-browser-preview) for further information.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.6 -t branch-heads/5.6` to experiment with the new features in V8 v5.6. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
