---
title: 'V8 release v5.4'
author: 'the V8 team'
date: 2016-09-09 13:33:37
tags:
  - release
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.4](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.4), which will be in beta until it is released in coordination with Chrome 54 Stable in several weeks. V8 v5.4 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release.

## Performance Improvements

V8 v5.4 delivers a number of key improvements in memory footprint and startup speed. These primarily help accelerate initial script execution and reduce page load in Chrome.

### Memory

When measuring V8’s memory consumption, two metrics are very important to monitor and understand: _Peak memory_ consumption and _average memory_ consumption. Typically, reducing peak consumption is just as important as reducing average consumption since an executing script that exhausts available memory even for a brief moment can cause an _Out of Memory_ crash, even if its average memory consumption is not very high. For optimization purposes, it’s useful to divide V8's memory into two categories: _On-heap memory_ containing actual JavaScript objects and _off-heap memory_ containing the rest, such as internal data structures allocated by the compiler, parser and garbage collector.

In 5.4 we tuned V8’s garbage collector for low-memory devices with 512 MB RAM or less. Depending on the website displayed this reduces _peak memory_ consumption of _on-heap memory_ up to **40%**.

Memory management inside V8’s JavaScript parser was simplified to avoid unnecessary allocations, reducing _off-heap peak memory_ usage by up to **20%**. These memory savings are especially helpful in reducing memory usage of large script files, including asm.js applications.

### Startup & speed

Our work to streamline V8's parser not only helped reduce memory consumption, it also improved the parser's runtime performance. This streamlining, combined with other optimizations of JavaScript builtins and how accesses of properties on JavaScript objects use global [inline caches](https://en.wikipedia.org/wiki/Inline_caching), resulted in notable startup performance gains.

Our [internal startup test suite](https://www.youtube.com/watch?v=xCx4uC7mn6Y) that measures real-world JavaScript performance improved by a median of 5%. The [Speedometer](http://browserbench.org/Speedometer/) benchmark also benefits from these optimizations, improving by [~10 to 13% compared to v5.2](https://chromeperf.appspot.com/report?sid=f5414b72e864ffaa4fd4291fa74bf3fd7708118ba534187d36113d8af5772c86&start_rev=393766&end_rev=416239).

<figure>
  <img src="/_img/v8-release-54/speedometer.png" intrinsicsize="938x334" alt="">
</figure>

## V8 API

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.4 -t branch-heads/5.4` to experiment with the new features in V8 v5.4. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
