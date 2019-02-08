---
title: 'Speeding up V8 regular expressions'
author: 'Jakob Gruber, Regular Software Engineer'
avatars:
  - 'jakob-gruber'
date: 2017-01-10 13:33:37
tags:
  - internals
  - RegExp
---
This blog post covers V8's recent migration of RegExp's built-in functions from a self-hosted JavaScript implementation to one that hooks straight into our new code generation architecture based on [TurboFan](/blog/v8-release-56).

V8’s RegExp implementation is built on top of [Irregexp](https://blog.chromium.org/2009/02/irregexp-google-chromes-new-regexp.html), which is widely considered to be one of the fastest RegExp engines. While the engine itself encapsulates the low-level logic to perform pattern matching against strings, functions on the RegExp prototype such as [`RegExp.prototype.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec) do the additional work required to expose its functionality to the user.

Historically, various components of V8 have been implemented in JavaScript. Until recently, `regexp.js` has been one of them, hosting the implementation of the RegExp constructor, all of its properties as well as its prototype’s properties.

Unfortunately this approach has disadvantages, including unpredictable performance and expensive transitions to the C++ runtime for low-level functionality. The recent addition of built-in subclassing in ES6 (allowing JavaScript developers to provide their own customized RegExp implementation) has resulted in a further RegExp performance penalty, even if the RegExp built-in is not subclassed. These regressions could not be be fully addressed in the self-hosted JavaScript implementation.

We therefore decided to migrate the RegExp implementation away from JavaScript.  However, preserving performance turned out to be more difficult than expected. An initial migration to a full C++ implementation was significantly slower, reaching only around 70% of the original implementation’s performance.  After some investigation, we found several causes:

- [`RegExp.prototype.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec) contains a couple of extremely performance-sensitive areas, most notably including the transition to the underlying RegExp engine, and construction of the RegExp result with its associated substring calls. For these, the JavaScript implementation relied on highly optimized pieces of code called 'stubs', written either in native assembly language or by hooking directly into the optimizing compiler pipeline. It is not possible to access these stubs from C++, and their runtime equivalents are significantly slower.
- Accesses to properties such as RegExp's lastIndex can be expensive, possibly requiring lookups by name and traversal of the prototype chain. V8's optimizing compiler can often automatically replace such accesses with more efficient operations, while these cases would need to be handled explicitly in C++.
- In C++, references to JavaScript objects must be wrapped in so-called Handles in order to cooperate with garbage collection. Handle management produces further overhead in comparison to the plain JavaScript implementation.

Our new design for the RegExp migration is based on the [CodeStubAssembler](/blog/csa), a mechanism that allows V8 developers to write platform-independent code which will later be translated into fast, platform-specific code by the same backend that is also used for the new optimizing compiler TurboFan. Using the CodeStubAssembler allows us to address all shortcomings of the initial C++ implementation. Stubs (such as the entry-point into the RegExp engine) can easily be called from the CodeStubAssembler. While fast property accesses still need to be explicitly implemented on so-called fast paths, such accesses are extremely efficient in the CodeStubAssembler. Handles simply do not exist outside of C++. And since the implementation now operates at a very low level, we can take further shortcuts such as skipping expensive result construction when it is not needed.

Results have been very positive. Our score on [a substantial RegExp workload](https://github.com/chromium/octane/blob/master/regexp.js) has improved by 15%, more than regaining our recent subclassing-related performance losses. Microbenchmarks (Figure 1) show improvements across the board, from 7% for [`RegExp.prototype.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec), up to 102% for [`RegExp.prototype[@@split]`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/@@split).

<figure>
  <img src="/_img/speeding-up-regular-expressions/perf.png" intrinsicsize="1024x576" alt="">
  <figcaption>Figure 1: RegExp speedup broken down by function</figcaption>
</figure>

So how can you, as a JavaScript developer, ensure that your RegExps are fast? If you are not interested in hooking into RegExp internals, make sure that neither the RegExp instance, nor its prototype is modified in order to get the best performance:

```js
const re = /./g;
re.exec('');  // Fast path.
re.new_property = 'slow';
RegExp.prototype.new_property = 'also slow';
re.exec('');  // Slow path.
```

And while RegExp subclassing may be quite useful at times, be aware that subclassed RegExp instances require more generic handling and thus take the slow path:

```js
class SlowRegExp extends RegExp {}
new SlowRegExp(".", "g").exec('');  // Slow path.
```

The full RegExp migration will be available in V8 v5.7.
