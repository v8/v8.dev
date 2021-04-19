---
title: 'Fast, parallel applications with WebAssembly SIMD'
author: 'Deepti Gandluri ([@dptig](https://twitter.com/dptig)), Thomas Lively ([@tlively52](https://twitter.com/tlively52)), Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
date: 2020-01-30
updated: 2021-04-19
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

The current proposal introduces a new `v128` value type, and a number of new operations that operate on this type. The criteria used to determine these operations are:

- The operations should be well supported across multiple modern architectures.
- Performance wins should be positive across multiple relevant architectures within an instruction group.
- The chosen set of operations should minimize performance cliffs if any.

The proposal is now in [finalized state (phase 4)](https://github.com/WebAssembly/simd/issues/480), both V8 and the toolchain have working implementations.

## Enabling SIMD support

### Feature detection

First of all, note that SIMD is a new feature and isn't yet available in all browsers with WebAssembly support. You can find which browsers support new WebAssembly features on the [webassembly.org](https://webassembly.org/roadmap/) website.

To ensure that all users can load your application, you'll need to build two different versions - one with SIMD enabled and one without it - and load the corresponding version depending on feature detection results. To detect SIMD at runtime, you can use [`wasm-feature-detect`](https://github.com/GoogleChromeLabs/wasm-feature-detect) library and load the corresponding module like this:

```js
import { simd } from 'wasm-feature-detect';

(async () => {
  const hasSIMD = await simd();
  const module = await (
    hasSIMD
      ? import('./module-with-simd.js')
      : import('./module-without-simd.js')
  );
  // …now use `module` as you normally would
})();
```

To learn about building code with SIMD support, check the section [below](#building-with-simd-support).

### Enabling experimental SIMD support in Chrome

WebAssembly SIMD support will be available by default from Chrome 91, while on older versions it's gated behind a flag. To try out the SIMD support in stable Chrome, pass `--enable-features=WebAssemblySimd`, or toggle the "WebAssembly SIMD support" flag in `chrome://flags`. Make sure to use the latest version of the toolchain as detailed below, and a recent Chrome Canary. If something doesn’t look right, please [file a bug](https://crbug.com/v8).

WebAssembly SIMD is also available as an origin trial in Chrome versions 84-90. Origin trials allow developers to experiment with a feature on the chosen origin, and provide valuable feedback. Once an origin trial token has been registered, the trial users are opted into the feature for the duration of the trial period without having to update Chrome flags.

To try this out, read the [origin trial developer guide](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md), and [register for an origin trial token](https://developers.chrome.com/origintrials/#/view_trial/-4708513410415853567). More information about origin trials can be found in the [FAQ](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md#faq). Please file a [bug](https://bugs.chromium.org/p/v8/issues/entry) if something isn't working as you expect. The origin trial is compatible with Emscripten versions 2.0.17 onwards.

### Enabling experimental SIMD support in Firefox

WebAssembly SIMD is available behind a flag in Firefox. Currently it's supported only on x86 and x86-64 architectures. To try out the SIMD support in Firefox, go to `about:config` and enable `javascript.options.wasm_simd`. Note that this feature is still experimental and being worked on.

### Enabling experimental SIMD support in Node.js

In Node.js WebAssembly SIMD can be enabled via `--experimental-wasm-simd` flag:

```bash
node --experimental-wasm-simd main.js
```

## Building with SIMD support

### Building C / C++ to target SIMD

WebAssembly’s SIMD support depends on using a recent build of clang with the WebAssembly LLVM backend enabled. Emscripten has support for the WebAssembly SIMD proposal as well. Install and activate the `latest` distribution of emscripten using [emsdk](https://emscripten.org/docs/getting_started/downloads.html) to use the bleeding edge SIMD features.

```bash
./emsdk install latest
./emsdk activate latest
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

### Cross-compiling existing C / C++ projects

Many existing projects already support SIMD when targeting other platforms, in particular [SSE](https://en.wikipedia.org/wiki/Streaming_SIMD_Extensions) and [AVX](https://en.wikipedia.org/wiki/Advanced_Vector_Extensions) instructions on x86 / x86-64 platforms and [NEON](https://en.wikipedia.org/wiki/ARM_architecture#Advanced_SIMD_(Neon)) instructions on ARM platforms. There are two ways those are usually implemented.

First one is via assembly files that take care of SIMD operations and are linked together with C / C++ during the build process. The assembly syntax and instructions are highly platform-dependant and not portable, so, to make use of SIMD, such projects need to add WebAssembly as an additional supported target and reimplement corresponding functions using either [WebAssembly text format](https://webassembly.github.io/spec/core/text/index.html) or intrinsics described [above](#building-c-/-c++-to-target-simd).

Another common approach is to use SSE / SSE2 / AVX / NEON intrinsics directly from C / C++ code and here Emscripten can help. Emscripten [provides compatible headers and an emulation layer](https://emscripten.org/docs/porting/simd.html) for all those instruction sets, and an emulation layer that compiles them directly to Wasm intrinsics where possible, or scalarized code otherwise.

To cross-compile such projects, first enable SIMD via project-specific configuration flags, e.g. `./configure --enable-simd` so that it passes `-msse`, `-msse2`, `-mavx` or `-mfpu=neon` to the compiler and calls corresponding intrinsics. Then, additionally pass `-msimd128` to enable WebAssembly SIMD too either by using `CFLAGS=-msimd128 make …` / `CXXFLAGS="-msimd128 make …` or by modifying the build config directly when targeting Wasm.

### Building Rust to target SIMD

When compiling Rust code to target WebAssembly SIMD, you'll need to enable the same `simd128` LLVM feature as in Emscripten above.

If you can control `rustc` flags directly or via environment variable `RUSTFLAGS`, pass `-C target-feature=+simd128`:

```bash
rustc … -C target-feature=+simd128 -o out.wasm
```

or

```bash
RUSTFLAGS="-C target-feature=+simd128" cargo build
```

Like in Clang / Emscripten, LLVM’s autovectorizers are enabled by default for optimized code when `simd128` feature is enabled.

For example, Rust equivalent of the `multiply_arrays` example above

```rust
pub fn multiply_arrays(out: &mut [i32], in_a: &[i32], in_b: &[i32]) {
  in_a.iter()
    .zip(in_b)
    .zip(out)
    .for_each(|((a, b), dst)| {
        *dst = a * b;
    });
}
```

would produce similar autovectorized code for the aligned part of the inputs.

In order to have manual control over the SIMD operations, you can use the nightly toolchain, enable Rust feature `wasm_simd` and invoke the intrinsics from the [`std::arch::wasm32`](https://doc.rust-lang.org/stable/core/arch/wasm32/index.html#simd) namespace directly:

```rust
#![feature(wasm_simd)]

use std::arch::wasm32::*;

pub unsafe fn multiply_arrays(out: &mut [i32], in_a: &[i32], in_b: &[i32]) {
  in_a.chunks(4)
    .zip(in_b.chunks(4))
    .zip(out.chunks_mut(4))
    .for_each(|((a, b), dst)| {
      let a = v128_load(a.as_ptr() as *const v128);
      let b = v128_load(b.as_ptr() as *const v128);
      let prod = i32x4_mul(a, b);
      v128_store(dst.as_mut_ptr() as *mut v128, prod);
    });
}
```

Alternatively, use a helper crate like [`packed_simd`](https://crates.io/crates/packed_simd_2) that abstracts over SIMD implementations on various platforms.

## Compelling use cases

The WebAssembly SIMD proposal seeks to accelerate high compute applications like audio/video codecs, image processing applications, cryptographic applications, etc. Currently WebAssembly SIMD is experimentally supported in widely used open source projects like [Halide](https://github.com/halide/Halide/blob/master/README_webassembly.md), [OpenCV.js](https://docs.opencv.org/3.4/d5/d10/tutorial_js_root.html), and [XNNPACK](https://github.com/google/XNNPACK).

Some interesting demos come from the [MediaPipe project](https://github.com/google/mediapipe) by the Google Research team.

As per their description, MediaPipe is a framework for building multimodal (eg. video, audio, any time series data) applied ML pipelines. And they have a [Web version](https://developers.googleblog.com/2020/01/mediapipe-on-web.html), too!

One of the most visually appealing demos where it’s easy to observe the difference in performance SIMD makes, is a CPU-only (non-GPU) build of a hand-tracking system. [Without SIMD](https://storage.googleapis.com/aim-bucket/users/tmullen/demos_10_2019_cdc/rebuild_04_2021/mediapipe_handtracking/gl_graph_demo.html), you can get only around 14-15 FPS (frames per second) on a modern laptop, while [with SIMD enabled in Chrome Canary](https://storage.googleapis.com/aim-bucket/users/tmullen/demos_10_2019_cdc/rebuild_04_2021/mediapipe_handtracking_simd/gl_graph_demo.html) you get a much smoother experience at 38-40 FPS.

<figure>
  <video autoplay muted playsinline loop width="600" height="216" src="/_img/simd/hand.mp4"></video>
</figure>

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

The current fixed-width SIMD proposal is in [Phase 4](https://github.com/WebAssembly/meetings/blob/master/process/phases.md#3-implementation-phase-community--working-group), so it's considered complete.

Some explorations of future SIMD extensions have started in [Relaxed SIMD](https://github.com/WebAssembly/relaxed-simd) and [Flexible Vectors](https://github.com/WebAssembly/flexible-vectors) proposals, which, at the moment of writing, are in Phase 1.
