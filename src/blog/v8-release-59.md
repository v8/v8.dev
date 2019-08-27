---
title: 'V8 release v5.9'
author: 'the V8 team'
date: 2017-04-27 13:33:37
tags:
  - release
description: 'V8 v5.9 include the new Ignition + TurboFan pipeline, and adds WebAssembly TrapIf support on all platforms.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.9), which will be in beta until it is released in coordination with Chrome 59 Stable in several weeks. V8 5.9 is filled with all sorts of developer-facing goodies. We’d like to give you a preview of some of the highlights in anticipation of the release.

## Ignition+TurboFan launched

V8 v5.9 is going to be the first version with Ignition+Turbofan enabled by default. In general, this switch should lead to lower memory consumption and faster startup for web application across the board, and we don’t expect stability or performance issues because the new pipeline has already undergone significant testing. However, [give us a call](https://bugs.chromium.org/p/v8/issues/entry?template=Bug%20report%20for%20the%20new%20pipeline) in case your code suddenly starts to significantly regress in performance.

For more information, see [our dedicated blog post](/blog/launching-ignition-and-turbofan).

## WebAssembly `TrapIf` support on all platforms

[WebAssembly `TrapIf` support](https://chromium.googlesource.com/v8/v8/+/98fa962e5f342878109c26fd7190573082ac3abe) significantly reduced the time spent compiling code (~30%).

<figure>
  <img src="/_img/v8-release-59/angrybots.png" width="600" height="371" alt="" loading="lazy">
</figure>

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.9 -t branch-heads/5.9` to experiment with the new features in V8 5.9. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
