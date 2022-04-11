---
title: 'WebAssembly Dynamic Tiering ready to try in Chrome 96'
author: 'Andreas Haas — Tierisch fun'
avatars:
  - andreas-haas
date: 2021-10-29
tags:
  - WebAssembly
description: 'WebAssembly Dynamic Tiering ready to try in V8 v9.6 and Chrome 96, either through a commandline flag, or through an origin trial'
tweet: '1454158971674271760'
---

V8 has two compilers to compile WebAssembly code to machine code that can then be executed: the baseline compiler __Liftoff__ and the optimizing compiler __TurboFan__. Liftoff can generate code much faster than TurboFan, which allows fast startup time. TurboFan, on the other hand, can generate faster code, which allows high peak performance.

In the current configuration of Chrome a WebAssembly module first gets compiled completely by Liftoff. After Liftoff compilation is finished, the whole module gets compiled again immediately in the background by TurboFan. With streaming compilation, TurboFan compilation can start earlier if Liftoff compiles WebAssembly code faster than the WebAssembly code is downloaded. The initial Liftoff compilation allows fast startup time, whereas the TurboFan compilation in the background provides high peak performance as soon as possible. More details about Liftoff, TurboFan, and the whole compilation process can be found in a [separate document](https://v8.dev/docs/wasm-compilation-pipeline).

Compiling the whole WebAssembly module with TurboFan provides the best possible performance once compilation is completed, but that comes at a cost:

- The CPU cores that execute TurboFan compilation in the background can block other tasks that would require the CPU, e.g. workers of the web application.
- TurboFan compilation of unimportant functions may delay the TurboFan compilation of more important functions, which may delay the web application to reach full performance.
- Some WebAssembly functions may never get executed, and spending resources on compiling these functions with TurboFan may not be worth it.

## Dynamic tiering

Dynamic tiering should alleviate these issues by compiling only those functions with TurboFan that actually get executed multiple times. Thereby dynamic tiering can change the performance of web applications in several ways: dynamic tiering can speed up startup time by reducing the load on CPUs and thereby allowing startup tasks other than WebAssembly compilation to use the CPU more. Dynamic tiering can also slow down performance by delaying TurboFan compilation for important functions. As V8 does not use on-stack-replacement for WebAssembly code, the execution can be stuck in a loop in Liftoff code, for example. Also code caching is affected, because Chrome only caches TurboFan code, and all functions that never qualify for TurboFan compilation get compiled with Liftoff at startup even when the compiled WebAssembly module already exists in cache.

## How to try it out

We encourage interested developers to experiment with the performance impact of dynamic tiering on their web applications. This will allow us to react and avoid potential performance regressions early. Dynamic tiering can be enabled locally by running Chrome with the command line flag `--enable-blink-features=WebAssemblyDynamicTiering`.

V8 embedders who want to enable dynamic tiering can do so by setting the V8 flag `--wasm-dynamic-tiering`.

### Testing in the field with an Origin Trial

Running Chrome with a command line flag is something a developer can do, but it should not be expected from an end user. To experiment with your application in the field, it is possible to join what is called an [Origin Trial](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md). Origin trials allow you to try out experimental features with end users through a special token that is tied to a domain. This special token enables WebAssembly dynamic tiering for the end user on specific pages that include the token. To obtain your own token to run an origin trial, [use the application form](https://developer.chrome.com/origintrials/#/view_trial/3716595592487501825).

## Give us feedback

We're looking for feedback from developers trying out this feature as it'll help to get the heuristics right on when TurboFan compilation is useful, and when TurboFan compilation does not pay off and can be avoided. The best way to send feedback is to [report issues](https://bugs.chromium.org/p/chromium/issues/detail?id=1260322).
