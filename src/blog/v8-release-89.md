---
title: 'V8 release v8.9'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), awaiting a call'
avatars:
 - 'ingvar-stepanyan'
date: 2021-02-04
tags:
 - release
description: 'V8 release v8.9 brings performance improvements to calls with argument size mismatch.'
tweet: '1357358418902802434'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.9), which is in beta until its release in coordination with Chrome 89 Stable in several weeks. V8 v8.9 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### Top-level `await`

[Top-level `await`](https://v8.dev/features/top-level-await) is available in the [Blink rendering engine](https://www.chromium.org/blink) 89, a primary embedder of V8.

In standalone V8, top-level `await` remains behind the `--harmony-top-level-await` flag.

Please see [our explainer](https://v8.dev/features/top-level-await) for more details.

## Performance

### Faster calls with arguments size mismatch

JavaScript allows calling a function with a different number of arguments than the expected number of parameters, i.e., one can pass either fewer or more arguments than the declared formal parameters. The former case is called under-application and the latter is called over-application.

In the under-application case, the remaining parameters get assigned to the `undefined` value. In the over-application case, the remaining arguments can be either accessed by using the rest parameter and the `Function.prototype.arguments` property, or they are simply superfluous and ignored. Many web and Node.js frameworks nowadays use this JS feature to accept optional parameters and create a more flexible API.

Until recently, V8 had a special machinery to deal with arguments size mismatch: the arguments adaptor frame. Unfortunately, argument adaption comes at a performance cost and is commonly needed in modern front-end and middleware frameworks. It turns out that with a clever design (like reversing the order of the arguments in the stack), we can remove this extra frame, simplify the V8 codebase, and get rid of the overhead almost entirely.

![Performance impact of removing the arguments adaptor frame, as measured through a micro-benchmark.](/_img/v8-release-89/perf.svg)

The graph shows that there is no overhead anymore when running on [JIT-less mode](https://v8.dev/blog/jitless) (Ignition) with a 11.2% performance improvement. When using TurboFan, we get up to 40% speedup. The overhead compared to the no mismatch case is due to a small optimization in the [function epilogue](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/compiler/backend/x64/code-generator-x64.cc;l=4905;drc=5056f555010448570f7722708aafa4e55e1ad052). For more details, see [the design document](https://docs.google.com/document/d/15SQV4xOhD3K0omGJKM-Nn8QEaskH7Ir1VYJb9_5SjuM/edit).

If you want to learn more about the details behind those improvements, check out the [dedicated blog post](https://v8.dev/blog/adaptor-frame).

## V8 API

Please use `git log branch-heads/8.8..branch-heads/8.9 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 8.9 -t branch-heads/8.9` to experiment with the new features in V8 v8.9. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
