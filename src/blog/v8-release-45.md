---
title: 'V8 release v4.5'
author: 'the V8 team'
date: 2015-07-17 13:33:37
tags:
  - release
description: 'V8 v4.5 comes with performance improvements and adds support for several ES2015 features.'
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 4.5](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/4.5), which will be in beta until it is released in coordination with Chrome 45 Stable. V8 v4.5 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## Improved ECMAScript 2015 (ES6) support

V8 v4.5 adds support for several [ECMAScript 2015 (ES6)](https://www.ecma-international.org/ecma-262/6.0/) features.

### Arrow functions

With the help of [Arrow Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) it is possible to write more streamlined code.

```js
const data = [0, 1, 3];
// Code without Arrow Functions
const convertedData = data.map(function(value) { return value * 2; });
console.log(convertedData);
// Code with Arrow Functions
const convertedData = data.map(value => value * 2);
console.log(convertedData);
```

The lexical binding of 'this' is another major benefit of arrow functions. As a result, using callbacks in methods gets much easier.

```js
class MyClass {
  constructor() { this.a = 'Hello, '; }
  hello() { setInterval(() => console.log(this.a + 'World!'), 1000); }
}
const myInstance = new MyClass();
myInstance.hello();
```

### Array/TypedArray functions

All of the new methods on [Arrays and TypedArrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#Methods) that are specified in ES2015 are now supported in V8 v4.5. They make working with Arrays and TypedArrays more convenient. Among the methods added are `Array.from` and `Array.of`. Methods which mirror most `Array` methods on each kind of TypedArray were added as well.

### `Object.assign`

[`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign) enables developers to quickly merge and clone objects.

```js
const target = { a: 'Hello, ' };
const source = { b: 'world!' };
// Merge the objects.
Object.assign(target, source);
console.log(target.a + target.b);
```

This feature can also be used to mix in functionality.

## More JavaScript language features are “optimizable”

For many years, V8’s traditional optimizing compiler, [Crankshaft](https://blog.chromium.org/2010/12/new-crankshaft-for-v8.html), has done a great job of optimizing many common JavaScript patterns. However, it never had the capability to support the entire JavaScript language, and using certain language features in a function — such as `try`/`catch` and `with` — would prevent it from being optimized. V8 would have to fall back to its slower, baseline compiler for that function.

One of the design goals of V8’s new optimizing compiler, [TurboFan](/blog/turbofan-jit), is to be able to eventually optimize all of JavaScript, including ECMAScript 2015 features. In V8 v4.5, we’ve started using TurboFan to optimize some of the language features that are not supported by Crankshaft: `for`-`of`, `class`, `with`, and computed property names.

Here is an example of code that uses 'for-of', which can now be compiled by TurboFan:

```js
const sequence = ['First', 'Second', 'Third'];
for (const value of sequence) {
  // This scope is now optimizable.
  const object = {a: 'Hello, ', b: 'world!', c: value};
  console.log(object.a + object.b + object.c);
}
```

Although initially functions that use these language features won't reach the same peak performance as other code compiled by Crankshaft, TurboFan can now speed them up well beyond our current baseline compiler. Even better, performance will continue to improve quickly as we develop more optimizations for TurboFan.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 4.5 -t branch-heads/4.5` to experiment with the new features in V8 v4.5. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
