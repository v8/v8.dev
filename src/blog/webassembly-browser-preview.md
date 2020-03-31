---
title: 'WebAssembly browser preview'
author: 'the V8 team'
date: 2016-10-31 13:33:37
tags:
  - WebAssembly
description: 'WebAssembly or Wasm is a new runtime and compilation target for the web, now available behind a flag in Chrome Canary!'
---
Today we’re happy to announce, in tandem with [Firefox](https://hacks.mozilla.org/2016/10/webassembly-browser-preview) and [Edge](https://blogs.windows.com/msedgedev/2016/10/31/webassembly-browser-preview/), a WebAssembly browser preview. [WebAssembly](http://webassembly.org/) or Wasm is a new runtime and compilation target for the web, designed by collaborators from Google, Mozilla, Microsoft, Apple, and the [W3C WebAssembly Community Group](https://www.w3.org/community/webassembly/).

## What does this milestone mark?

This milestone is significant because it marks:

- a release candidate for our [MVP](http://webassembly.org/docs/mvp/) (minimum viable product) design (including [semantics](http://webassembly.org/docs/semantics/), [binary format](http://webassembly.org/docs/binary-encoding/), and [JS API](http://webassembly.org/docs/js/))
- compatible and stable implementations of WebAssembly behind a flag on trunk in V8 and SpiderMonkey, in development builds of Chakra, and in progress in JavaScriptCore
- a [working toolchain](http://webassembly.org/getting-started/developers-guide/) for developers to compile WebAssembly modules from C/C++ source files
- a [roadmap](http://webassembly.org/roadmap/) to ship WebAssembly on-by-default barring changes based on community feedback

You can read more about WebAssembly on the [project site](http://webassembly.org/) as well as follow our [developers guide](http://webassembly.org/getting-started/developers-guide/) to test out WebAssembly compilation from C & C++ using Emscripten. The [binary format](http://webassembly.org/docs/binary-encoding/) and [JS API](http://webassembly.org/docs/js/) documents outline the binary encoding of WebAssembly and the mechanism to instantiate WebAssembly modules in the browser, respectively. Here’s a quick sample to show what wasm looks like:

![An implementation of the Greatest Common Divisor function in WebAssembly, showing the raw bytes, the text format (WAST), and the C source code.](/_img/webassembly-browser-preview/gcd.svg)

Since WebAssembly is still behind a flag in Chrome ([chrome://flags/#enable-webassembly](chrome://flags/#enable-webassembly)), it is not yet recommended for production use. However, the Browser Preview period marks a time during which we are actively collecting [feedback](http://webassembly.org/community/feedback/) on the design and implementation of the spec. Developers are encouraged to test out compiling and porting applications and running them in the browser.

V8 continues to optimize the implementation of WebAssembly in the [TurboFan compiler](/blog/turbofan-jit). Since last March when we first announced experimental support, we’ve added support for parallel compilation. In addition, we’re nearing completion of an alternate asm.js pipeline, which converts asm.js to WebAssembly [under the hood](https://www.chromestatus.com/feature/5053365658583040) so that existing asm.js sites can reap some of the benefits of WebAssembly ahead-of-time compilation.

## What’s next?

Barring major design changes arising from community feedback, the WebAssembly Community Group plans to produce an official specification in Q1 2017, at which point browsers will be encouraged to ship WebAssembly on-by-default. From that point forward, the binary format will be reset to version 1 and WebAssembly will be versionless, feature-tested, and backwards-compatible. A more detailed [roadmap](http://webassembly.org/roadmap/) can be found on the WebAssembly project site.
