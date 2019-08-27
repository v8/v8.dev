---
title: 'V8 release v4.8'
author: 'the V8 team'
date: 2015-11-25 13:33:37
tags:
  - release
description: 'V8 v4.8 adds support for several new ES2015 language features.'
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 4.8](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/4.8), which will be in beta until it is released in coordination with Chrome 48 Stable. V8 4.8 contains a handful of developer-facing features, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## Improved ECMAScript 2015 (ES6) support

This release of V8 provides support for two [well-known symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Well-known_symbols), built-in symbols from the ES2015 spec that allow developers to leverage several low-level language constructs which were previously hidden.

### `@@isConcatSpreadable`

The name for a boolean-valued property that if `true` indicates an object should be flattened to its array elements by `Array.prototype.concat`.

```js
(function() {
  'use strict';
  class AutomaticallySpreadingArray extends Array {
    get [Symbol.isConcatSpreadable]() {
      return true;
    }
  }
  const first = [1];
  const second = new AutomaticallySpreadingArray();
  second[0] = 2;
  second[1] = 3;
  const all = first.concat(second);
  // Outputs [1, 2, 3]
  console.log(all);
}());
```

### `@@toPrimitive`

The name for a method to invoke on an object for implicit conversions to primitive values.

```js
(function(){
  'use strict';
  class V8 {
    [Symbol.toPrimitive](hint) {
      if (hint === 'string') {
        console.log('string');
        return 'V8';
      } else if (hint === 'number') {
        console.log('number');
        return 8;
      } else {
        console.log('default:' + hint);
        return 8;
      }
    }
  }

  const engine = new V8();
  console.log(Number(engine));
  console.log(String(engine));
}());
```

### `ToLength`

The ES2015 spec adjusts the abstract operation for type conversion to convert an argument to an integer suitable for use as the length of an array-like object. (While not directly observable, this change might be indirectly visible when dealing with array-like objects with negative length.)

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 4.8 -t branch-heads/4.8` to experiment with the new features in V8 v4.8. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
