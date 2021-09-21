---
title: 'V8 release v9.4'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
 - 'ingvar-stepanyan'
date: 2021-09-06
tags:
 - release
description: 'V8 release v9.4 brings class static initialization blocks to JavaScript.'
tweet: '1434915404418277381'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.4](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.4), which is in beta until its release in coordination with Chrome 94 Stable in several weeks. V8 v9.4 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### Class static initialization blocks

Classes get the ability to group code that should run once per class evaluation via static initialization blocks.

```javascript
class C {
  // This block will run when the class itself is evaluated
  static { console.log("C's static block"); }
}
```

Starting in v9.4, class static initialization blocks will be available without a need for the `--harmony-class-static-blocks` flag. For all the detailed semantics around the scoping of these blocks, please see [our explainer](https://v8.dev/features/class-static-initializer-blocks).

## V8 API

Please use `git log branch-heads/9.3..branch-heads/9.4 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.4 -t branch-heads/9.4` to experiment with the new features in V8 v9.4. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
