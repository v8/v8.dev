---
title: 'V8 release v5.3'
author: 'the V8 team'
date: 2016-07-18 13:33:37
tags:
  - release
description: 'V8 v5.3 comes with performance improvements and reduced memory consumption.'
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.3](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.3), which will be in beta until it is released in coordination with Chrome 53 Stable. V8 v5.3 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## Memory

### New Ignition interpreter

Ignition, V8’s new interpreter, is feature complete and will be enabled in Chrome 53 for low-memory Android devices. The interpreter brings immediate memory savings for JIT’ed code and will allow V8 to make future optimizations for faster startup during code execution. Ignition works in tandem with V8’s existing optimizing compilers (TurboFan and Crankshaft) to ensure that “hot” code is still optimized for peak performance. We are continuing to improve interpreter performance and hope to enable Ignition soon on all platforms, mobile and desktop. Look for an upcoming blog post for more information about Ignition’s design, architecture, and performance gains. Embedded versions of V8 can turn on the Ignition interpreter with the flag `--ignition`.

### Reduced jank

V8 v5.3 includes various changes to reduce application jank and garbage collection times. These changes include:

- Optimizing weak global handles to reduce the time spent handling external memory
- Unifying the heap for full garbage collections to reduce evacuation jank
- Optimizing V8’s [black allocation](/blog/orinoco) additions to the garbage collection marking phase

Together, these improvements reduce full garbage collection pause times by about 25%, measured while browsing a corpus of popular webpages. For more detail on recent garbage collection optimizations to reduce jank, see the “Jank Busters” blog posts [Part 1](/blog/jank-busters) & [Part 2](/blog/orinoco).

## Performance

### Improving page startup time

The V8 team recently began tracking performance improvements against a corpus of 25 real-world website page loads (including popular sites such as Facebook, Reddit, Wikipedia, and Instagram). Between V8 v5.1 (measured in Chrome 51 from April) and V8 v5.3 (measured in a recent Chrome Canary 53) we improved startup time in aggregate across the measured websites by ~7%. These improvements loading real websites mirrored similar gains on the Speedometer benchmark, which ran 14% faster in V8 v5.3. For more details about our new testing harness, runtime improvements, and breakdown analysis of where V8 spends time during page loads, see our upcoming blog post on startup performance.

### ES2015 `Promise` performance

V8’s performance on the [Bluebird ES2015 `Promise` benchmark suite](https://github.com/petkaantonov/bluebird/tree/master/benchmark) improved by 20–40% in V8 v5.3, varying by architecture and benchmark.

<figure>
  <img src="/_img/v8-release-53/promise.png" width="1999" height="642" alt="" loading="lazy">
  <figcaption>V8’s Promise performance over time on a Nexus 5x</figcaption>
</figure>

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 5.3 -t branch-heads/5.3` to experiment with the new features in V8 5.3. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
