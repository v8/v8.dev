---
title: 'V8 release v9.6'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
 - 'ingvar-stepanyan'
date: 2021-10-13
tags:
 - release
description: 'V8 release v9.6 brings support for Reference Types to WebAssembly.'
tweet: '1448262079476076548'
---
Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.6), which is in beta until its release in coordination with Chrome 96 Stable in several weeks. V8 v9.6 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## WebAssembly

### Reference Types

The [Reference Types proposal](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md), shipped in V8 v9.6, allows using external references from JavaScript opaquely in WebAssembly modules. The `externref` (formerly known as `anyref`) data type provides a secure way of holding a reference to a JavaScript object and is fully integrated with V8's garbage collector.

Few toolchains that already have optional support for reference types are [wasm-bindgen for Rust](https://rustwasm.github.io/wasm-bindgen/reference/reference-types.html) and [AssemblyScript](https://www.assemblyscript.org/compiler.html#command-line-options).

## V8 API

Please use `git log branch-heads/9.5..branch-heads/9.6 include/v8\*.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.6 -t branch-heads/9.6` to experiment with the new features in V8 v9.6. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
