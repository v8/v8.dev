---
title: 'V8 release v5.2'
author: 'the V8 team'
date: 2016-06-04 13:33:37
tags:
  - release
description: 'V8 v5.2 includes support for ES2016 language features.'
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.2](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.2), which will be in beta until it is released in coordination with Chrome 52 Stable. V8 5.2 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## ES2015 & ES2016 support

V8 v5.2 contains support for ES2015 (a.k.a. ES6) and ES2016 (a.k.a. ES7).

### Exponentiation operator

This release contains support for the ES2016 exponentiation operator, an infix notation to replace `Math.pow`.

```js
let n = 3**3; // n == 27
n **= 2; // n == 729
```

### Evolving spec

For more information on the complexities behind support for evolving specifications and continued standards discussion around web compatibility bugs and tail calls, see the V8 blog post [ES2015, ES2016, and beyond](/blog/modern-javascript).

## Performance

V8 v5.2 contains further optimizations to improve the performance of JavaScript built-ins, including improvements for Array operations like the isArray method, the in operator, and Function.prototype.bind. This is part of ongoing work to speed up built-ins based on new analysis of runtime call statistics on popular web pages. For more information, see the [V8 Google I/O 2016 talk](https://www.youtube.com/watch?v=N1swY14jiKc) and look for an upcoming blog post on performance optimizations gleaned from real-world websites.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 5.2 -t branch-heads/5.2` to experiment with the new features in V8 v5.2. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
