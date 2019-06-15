---
title: 'V8 release v4.7'
author: 'the V8 team'
date: 2015-10-14 13:33:37
tags:
  - release
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 4.7](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/4.7), which will be in beta until it is released in coordination with Chrome 47 Stable. V8 v4.7 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## Improved ECMAScript 2015 (ES6) support

### Rest operator

The [rest operator](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Functions/rest_parameters) enables the developer to pass an indefinite number of arguments to a function. It is similar to the `arguments` object.

```js
// Without rest operator
function concat() {
  var args = Array.prototype.slice.call(arguments, 1);
  return args.join('');
}

// With rest operator
function concatWithRest(...strings) {
  return strings.join('');
}
```

## Support for upcoming ES features

### `Array.prototype.includes`

[`Array.prototype.includes`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes) is a new feature that is currently a stage 3 proposal for inclusion in ES2016. It provides a terse syntax for determining whether or not an element is in a given array by returning a boolean value.

```js
[1, 2, 3].includes(3); // true
['apple', 'banana', 'cherry'].includes('apple'); // true
['apple', 'banana', 'cherry'].includes('peach'); // false
```

## Ease the pressure on memory while parsing

[Recent changes to the V8 parser](https://code.google.com/p/v8/issues/detail?id=4392) greatly reduce the memory consumed by parsing files with large nested functions. In particular, this allows V8 to run larger asm.js modules than previously possible.

## V8 API

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document gets regularly updated a few weeks after each major release. Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 4.7 -t branch-heads/4.7` to experiment with the new features in V8 v4.7. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
