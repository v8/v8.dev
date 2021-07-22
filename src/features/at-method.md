---
title: '`at` method for relative indexing'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2021-07-13
tags:
  - ECMAScript
description: 'JavaScript now has a relative indexing method for Arrays, TypedArrays, and Strings.'
---

The new `at` method on `Array.prototype`, the various TypedArray prototypes, and `String.prototype` makes accessing an element nearer to the end of the collection easier and more succinct.

Accessing the Nth element from the end of a collection is a common operation. However, the usual ways to do so are verbose, like `my_array[my_array.length - N]`, or might not be performant, like `my_array.slice(-N)[0]`. The new `at` method makes this operation more ergonomic by interpreting negative indices to mean "from the end". The previous examples may be expressed as `my_array.at(-N)`.

For uniformity, positive indices are also supported, and are equivalent to ordinary property access.

This new method is small enough that its full semantics may be understood by this compliant polyfill implementation below:

```js
function at(n) {
  // Convert the argument to an integer
  n = Math.trunc(n) || 0;
  // Allow negative indexing from the end
  if (n < 0) n += this.length;
  // Out-of-bounds access returns undefined
  if (n < 0 || n >= this.length) return undefined;
  // Otherwise, this is just normal property access
  return this[n];
}
```

## A word about Strings

Since `at` ultimately performs ordinary indexing, calling `at` on String values returns code units, just as ordinary indexing would. And like ordinary indexing on Strings, code units may not be what you want for Unicode strings! Please consider if [`String.prototype.codePointAt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt) is more appropriate for your use case.

## `at` method support { #support }

<feature-support chrome="92"
                 firefox="90"
                 safari="no"
                 nodejs="no"
                 babel="yes https://github.com/zloirock/core-js#relative-indexing-method"></feature-support>
