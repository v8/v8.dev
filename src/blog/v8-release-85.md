---
title: 'V8 release v8.5'
author: 'Zeynep Cankara, tracking some Maps'
avatars:
 - 'zeynep-cankara'
date: 2020-07-21
tags:
 - release
description: 'V8 release v8.5 features Promise.any, AggregateError, String.prototype.replaceAll, Logical assignment operators, Liftoff shipped on all platforms and Support for JS BigInts'
tweet:
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.5](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.5), which is in beta until its release in coordination with Chrome 85 Stable in several weeks. V8 v8.5 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### `Promise.any` and `AggregateError`

`Promise.any` is a promise combinator that resolves the resulting promise as soon as one of the input promises is fulfilled.

```js
const promises = [
  fetch('/endpoint-a').then(() => 'a'),
  fetch('/endpoint-b').then(() => 'b'),
  fetch('/endpoint-c').then(() => 'c'),
];
try {
  const first = await Promise.any(promises);
  // Any of the promises was fulfilled.
  console.log(first);
  // → e.g. 'b'
} catch (error) {
  // All of the promises were rejected.
  console.assert(error instanceof AggregateError);
  // Log the rejection values:
  console.log(error.errors);
}
```

If all input promises are rejected, the resulting promise is rejected with an `AggregateError` object containing an `errors` property which holds an array of rejection values.

Please see our explainer for more.

### `String.prototype.replaceAll`

`String.prototype.replaceAll` provides an easy way to replace all occurrences of a substring without creating a global `RegExp`.

```js
const queryString = 'q=query+string+parameters';

// Works, but requires escaping inside regular expressions.
queryString.replace(/\+/g, ' ');
// → 'q=query string parameters'

// Simpler!
queryString.replaceAll('+', ' ');
// → 'q=query string parameters'
```

Please see our explainer for more.

### Logical assignment operators

Logical assignment operators are new compound assignment operators that combine the logical operations `&&`, `||`, or `??` with assignment.

```javascript
x &&= y;
// Roughly equivalent to x && (x = y)
x ||= y;
// Roughly equivalent to x || (x = y)
x ??= y;
// Roughly equivalent to x ?? (x = y)
```

Note that, unlike mathematical and bitwise compound assignment operators, logical assignment operators only conditionally perform the assignment. Please read our explainer for a more in-depth explanation.

## WebAssembly

### Liftoff shipped on all platforms

Since v6.9, [Liftoff](https://v8.dev/blog/liftoff) has been used as the baseline compiler for WebAssembly on Intel platforms (Chrome enabled it on desktop systems since M-69). Since we were concerned about memory increase (because of more code being generated by the baseline compiler), we held it back for mobile systems so far. After some experimentation in the last months, we are confident that the memory increase is negligible for most cases, hence we finally enable Liftoff by default on all architectures, bringing increased compilation speed, especially on arm devices (32- and 64-bit). Chrome follows along and ships Liftoff in M-85.
Multi-value support shipped
WebAssembly support for [multi-value code blocks and function returns](https://github.com/WebAssembly/multi-value) is now available for general use. This reflects the recent merge of the proposal in the official WebAssembly standard and is supported by all compilation tiers.

For instance, this is now a valid WebAssembly function:

```wasm
(func $swap (param i32 i32) (result i32 i32)
  (local.get 1) (local.get 0)
)
```

If the function is exported, it can also be called from JavaScript, and it will return an array:

```javascript
instance.exports.swap(1, 2) // Returns [2, 1].
```

Conversely, if a JavaScript function returns an array (or any iterator), it can be imported and called as a multi-return function inside the WebAssembly module:

```javascript
new WebAssembly.Instance(module, { imports: { swap: (x, y) => [y, x] } });
```

```wasm
(func $main (result i32 i32)
  i32.const 0
  i32.const 1
  call $swap
)
```

More importantly, toolchains can now use this feature to generate more compact and faster code within a WebAssembly module.

### Support for JS BigInts

WebAssembly support for [converting WebAssembly I64 values from and to JavaScript BigInts](https://github.com/WebAssembly/JS-BigInt-integration) has been shipped and is available for general use as per the latest change in the official standard.

Thereby WebAssembly functions with I64 parameters and return values can be called from JavaScript without precision loss:

```wasm
(module
  (func $add (param $x i64) (param $y i64) (result i64)
    local.get $x
    local.get $y
    i64.add)
  (export "add" (func $add)))
```

From JavaScript, only BigInts can be passed as I64 parameter:

```javascript
WebAssembly.instantiateStreaming(fetch('i64.wasm'))
  .then(({ module, instance })) => {
    instance.exports.add(12n, 30n); // result = 42n;
    instance.exports.add(12, 30); // throws TypeError, parameters are not of type BigInt.
  });
```