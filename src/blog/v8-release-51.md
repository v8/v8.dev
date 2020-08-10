---
title: 'V8 release v5.1'
author: 'the V8 team'
date: 2016-04-23 13:33:37
tags:
  - release
description: 'V8 v5.1 comes with performance improvements, reduced jank and memory consumption, and increased support for ECMAScript language features.'
---
The first step in the V8 [release process](/docs/release-process) is a new branch from the Git master immediately before Chromium branches for a Chrome Beta milestone (roughly every six weeks). Our newest release branch is [V8 v5.1](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.1), which will remain in beta until we release a stable build in conjunction with Chrome 51 Stable. Here’s a highlight of the new developer-facing features in this version of V8.

## Improved ECMAScript support

V8 v5.1 contains a number of changes towards compliance with the ES2017 draft spec.

### `Symbol.species`

Array methods like `Array.prototype.map` construct instances of the subclass as its output, with the option to customize this by changing [`Symbol.species`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/species). Analogous changes are made to other built-in classes.

### `instanceof` customization

Constructors can implement their own [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Other_symbols) method, which overrides the default behavior.

### Iterator closing

Iterators created as part of a [`for`-`of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of) loop (or other built-in iteration, such as the [spread](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator) operator) are now checked for a close method which is called if the loop terminates early. This can be used for clean-up duty after the iteration has finished.

### RegExp subclassing `exec` method

RegExp subclasses can overwrite the `exec` method to change just the core matching algorithm, with the guarantee that this is called by higher-level functions like `String.prototype.replace`.

### Function name inference

Function names inferred for function expressions are now typically made available in the [`name`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name) property of functions, following the ES2015 formalization of these rules. This may change existing stack traces and provide different names from previous V8 versions. It also gives useful names to properties and methods with computed property names:

```js
class Container {
  ...
  [Symbol.iterator]() { ... }
  ...
}
const c = new Container;
console.log(c[Symbol.iterator].name);
// → '[Symbol.iterator]'
```

### `Array.prototype.values`

Analogous to other collection types, the [`values`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/values) method on `Array` returns an iterator over the contents of the array.

## Performance improvements

V8 v5.1 also brings a few notable performance improvements to the following JavaScript features:

- Executing loops like `for`-`in`
- `Object.assign`
- Promise and RegExp instantiation
- Calling `Object.prototype.hasOwnProperty`
- `Math.floor`, `Math.round`, and `Math.ceil`
- `Array.prototype.push`
- `Object.keys`
- `Array.prototype.join` & `Array.prototype.toString`
- Flattening repeat strings e.g. `'.'.repeat(1000)`

## WebAssembly (Wasm) { #wasm }

V8 v5.1 has a preliminary support for [WebAssembly](/blog/webassembly-experimental). You can enable it via the flag `--expose_wasm` in `d8`. Alternatively you can try out the [Wasm demos](https://webassembly.github.io/demo/) with Chrome 51 (Beta Channel).

## Memory

V8 implemented more slices of [Orinoco](/blog/orinoco):

- Parallel young generation evacuation
- Scalable remembered sets
- Black allocation

The impact is reduced jank and memory consumption in times of need.

## V8 API

Please check out our [summary of API changes](https://bit.ly/v8-api-changes). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://v8.dev/docs/source-code#using-git) can use `git checkout -b 5.1 -t branch-heads/5.1` to experiment with the new features in V8 v5.1. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
