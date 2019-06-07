---
title: 'V8 release v6.7'
author: 'the V8 team'
date: 2018-05-04 13:33:37
tags:
  - release
tweet: '992506342391742465'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.7), which is in beta until its release in coordination with Chrome 67 Stable in several weeks. V8 v6.7 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript language features

V8 v6.7 ships with BigInt support enabled by default. BigInts are a new numeric primitive in JavaScript that can represent integers with arbitrary precision. Read [our BigInt feature explainer](/features/bigint) for more info on how BigInts can be used in JavaScript, and check out [our write-up with more details about the V8 implementation](/blog/bigint).

## Untrusted code mitigations

In V8 v6.7 we’ve landed [more mitigations for side-channel vulnerabilities](/docs/untrusted-code-mitigations) to prevent information leaks to untrusted JavaScript and WebAssembly code.

## V8 API

Please use `git log branch-heads/6.6..branch-heads/6.7 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.7 -t branch-heads/6.7` to experiment with the new features in V8 v6.7. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
