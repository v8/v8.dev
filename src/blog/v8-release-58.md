---
title: 'V8 release v5.8'
author: 'the V8 team'
date: 2017-03-20 13:33:37
tags:
  - release
description: 'V8 v5.8 enables the use of arbitrary heap sizes and improves startup performance.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.8](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.8), which will be in beta until it is released in coordination with Chrome 58 Stable in several weeks. V8 5.8 is filled with all sorts of developer-facing goodies. We’d like to give you a preview of some of the highlights in anticipation of the release.

## Arbitrary heap sizes

Historically the V8 heap limit was conveniently set to fit the signed 32-bit integer range with some margin. Over time this convenience lead to sloppy code in V8 that mixed types of different bit widths, effectively breaking the ability to increase the limit. In V8 v5.8 we enabled the use of arbitrary heap sizes. See the [dedicated blog post](/blog/heap-size-limit) for more information.

## Startup performance

In V8 v5.8 we continued the work towards incrementally reducing the time spent in V8 during startup. Reductions in the time spent compiling and parsing code, as well as optimizations in the IC system yielded ~5% improvements on our [real-world startup workloads](/blog/real-world-performance).

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.8 -t branch-heads/5.8` to experiment with the new features in V8 5.8. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
