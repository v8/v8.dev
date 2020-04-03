---
title: 'V8 release v7.7'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias)), lazy allocator of release notes'
avatars:
  - 'mathias-bynens'
date: 2019-08-13 16:45:00
tags:
  - release
description: 'V8 v7.7 features lazy feedback allocation, faster WebAssembly background compilation, stack trace improvements, and new Intl.NumberFormat functionality.'
tweet: '1161287541611323397'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.7), which is in beta until its release in coordination with Chrome 77 Stable in several weeks. V8 v7.7 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Performance (size & speed) { #performance }

### Lazy feedback allocation

In order to optimize JavaScript, V8 collects feedback about the types of operands which are passed to various operations (e.g. `+` or `o.foo`). This feedback is used to optimize these operations by tailoring them to those specific types. This information is stored in “feedback vectors”, and while this information is very important to achieve faster execution times, we also pay a cost for the memory usage required to allocate these feedback vectors.

To reduce V8’s memory usage, we now allocate the feedback vectors lazily only after the function has executed a certain amount of bytecode. This avoids allocating feedback vectors for short-lived functions that don’t benefit from the feedback collected. Our lab experiments show that lazily allocating feedback vectors saves about 2–8% of V8 heap size.

![](/_img/v8-release-77/lazy-feedback-allocation.svg)

Our experiments from the wild show that this reduces V8’s heap size by 1–2% on desktop and 5–6% on mobile platforms for the users of Chrome. There are no performance regressions on desktop, and on mobile platforms we actually saw a performance improvement on low-end phones with limited memory. Please look out for a more detailed blog post on our recent work to save memory.

### Scalable WebAssembly background compilation { #wasm-compilation }

Over the last milestones, we worked on scalability of background compilation of WebAssembly. The more cores your computer has, the more you benefit from this effort. The graphs below have been created on a 24-core Xeon machine, compiling [the Epic ZenGarden demo](https://s3.amazonaws.com/mozilla-games/ZenGarden/EpicZenGarden.html). Depending on the number of threads used, compilation takes less than half of the time compared to V8 v7.4.

![](/_img/v8-release-77/liftoff-compilation-speedup.svg)

![](/_img/v8-release-77/turbofan-compilation-speedup.svg)

### Stack trace improvements

Almost all errors thrown by V8 capture a stack trace when they are created. This stack trace can be accessed from JavaScript through the non-standard `error.stack` property. The first time a stack trace is retrieved via `error.stack`, V8 serializes the underlying structured stack trace into a string. This serialized stack trace is kept around to speed up future `error.stack` accesses.

Over the last few versions we worked on some [internal refactorings to the stack trace logic](https://docs.google.com/document/d/1WIpwLgkIyeHqZBc9D3zDtWr7PL-m_cH6mfjvmoC6kSs/edit) ([tracking bug](https://bugs.chromium.org/p/v8/issues/detail?id=8742)), simplifying the code and improving stack trace serialization performance by up to 30%.

## JavaScript language features

[The `Intl.NumberFormat` API](/features/intl-numberformat) for locale-aware number formatting gains new functionality in this release! It now supports compact notation, scientific notation, engineering notation, sign display, and units of measurement.

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'meter-per-second',
});
formatter.format(299792458);
// → '299,792,458 m/s'
```

Refer to [our feature explainer](/features/intl-numberformat) for more details.

## V8 API

Please use `git log branch-heads/7.6..branch-heads/7.7 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.7 -t branch-heads/7.7` to experiment with the new features in V8 v7.7. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
