---
title: 'Documentation'
---
V8 is Google’s open source high-performance JavaScript and WebAssembly engine, written in C++. It is used in Google Chrome, the open source browser from Google, and in Node.js, among others.

This documentation is aimed at C++ developers who want to use V8 in their applications, as well as anyone interested in V8’s design and performance. This document introduces you to V8, while the remaining documentation shows you how to use V8 in your code and describes some of its design details, as well as providing a set of JavaScript benchmarks for measuring V8's performance.

## About V8

V8 implements <a href="https://tc39.github.io/ecma262/">ECMAScript</a> and <a href="https://webassembly.github.io/spec/core/">WebAssembly</a>, and runs on Windows 7 or later, macOS 10.12+, and Linux systems that use x64, IA-32, ARM, or MIPS processors. V8 can run standalone, or can be embedded into any C++ application.

V8 compiles and executes JavaScript source code, handles memory allocation for objects, and garbage collects objects it no longer needs. V8’s stop-the-world, generational, accurate garbage collector is one of the keys to V8’s performance.

JavaScript is commonly used for client-side scripting in a browser, being used to manipulate Document Object Model (DOM) objects for example. The DOM is not, however, typically provided by the JavaScript engine but instead by a browser. The same is true of V8 — Google Chrome provides the DOM. V8 does however provide all the data types, operators, objects and functions specified in the ECMA standard.

V8 enables any C++ application to expose its own objects and functions to JavaScript code. It’s up to you to decide on the objects and functions you would like to expose to JavaScript.

## Documentation overview

- [Building V8 from source](/docs/build)
    - [Checking out the V8 source code](/docs/source-code)
    - [Building with GN](build-gn)
    - [Cross-compiling for ARM](Cross-compiling-for-ARM)
    - [GUI and IDE access](GUI-and-IDE-access)
- [Contributing](Contributing)
    - [API stability](API-stability)
    - [Becoming a committer](Becoming-a-committer)
    - [Blink layout tests](Blink-layout-tests)
    - [Code of conduct](Code-of-conduct)
    - [Committer’s responsibility](Committer's-responsibility)
    - [Evaluating code coverage](Evaluating-Code-Coverage)
    - [Feature launch process](Feature-Launch-Process)
    - [Flake bisect](Flake-bisect)
    - [Handling of ports](Handling-of-Ports)
    - [How to change V8’s public API](How-to-change-V8-public-API)
    - [Merging & patching](/docs/merging-patching)
    - [Node.js integration build](What-to-do-if-your-CL-broke-the-Node.js-integration-build)
    - [Release process](Release-Process)
    - [Reporting security bugs](Reporting-security-bugs)
    - [Testing](Testing)
    - [Triaging issues](Triaging-issues)
- Debugging
    - [ARM debugging](ARM-Debugging)
    - [Debugging builtins with GDB](Debugging-Builtins-with-GDB)
    - [GDB JIT interface](GDB-JIT-Interface)
    - [Memory leaks](Memory-Leaks)
    - [Stack Trace API](Stack-Trace-API)
    - [Using D8](Using-D8)
    - [Using D8 on Android](D8-on-Android)
    - [V8 Inspector API](Debugging-over-the-V8-Inspector-API)
- Embedding V8
    - [Getting started with embedding V8](Getting-Started-with-Embedding)
    - [Example code](Example-code)
    - [Embedder’s guide](Embedder's-Guide) <!-- TODO: how is this different from the getting started guide? -->
    - [Version numbers](Version-numbers)
    - [Built-in functions](Built-in-functions)
    - [i18n support](i18n-support)
    - [Untrusted code mitigations](Untrusted-code-mitigations)
- Under the hood
    - [Ignition](/docs/ignition)
    - [TurboFan](/docs/turbofan)
    - [CodeStubAssembler built-ins](/docs/csa-builtins)
- Writing optimizable JavaScript
    - [Using V8’s sample-based profiler](/docs/profiler)
    - [Using Linux `perf` with V8](/docs/linux-perf)
    - [Profiling Chromium with V8](/docs/profiling-chromium)
    - [Tracing V8](/docs/tracing)
