---
title: 'Improving `DataView` performance in V8'
author: 'Théotime Grohens, <i lang="fr">le savant de Data-Vue</i>, and Benedikt Meurer ([@bmeurer](https://twitter.com/bmeurer)), professional performance pal'
avatars:
  - 'benedikt-meurer'
date: 2018-09-18 11:20:37
tags:
  - ECMAScript
  - benchmarks
description: 'V8 v6.9 bridges the performance gap between DataView and equivalent TypedArray code, effectively making DataView usable for performance-critical real-world applications.'
tweet: '1041981091727466496'
---
[`DataView`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView) are one of the two possible ways to do low-level memory accesses in JavaScript, the other one being [`TypedArray`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray). Up until now, `DataView`s were much less optimized than `TypedArray`s in V8, resulting in lower performance on tasks such as graphics-intensive workloads or when decoding/encoding binary data. The reasons for this have been mostly historical choices, like the fact that [asm.js](http://asmjs.org/) chose `TypedArray`s instead of `DataView`s, and so engines were incentivized to focus on performance of `TypedArray`s.

Because of the performance penalty, JavaScript developers such as the Google Maps team decided to avoid `DataView`s and rely on `TypedArray`s instead, at the cost of increased code complexity. This article explains how we brought `DataView` performance to match — and even surpass — equivalent `TypedArray` code in [V8 v6.9](/blog/v8-release-69), effectively making `DataView` usable for performance-critical real-world applications.

## Background

Since the introduction of ES2015, JavaScript has supported reading and writing data in raw binary buffers called [`ArrayBuffer`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer). `ArrayBuffer`s cannot be directly accessed; rather, programs must use a so-called *array buffer view* object that can be either a `DataView` or a `TypedArray`.

`TypedArray`s allow programs to access the buffer as an array of uniformly typed values, such as an `Int16Array` or a `Float32Array`.

```js
const buffer = new ArrayBuffer(32);
const array = new Int16Array(buffer);

for (let i = 0; i < array.length; i++) {
  array[i] = i * i;
}

console.log(array);
// → [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225]
```

On the other hand, `DataView`s allow for more fine-grained data access. They let the programmer choose the type of values read from and written to the buffer by providing specialized getters and setters for each number type, making them useful for serializing data structures.

```js
const buffer = new ArrayBuffer(32);
const view = new DataView(buffer);

const person = { age: 42, height: 1.76 };

view.setUint8(0, person.age);
view.setFloat64(1, person.height);

console.log(view.getUint8(0)); // Expected output: 42
console.log(view.getFloat64(1)); // Expected output: 1.76
```

Moreover, `DataView`s also allow the choice of the endianness of the data storage, which can be useful when receiving data from external sources such as the network, a file, or a GPU.

```js
const buffer = new ArrayBuffer(32);
const view = new DataView(buffer);

view.setInt32(0, 0x8BADF00D, true); // Little-endian write.
console.log(view.getInt32(0, false)); // Big-endian read.
// Expected output: 0x0DF0AD8B (233876875)
```

An efficient `DataView` implementation has been a feature request for a long time (see [this bug report](https://bugs.chromium.org/p/chromium/issues/detail?id=225811) from over 5 years ago), and we are happy to announce that DataView performance is now on par!

## Legacy runtime implementation

Until recently, the `DataView` methods used to be implemented as built-in C++ runtime functions in V8. This is very costly, because each call would require an expensive transition from JavaScript to C++ (and back).

In order to investigate the actual performance cost incurred by this implementation, we set up a performance benchmark that compares the native `DataView` getter implementation with a JavaScript wrapper simulating `DataView` behavior. This wrapper uses an `Uint8Array` to read data byte by byte from the underlying buffer, and then computes the return value from those bytes. Here is, for example, the function for reading little-endian 32-bit unsigned integer values:

```js
function LittleEndian(buffer) { // Simulate little-endian DataView reads.
  this.uint8View_ = new Uint8Array(buffer);
}

LittleEndian.prototype.getUint32 = function(byteOffset) {
  return this.uint8View_[byteOffset] |
    (this.uint8View_[byteOffset + 1] << 8) |
    (this.uint8View_[byteOffset + 2] << 16) |
    (this.uint8View_[byteOffset + 3] << 24);
};
```

`TypedArray`s are already heavily optimized in V8, so they represent the performance goal that we wanted to match.

<figure>
  <img src="/_img/dataview/dataview-original.svg" intrinsicsize="600x371" alt="">
  <figcaption>Original <code>DataView</code> performance</figcaption>
</figure>

Our benchmark shows that native `DataView` getter performance was as much as **4 times** slower than the `Uint8Array`-based wrapper, for both big-endian and little-endian reads.

## Improving baseline performance

Our first step in improving the performance of `DataView` objects was to move the implementation from the C++ runtime to [`CodeStubAssembler` (also known as CSA)](/blog/csa). CSA is a portable assembly language that allows us to write code directly in TurboFan’s machine-level intermediate representation (IR), and we use it to implement optimized parts of V8’s JavaScript standard library. Rewriting code in CSA bypasses the call to C++ completely, and also generates efficient machine code by leveraging TurboFan’s backend.

However, writing CSA code by hand is cumbersome. Control flow in CSA is expressed much like in assembly, using explicit labels and `goto`s, which makes the code harder to read and understand at a glance.

In order to make it easier for developers to contribute to the optimized JavaScript standard library in V8, and to improve readability and maintainability, we started designing a new language called V8 *Torque*, that compiles down to CSA. The goal for *Torque* is to abstract away the low-level details that make CSA code harder to write and maintain, while retaining the same performance profile.

Rewriting the `DataView` code was an excellent opportunity to start using Torque for new code, and helped provide the Torque developers with a lot of feedback about the language. This is what the `DataView`’s `getUint32()` method looks like, written in Torque:

```torque
macro LoadDataViewUint32(buffer: JSArrayBuffer, offset: intptr,
                    requested_little_endian: bool,
                    signed: constexpr bool): Number {
  let data_pointer: RawPtr = buffer.backing_store;

  let b0: uint32 = LoadUint8(data_pointer, offset);
  let b1: uint32 = LoadUint8(data_pointer, offset + 1);
  let b2: uint32 = LoadUint8(data_pointer, offset + 2);
  let b3: uint32 = LoadUint8(data_pointer, offset + 3);
  let result: uint32;

  if (requested_little_endian) {
    result = (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
  } else {
    result = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
  }

  return convert<Number>(result);
}
```

Moving the `DataView` methods to Torque already showed a **3× improvement** in performance, but did not quite match `Uint8Array`-based wrapper performance yet.

<figure>
  <img src="/_img/dataview/dataview-torque.svg" intrinsicsize="600x371" alt="">
  <figcaption>Torque <code>DataView</code> performance</figcaption>
</figure>

## Optimizing for TurboFan

When JavaScript code gets hot, we compile it using our TurboFan optimizing compiler, in order to generate highly-optimized machine code that runs more efficiently than interpreted bytecode.

TurboFan works by translating the incoming JavaScript code into an internal graph representation (more precisely, [a “sea of nodes”](https://darksi.de/d.sea-of-nodes/)). It starts with high-level nodes that match the JavaScript operations and semantics, and gradually refines them into lower and lower level nodes, until it finally generates machine code.

In particular, a function call, such as calling one of the `DataView` methods, is internally represented as a `JSCall` node, which eventually boils down to an actual function call in the generated machine code.

However, TurboFan allows us to check whether the `JSCall` node is actually a call to a known function, for example one of the builtin functions, and inline this node in the IR. This means that the complicated `JSCall` gets replaced at compile-time by a subgraph that represents the function. This allows TurboFan to optimize the inside of the function in subsequent passes as part of a broader context, instead of on its own, and most importantly to get rid of the costly function call.

<figure>
  <img src="/_img/dataview/dataview-turbofan-initial.svg" intrinsicsize="600x371" alt="">
  <figcaption>Initial TurboFan <code>DataView</code> performance</figcaption>
</figure>

Implementing TurboFan inlining finally allowed us to match, and even exceed, the performance of our `Uint8Array` wrapper, and be **8 times** as fast as the former C++ implementation.

## Further TurboFan optimizations

Looking at the machine code generated by TurboFan after inlining the `DataView` methods, there was still room for some improvement. The first implementation of those methods tried to follow the standard pretty closely, and threw errors when the spec indicates so (for example, when trying to read or write out of the bounds of the underlying `ArrayBuffer`).

However, the code that we write in TurboFan is meant to be optimized to be as fast as possible for the common, hot cases — it doesn’t need to support every possible edge case. By removing all the intricate handling of those errors, and just deoptimizing back to the baseline Torque implementation when we need to throw, we were able to reduce the size of the generated code by around 35%, generating a quite noticeable speedup, as well as considerably simpler TurboFan code.

Following up on this idea of being as specialized as possible in TurboFan, we also removed support for indices or offsets that are too large (outside of Smi range) inside the TurboFan-optimized code. This allowed us to get rid of handling of the float64 arithmetic that is needed for offsets that do not fit into a 32-bit value, and to avoid storing large integers on the heap.

Compared to the initial TurboFan implementation, this more than doubled the `DataView` benchmark score. `DataView`s are now up to 3 times as fast as the `Uint8Array` wrapper, and around **16 times as fast** as our original `DataView` implementation!

<figure>
  <img src="/_img/dataview/dataview-turbofan-final.svg" intrinsicsize="600x371" alt="">
  <figcaption>Final TurboFan <code>DataView</code> performance</figcaption>
</figure>

## Impact

We’ve evaluated the performance impact of the new implementation on some real-world examples, on top of our own benchmark.

`DataView`s are often used when decoding data encoded in binary formats from JavaScript. One such binary format is [FBX](https://en.wikipedia.org/wiki/FBX), a format that is used for exchanging 3D animations. We’ve instrumented the FBX loader of the popular [three.js](https://threejs.org/) JavaScript 3D library, and measured a 10% (around 80 ms) reduction in its execution time.

We compared the overall performance of `DataView`s against `TypedArray`s. We found that our new `DataView` implementation provides almost the same performance as `TypedArray`s when accessing data aligned in the native endianness (little-endian on Intel processors), bridging much of the performance gap and making `DataView`s a practical choice in V8.

<figure>
  <img src="/_img/dataview/dataview-vs-typedarray.svg" intrinsicsize="586x362" alt="">
  <figcaption><code>DataView</code> vs. <code>TypedArray</code> peak performance</figcaption>
</figure>

We hope that you’re now able to start using `DataView`s where it makes sense, instead of relying on `TypedArray` shims. Please send us feedback on your `DataView` uses! You can reach us [via our bug tracker](https://crbug.com/v8/new), via mail to <v8-users@googlegroups.com>, or via [@v8js on Twitter](https://twitter.com/v8js).
