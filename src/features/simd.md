---
title: 'Fast, parallel applications with WebAssembly SIMD'
author: 'Deepti Gandluri ([@dptig](https://twitter.com/dptig)), Thomas Lively ([@tlively52](https://twitter.com/tlively52))'
date: 2020-01-30
tags:
  - WebAssembly
description: 'Bringing vector operations to WebAssembly'
tweet: '1222944308183085058'
---
SIMD stands for _Single Instruction, Multiple Data_. SIMD instructions are a special class of instructions that exploit data parallelism in applications by simultaneously performing the same operation on multiple data elements. Compute intensive applications like audio/video codecs, image processors, are all examples of applications that take advantage of SIMD instructions to accelerate performance. Most modern architectures support some variants of SIMD instructions.

The WebAssembly SIMD proposal defines a portable, performant subset of SIMD operations that are available across most modern architectures. This proposal derived many elements from the [SIMD.js proposal](https://github.com/tc39/ecmascript_simd), which in turn was originally derived from the [Dart SIMD](https://www.researchgate.net/publication/261959129_A_SIMD_programming_model_for_dart_javascriptand_other_dynamically_typed_scripting_languages) specification. The SIMD.js proposal was an API proposed at TC39 with new types and functions for performing SIMD computations, but this was archived in favor of supporting SIMD operations more transparently in WebAssembly. The [WebAssembly SIMD proposal](https://github.com/WebAssembly/simd) was introduced as a way for browsers to take advantage of the data level parallelism using the underlying hardware.

## WebAssembly SIMD proposal

The high-level goal of the WebAssembly SIMD proposal is to introduce vector operations to the WebAssembly Specification, in a way that guarantees portable performance.

The set of SIMD instructions is large, and varied across architectures. The set of operations included in the WebAssembly SIMD proposal consist of operations that are well supported on a wide variety of platforms, and are proven to be performant. To this end, the current proposal is limited to standardizing Fixed-Width 128-bit SIMD operations.

The current proposal introduces a new v128 value type, and a number of new operations that operate on this type. The criteria used to determine these operations are:

- The operations should be well supported across multiple modern architectures.
- Performance wins should be positive across multiple relevant architectures within an instruction group.
- The chosen set of operations should minimize performance cliffs if any.

The proposal is in active development, both V8 and the toolchain have working prototype implementations for experimentation. As these are prototype implementations, they are subject to change as new operations are added to the proposal.

## Using WebAssembly SIMD

### Enabling experimental SIMD support in Chrome

WebAssembly SIMD support is prototyped behind a flag in Chrome, to try out the SIMD support on the browser, pass `--enable-features=WebAssemblySimd`, or toggle the "WebAssembly SIMD support" flag in `chrome://flags`. This work is bleeding edge, and continuously being worked on. To minimize the chances of breakage, please use the latest version of the toolchain as detailed below, and a recent Chrome Canary. If something doesn’t look right, please [file a bug](https://crbug.com/v8).

### Building C / C++ to target SIMD

WebAssembly’s SIMD support depends on using a recent build of clang with the WebAssembly LLVM backend enabled. Emscripten has support for the WebAssembly SIMD proposal as well. Install and activate the latest-upstream distribution of emscripten using [emsdk](https://emscripten.org/docs/getting_started/downloads.html) to use the bleeding edge SIMD features.

```bash
./emsdk install latest-upstream

./emsdk activate latest-upstream
```

There are a couple of different ways to enable generating SIMD code when porting your application to use SIMD. Once the latest upstream emscripten version has been installed, compile using emscripten, and pass the `-msimd128` flag to enable SIMD.

```bash
emcc -msimd128 -O3 foo.c -o foo.js
```

Applications that have already been ported to use WebAssembly may benefit from SIMD with no source modifications thanks to LLVM’s autovectorization optimizations.

These optimizations can automatically transform loops that perform arithmetic operations on each iteration into equivalent loops that perform the same arithmetic operations on multiple inputs at a time using SIMD instructions. LLVM’s autovectorizers are enabled by default at optimization levels `-O2` and `-O3` when the `-msimd128` flag is supplied.

For example, consider the following function that multiplies the elements of two input arrays together and stores the results in an output array.

```cpp
void multiply_arrays(int* out, int* in_a, int* in_b, int size) {
  for (int i = 0; i < size; i++) {
    out[i] = in_a[i] * in_b[i];
  }
}
```

Without passing the `-msimd128` flag, the compiler emits this WebAssembly loop:

```wasm
(loop
  (i32.store
    … get address in `out` …
    (i32.mul
      (i32.load … get address in `in_a` …)
      (i32.load … get address in `in_b` …)
  …
)
```

But when the `-msimd128` flag is used, the autovectorizer turns this into code that includes the following loop:

```wasm
(loop
  (v128.store align=4
    … get address in `out` …
    (i32x4.mul
       (v128.load align=4 … get address in `in_a` …)
       (v128.load align=4 … get address in `in_b` …)
    …
  )
)
```

The loop body has the same structure but SIMD instructions are being used to load, multiply, and store four elements at a time inside the loop body.

For finer grained control over the SIMD instructions generated by the compiler, include the [`wasm_simd128.h` header file](https://github.com/llvm/llvm-project/blob/master/clang/lib/Headers/wasm_simd128.h), which defines a set of intrinsics. Intrinsics are special functions that, when called, will be turned by the compiler into the corresponding WebAssembly SIMD instructions, unless it can make further optimizations.

As an example, here is the same function from before manually rewritten to use the SIMD intrinsics.

```cpp
#include <wasm_simd128.h>

void multiply_arrays(int* out, int* in_a, int* in_b, int size) {
  for (int i = 0; i < size; i += 4) {
    v128_t a = wasm_v128_load(&in_a[i]);
    v128_t b = wasm_v128_load(&in_b[i]);
    v128_t prod = wasm_i32x4_mul(a, b);
    wasm_v128_store(&out[i], prod);
  }
}
```

This manually rewritten code assumes that the input and output arrays are aligned and do not alias and that size is a multiple of four. The autovectorizer cannot make these assumptions and has to generate extra code to handle the cases where they are not true, so hand-written SIMD code often ends up being smaller than autovectorized SIMD code.

## Compelling use cases

The WebAssembly SIMD proposal seeks to accelerate high compute applications like audio/video codecs, image processing applications, cryptographic applications, etc. Currently WebAssembly SIMD is experimentally supported in widely used open source projects like [Halide](https://github.com/halide/Halide/blob/master/README_webassembly.md), [OpenCV.js](https://docs.opencv.org/3.4/d5/d10/tutorial_js_root.html), and [XNNPACK](https://github.com/google/XNNPACK).

Some interesting demos come from the [MediaPipe project](https://github.com/google/mediapipe) by the Google Research team.

As per their description, MediaPipe is a framework for building multimodal (eg. video, audio, any time series data) applied ML pipelines. And they have a [Web version](https://mediapipe.page.link/web), too!

One of the most visually appealing demos where it’s easy to observe the difference in performance SIMD makes, is a following hand-tracking system. Without SIMD, you can get only around 3 frames per second on a modern laptop, while with SIMD enabled you get a much smoother experience at 15-16 frames per second.

<figure>
  <video autoplay muted playsinline loop width="600" height="216" src="/_img/simd/hand.mp4"></video>
</figure>

Visit the [demo](https://pursuit.page.link/MediaPipeHandTrackingSimd) in Chrome Canary with SIMD enabled to try it!

Another interesting set of demos that makes use of SIMD for smooth experience, come from OpenCV - a popular computer vision library that can also be compiled to WebAssembly. They’re available by [link](https://bit.ly/opencv-camera-demos), or you can check out the pre-recorded versions below:

<figure>
  <video autoplay muted playsinline loop width="256" height="512" src="/_img/simd/credit-card.mp4"></video>
  <figcaption>Card reading</figcaption>
</figure>

<figure>
  <video autoplay muted playsinline loop width="600" height="646" src="/_img/simd/invisibility-cloak.mp4"></video>
  <figcaption>Invisibility cloak</figcaption>
</figure>

<figure>
  <video autoplay muted playsinline loop width="600" height="658" src="/_img/simd/emotion-recognizer.mp4"></video>
  <figcaption>Emoji replacement</figcaption>
</figure>

## Future work

The current SIMD proposal is in Phase 2, so the future work here is to push the proposal forward in the standardization process. Fixed width SIMD gives significant performance gains over scalar, but it doesn’t effectively leverage wider width vector operations that are available in modern hardware. As the current proposal moves forward, some future facing work here is to determine the feasibility of extending the proposal with longer width operations.

To try out current experimental support, use the latest-upstream Emscripten toolchain, and a recent Chrome Canary as detailed [above](#using-webassembly-simd). Please note that as the support is experimental, we are actively working on feature completion and performance so some breakage, or performance inconsistencies are possible.
