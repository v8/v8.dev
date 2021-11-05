---
title: 'V8 release v9.7'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
 - 'ingvar-stepanyan'
date: 2021-11-05
tags:
 - release
description: 'V8 release v9.7 brings new JavaScript methods for searching backwards in arrays.'
tweet: ''
---
Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git main immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.7), which is in beta until its release in coordination with Chrome 97 Stable in several weeks. V8 v9.7 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### `findLast` and `findLastIndex` array methods

The `findLast` and `findLastIndex` methods on `Array`s and `TypedArray`s find elements that match a predicate from the end of an array.

For example:

```js
[1,2,3,4].findLast((el) => el % 2 === 0)
// → 4 (last even element)
```

These methods are available without a flag starting in v9.7.

For more details, please see our [feature explainer](https://v8.dev/features/finding-in-arrays#finding-elements-from-the-end).

## V8 API

Please use `git log branch-heads/9.6..branch-heads/9.7 include/v8\*.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.7 -t branch-heads/9.7` to experiment with the new features in V8 v9.7. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
