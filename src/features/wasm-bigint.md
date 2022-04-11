---
title: 'WebAssembly integration with JavaScript BigInt'
author: 'Alon Zakai'
avatars:
  - 'alon-zakai'
date: 2020-11-12
tags:
  - WebAssembly
  - ECMAScript
description: 'BigInts make it easy to pass 64-bit integers between JavaScript and WebAssembly. This post explains what that means and why it’s useful, which includes making things simpler for developers, letting code run more quickly, and also speeding up build times.'
tweet: '1331966281571037186'
---
The [JS-BigInt-Integration](https://github.com/WebAssembly/JS-BigInt-integration) feature makes it easy to pass 64-bit integers between JavaScript and WebAssembly. This post explains what that means and why it’s useful, which includes making things simpler for developers, letting code run more quickly, and also speeding up build times.

## 64-bit integers

JavaScript Numbers are doubles, that is, 64-bit floating-point values. Such a value can contain any 32-bit integer with full precision, but not all 64-bit ones. WebAssembly, on the other hand, has full support for 64-bit integers, the `i64` type. A problem occurs when connecting the two: If a Wasm function returns an i64, for example, then the VM throws an exception if you call it from JavaScript, something like this:

```
TypeError: Wasm function signature contains illegal type
```

As the error says, `i64` is not a legal type for JavaScript.

Historically, the best solution for this was “legalization” of the Wasm. Legalization means to convert Wasm imports and exports to use valid types for JavaScript. In practice, that did two things:

1. Replace a 64-bit integer parameter with two 32-bit ones, representing the low and high bits, respectively.
2. Replace a 64-bit integer return value with a 32-bit one representing the low bits, and use a 32-bit value on the side for the high bits.

For example, consider this Wasm module:

```wasm
(module
  (func $send_i64 (param $x i64)
    ..))
```

Legalization would turn that into this:

```wasm
(module
  (func $send_i64 (param $x_low i32) (param $x_high i32)
    (local $x i64) ;; the real value the rest of the code will use
    ;; code to combine $x_low and $x_high into $x
    ..))
```

Legalization is done on the tools side, before it reaches the VM that runs it. For example, the [Binaryen](https://github.com/WebAssembly/binaryen) toolchain library has a pass called [LegalizeJSInterface](https://github.com/WebAssembly/binaryen/blob/fd7e53fe0ae99bd27179cb35d537e4ce5ec1fe11/src/passes/LegalizeJSInterface.cpp) that does that transformation, which is run automatically in [Emscripten](https://emscripten.org/) when it is needed.

## Downsides of legalization

Legalization works well enough for many things, but it does have downsides, like the extra work to combine or split up 32-bit pieces into 64-bit values. While it’s rare that that happens on a hot path, when it does the slowdown can be noticeable - we’ll see some numbers later.

Another annoyance is that legalization is noticeable by users, since it changes the interface between JavaScript and Wasm. Here is an example:

```c
// example.c

#include <stdint.h>

extern void send_i64_to_js(int64_t);

int main() {
  send_i64_to_js(0xABCD12345678ULL);
}
```

```javascript
// example.js

mergeInto(LibraryManager.library, {
  send_i64_to_js: function(value) {
    console.log("JS received: 0x" + value.toString(16));
  }
});
```

This is a tiny C program that calls a [JavaScript library](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-c-in-javascript) function (that is, we define an extern C function in C, and implement it in JavaScript, as a simple and low-level way to call between Wasm and JavaScript). All this program does is send an `i64` out to JavaScript, where we attempt to print it.

We can build that with

```
emcc example.c --js-library example.js -o out.js
```

When we run it, we don’t get what we expect:

```
node out.js
JS received: 0x12345678
```

We sent `0xABCD12345678` but we only received `0x12345678` 😔. What happens here is that legalization turns that `i64` into two `i32`s, and our code just received the low 32 bits, and ignored another parameter that was sent. To handle things properly, we’d need to do something like this:

```javascript
  // The i64 is split into two 32-bit parameters, “low” and “high”.
  send_i64_to_js: function(low, high) {
    console.log("JS received: 0x" + high.toString(16) + low.toString(16));
  }
```

Running this now, we get

```
JS received: 0xabcd12345678
```

As you can see, it’s possible to live with legalization. But it can be kind of annoying!

## The solution: JavaScript BigInts

JavaScript has [BigInt](/features/bigint) values now, which represent integers of arbitrary size, so they can represent 64-bit integers properly. It is natural to want to use those to represent `i64`s from Wasm. That’s exactly what the JS-BigInt-Integration feature does!

Emscripten has support for Wasm BigInt integration, which we can use to compile the original example (without any hacks for legalization), by just adding `-s WASM_BIGINT`:

```
emcc example.c --js-library example.js -o out.js -s WASM_BIGINT
```

We can then run it (note that we need to pass Node.js a flag to enable BigInt integration currently):

```
node --experimental-wasm-bigint a.out.js
JS received: 0xabcd12345678
```

Perfect, exactly what we wanted!

And not only is this simpler, but it’s faster. As mentioned earlier, in practice it’s rare that `i64` conversions happen on a hot path, but when it does the slowdown can be noticeable. If we turn the above example into a benchmark, running many calls of `send_i64_to_js`, then the BigInt version is 18% faster.

Another benefit from BigInt integration is that the toolchain can avoid legalization. If Emscripten does not need to legalize then it may not have any work to do on the Wasm that LLVM emits, which speeds up build times. You can get that speedup if you build with `-s WASM_BIGINT` and do not provide any other flags that require changes to be made. For example, `-O0 -s WASM_BIGINT` works (but optimized builds [run the Binaryen optimizer](https://emscripten.org/docs/optimizing/Optimizing-Code.html#link-times) which is important for size).

## Conclusion

WebAssembly BigInt integration has been implemented in [multiple browsers](https://webassembly.org/roadmap/), including Chrome 85 (released 2020-08-25) so you can try it out today!
