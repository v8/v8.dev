---
title: 'Finding elements in `Array`s and TypedArrays'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2021-10-21
tags:
  - ECMAScript
description: 'JavaScript methods to find elements in Arrays and TypedArrays'
---
# Finding elements in `Array`s and `TypedArray`s from the beginning

Finding an element that satisfies some condition in an `Array` is a common task and is done with the `find` and `findIndex` methods on `Array.prototype` and the various TypedArray prototypes. `Array.prototype.find` takes a predicate and returns the first element in the array for which that predicate returns `true`. If the predicate doesn't return `true` for any element, the method returns `undefined`. `Array.prototype.findIndex` works similarly, except it returns the index when found, and `-1` when not found. The TypedArray versions of `find` and `findIndex` work exactly the same, with the only difference being that they operate on TypedArray instances instead of Array instances.

```js
const inputArray = [{v:1}, {v:2}, {v:3}, {v:4}, {v:5}];
inputArray.find((element) => element.v % 2 === 0);
// → {v:2}
inputArray.find((element) => element.v % 7 === 0);
// → undefined
inputArray.findIndex((element) => element.v % 2 === 0);
// → 1
inputArray.findIndex((element) => element.v % 7 === 0);
// → -1
```

# Finding elements in `Array`s and `TypedArray`s from the end

What if you want to find the last element in the `Array`? This use case often naturally arises, such as choosing to deduplicate multiple matches in favor of the last element, or knowing ahead of time that the element is likely to be near the end of the `Array`. With the `find` method, one solution is to first reverse the input, like so: `inputArray.reverse().find(predicate)`. However, that reverses the input in-place, which is sometimes undesirable.

With the `findLast` and `findLastIndex` methods, this use case can be solved directly and ergonomically. They behave exactly as their `find` and `findIndex` counterparts, except they start their search from the end of the `Array` or TypedArray.

```js
const inputArray = [{v:1}, {v:2}, {v:3}, {v:4}, {v:5}];
inputArray.findLast((element) => element.v % 2 === 0);
// → {v:4}
inputArray.findLast((element) => element.v % 7 === 0);
// → undefined
inputArray.findLastIndex((element) => element.v % 2 === 0);
// → 3
inputArray.findLastIndex((element) => element.v % 7 === 0);
// → -1
```

## `findLast` and `findLastIndex` support { #support }

<feature-support chrome="97"
                 firefox="https://bugzilla.mozilla.org/show_bug.cgi?id=1704385"
                 safari="STP 133"
                 nodejs="no"
                 babel="no"></feature-support>