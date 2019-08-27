---
title: 'V8 release v4.6'
author: 'the V8 team'
date: 2015-08-28 13:33:37
tags:
  - release
description: 'V8 v4.6 comes with reduced jank and support for new ES2015 language features.'
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 4.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/4.6), which will be in beta until it is released in coordination with Chrome 46 Stable. V8 4.6 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## Improved ECMAScript 2015 (ES6) support

V8 v4.6 adds support for several [ECMAScript 2015 (ES6)](https://www.ecma-international.org/ecma-262/6.0/) features.

### Spread operator

The [spread operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator) makes it much more convenient to work with arrays. For example it makes imperative code obsolete when you simply want to merge arrays.

```js
// Merging arrays
// Code without spread operator
const inner = [3, 4];
const merged = [0, 1, 2].concat(inner, [5]);

// Code with spread operator
const inner = [3, 4];
const merged = [0, 1, 2, ...inner, 5];
```

Another good use of the spread operator to replace `apply`:

```js
// Function parameters stored in an array
// Code without spread operator
function myFunction(a, b, c) {
  console.log(a);
  console.log(b);
  console.log(c);
}
const argsInArray = ['Hi ', 'Spread ', 'operator!'];
myFunction.apply(null, argsInArray);

// Code with spread operator
function myFunction (a,b,c) {
  console.log(a);
  console.log(b);
  console.log(c);
}

const argsInArray = ['Hi ', 'Spread ', 'operator!'];
myFunction(...argsInArray);
```

### `new.target`

[`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target) is one of ES6's features designed to improve working with classes. Under the hood it’s actually an implicit parameter to every function. If a function is called with the keyword new, then the parameter holds a reference to the called function. If new is not used the parameter is undefined.

In practice, this means that you can use new.target to figure out whether a function was called normally or constructor-called via the new keyword.

```js
function myFunction() {
  if (new.target === undefined) {
    throw 'Try out calling it with new.';
  }
  console.log('Works!');
}

// Breaks:
myFunction();

// Works:
const a = new myFunction();
```

When ES6 classes and inheritance are used, new.target inside the constructor of a super-class is bound to the derived constructor that was invoked with new. In particular, this gives super-classes access to the prototype of the derived class during construction.

## Reduce the jank

[Jank](https://en.wiktionary.org/wiki/jank#Noun) can be a pain, especially when playing a game. Often, it's even worse when the game features multiple players. [oortonline.gl](http://oortonline.gl/) is a WebGL benchmark that tests the limits of current browsers by rendering a complex 3D scene with particle effects and modern shader rendering. The V8 team set off in a quest to push the limits of Chrome’s performance in these environments. We’re not done yet, but the fruits of our efforts are already paying off. Chrome 46 shows incredible advances in oortonline.gl performance which you can see yourself below.

Some of the optimizations include:

- [TypedArray performance improvements](https://code.google.com/p/v8/issues/detail?id=3996)
    - TypedArrays are heavily used in rendering engines such as Turbulenz (the engine behind oortonline.gl). For example, engines often create typed arrays (such as Float32Array) in JavaScript and pass them to WebGL after applying transformations.
    - The key point was optimizing the interaction between the embedder (Blink) and V8.
- [Performance improvements when passing TypedArrays and other memory from V8 to Blink](https://code.google.com/p/chromium/issues/detail?id=515795)
    - There’s no need to create additional handles (that are also tracked by V8) for typed arrays when they are passed to WebGL as part of a one-way communication.
    - On hitting external (Blink) allocated memory limits we now start an incremental garbage collection instead of a full one.
- [Idle garbage collection scheduling](/blog/free-garbage-collection)
    - Garbage collection operations are scheduled during idle times on the main thread which unblocks the compositor and results in smoother rendering.
- [Concurrent sweeping enabled for the whole old generation of the garbage collected heap](https://code.google.com/p/chromium/issues/detail?id=507211)
    - Freeing of unused memory chunks is performed on additional threads concurrent to the main thread which significantly reduces the main garbage collection pause time.

The good thing is that all changes related to oortonline.gl are general improvements that potentially affect all users of applications that make heavy use of WebGL.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 4.6 -t branch-heads/4.6` to experiment with the new features in V8 v4.6. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
