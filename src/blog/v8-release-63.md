---
title: 'V8 release v6.3'
author: 'the V8 team'
date: 2017-10-25 13:33:37
tags:
  - release
description: 'V8 v6.3 includes performance improvements, reduced memory consumption, and support for new JavaScript language features.'
tweet: '923168001108643840'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.3](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.3), which is in beta until its release in coordination with Chrome 63 Stable in several weeks. V8 v6.3 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Speed

[Jank Busters](/blog/jank-busters) III hit the shelves as part of the [Orinoco](/blog/orinoco) project. Concurrent marking ([70-80%](https://chromeperf.appspot.com/report?sid=612eec65c6f5c17528f9533349bad7b6f0020dba595d553b1ea6d7e7dcce9984) of marking is done on a non-blocking thread) is shipped.

The parser now does not [need to preparse a function a second time](https://docs.google.com/document/d/1TqpdGeLmURL2gc18s6PwNeyZOvayQJtJ16TCn0BEt48/edit#heading=h.un2pnqwbiw11). This translates to a [14% median improvement in parse time](https://docs.google.com/document/d/1TqpdGeLmURL2gc18s6PwNeyZOvayQJtJ16TCn0BEt48/edit#heading=h.dvuo4tqnsmml) on our internal startup Top25 benchmark.

`string.js` has been completely ported to CodeStubAssembler. Thanks a lot to [@peterwmwong](https://twitter.com/peterwmwong) for [his awesome contributions](https://chromium-review.googlesource.com/q/peter.wm.wong)! As a developer this means that builtin string functions like `String#trim` are a lot faster starting with V8 v6.3.

`Object.is()`’s performance is now roughly on-par with alternatives. In general, V8 v6.3 continues the path to better the ES2015+ performance. Beside other items we boosted the [speed of polymorphic access to symbols](https://bugs.chromium.org/p/v8/issues/detail?id=6367), [polymorphic inlining of constructor calls](https://bugs.chromium.org/p/v8/issues/detail?id=6885) and [(tagged) template literals](https://pasteboard.co/GLYc4gt.png).

<figure>
  <img src="/_img/v8-release-63/ares6.svg" width="969" height="553" alt="" loading="lazy">
  <figcaption>V8’s performance over the past six releases</figcaption>
</figure>

Weak optimized function list is gone. More information can be found in [the dedicated blog post](/blog/lazy-unlinking).

The mentioned items are a non-exhaustive list of speed improvements. Lots of other performance-related work has happened.

## Memory consumption

[Write barriers are switched over to using the CodeStubAssembler](https://chromium.googlesource.com/v8/v8/+/dbfdd4f9e9741df0a541afdd7516a34304102ee8). This saves around 100 KB of memory per isolate.

## JavaScript language features

V8 now supports the following stage 3 features: [dynamic module import via `import()`](/features/dynamic-import), [`Promise.prototype.finally()`](/features/promise-finally) and [async iterators/generators](https://github.com/tc39/proposal-async-iteration).

With [dynamic module import](/features/dynamic-import) it is very straightforward to import modules based on runtime conditions. This comes in handy when an application should lazy-load certain code modules.

[`Promise.prototype.finally`](/features/promise-finally) introduces a way to easily clean up after a promise is settled.

Iterating with async functions got more ergonomic with the introduction of [async iterators/generators](https://github.com/tc39/proposal-async-iteration).

On the `Intl` side, [`Intl.PluralRules`](/features/intl-pluralrules) is now supported. This API enables performant internationalized pluralizations.

## Inspector/Debugging

In Chrome 63 [block coverage](https://docs.google.com/presentation/d/1IFqqlQwJ0of3NuMvcOk-x4P_fpi1vJjnjGrhQCaJkH4/edit#slide=id.g271d6301ff_0_44) is also supported in the DevTools UI. Please note that the inspector protocol already supports block coverage since V8 v6.2.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use git checkout -b 6.3 -t branch-heads/6.3 to experiment with the new features in V8 v6.3. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
