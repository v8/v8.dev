---
title: 'V8 release v6.8'
author: 'the V8 team'
date: 2018-06-21 13:33:37
tags:
  - release
description: 'V8 v6.8 features reduced memory consumption and several performance improvements.'
tweet: '1009753739060826112'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.8](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.8), which is in beta until its release in coordination with Chrome 68 Stable in several weeks. V8 v6.8 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Memory

JavaScript functions unnecessarily kept outer functions and their metadata (known as `SharedFunctionInfo` or `SFI`) alive. Especially in function-heavy code that relies on short-lived IIFEs, this could lead to spurious memory leaks. Before this change, an active `Context` (i.e. an on-heap representation of a function activation) kept the `SFI` alive of the function that created the context:

![](/_img/v8-release-68/context-jsfunction-before.svg)

By letting the `Context` point to a `ScopeInfo` object which contains the stripped-down information necessary for debugging, we can break the dependency on the `SFI`.

![](/_img/v8-release-68/context-jsfunction-after.svg)

We’ve already observed 3% V8 memory improvements on mobile devices over a set of top 10 pages.

In parallel we have reduced the memory consumption of `SFI`s themselves, removing unnecessary fields or compressing them where possible, and decreased their size by ~25%, with further reductions coming in future releases. We’ve observed `SFI`s taking up 2–6% of V8 memory on typical websites even after detaching them from the context, so you should see memory improvements on code with a large number of functions.

## Performance

### Array destructuring improvements

The optimizing compiler did not generate ideal code for array destructuring. For example, swapping variables using `[a, b] = [b, a]` used to be twice as slow as `const tmp = a; a = b; b = tmp`. Once we unblocked escape analysis to eliminate all temporary allocation, array destructuring with a temporary array is as fast as a sequence of assignments.

### `Object.assign` improvements

So far `Object.assign` had a fast path written in C++. That meant that the JavaScript-to-C++ boundary had to be crossed for each `Object.assign` call. An obvious way to improve the builtin performance was to implement a fast path on the JavaScript side. We had two options: either implement it as an native JS builtin (which would come with some unnecessary overhead in this case), or implement it [using CodeStubAssembler technology](/blog/csa) (which provides more flexibility). We went with the latter solution. The new implementation of `Object.assign` improves the score of [Speedometer2/React-Redux by about 15%, improving the total Speedometer 2 score by 1.5%](https://chromeperf.appspot.com/report?sid=d9ea9a2ae7cd141263fde07ea90da835cf28f5c87f17b53ba801d4ac30979558&start_rev=550155&end_rev=552590).

### `TypedArray.prototype.sort` improvements

`TypedArray.prototype.sort` has two paths: a fast path, used when the user does not provide a comparison function, and a slow path for everything else. Until now, the slow path reused the implementation for `Array.prototype.sort`, which does a lot more than is necessary for sorting `TypedArray`s. V8 v6.8 replaces the slow path with an implementation in [CodeStubAssembler](/blog/csa). (Not directly CodeStubAssembler but a domain-specific language that is built on top of CodeStubAssembler).

Performance for sorting `TypedArray`s without a comparison function stays the same while there is a speedup of up to 2.5× when sorting using a comparison function.

![](/_img/v8-release-68/typedarray-sort.svg)

## WebAssembly

In V8 v6.8 you can start using [trap-based bounds checking](https://docs.google.com/document/d/17y4kxuHFrVxAiuCP_FFtFA2HP5sNPsCD10KEx17Hz6M/edit) on Linux x64 platforms. This memory management optimization considerably improves WebAssembly’s execution speed. It’s already used in Chrome 68, and in the future more platforms will be supported incrementally.

## V8 API

Please use `git log branch-heads/6.7..branch-heads/6.8 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.8 -t branch-heads/6.8` to experiment with the new features in V8 v6.8. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
