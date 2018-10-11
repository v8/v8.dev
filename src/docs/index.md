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

- [Building from source (start here)](Building-from-Source)
    - [Checking out source](Checking-out-source)
    - [Using Git](Using-Git)
    - [Building with GN](Building-with-GN)
    - [Cross-compiling for ARM](Cross-compiling-for-ARM)
    - [GUI and IDE access](GUI-and-IDE-access)
- [Contributing](Contributing)
    - [Code of conduct](Code-of-conduct)
    - [Committer’s responsibility](Committer's-responsibility)
    - [Testing](Testing)
    - [Evaluating code coverage](Evaluating-Code-Coverage)
    - [Release process](Release-Process)
    - [Feature launch process](Feature-Launch-Process)
    - [Merging & patching](Merging-&-Patching)
    - [Triaging issues](Triaging-issues)
    - [C++ style guide](Cpp-style-guide)
    - [Becoming a committer](Becoming-a-committer)
    - [Handling of ports](Handling-of-Ports)
    - [Reporting security bugs](Reporting-security-bugs)
    - [Node.js integration build](What-to-do-if-your-CL-broke-the-Node.js-integration-build)
    - [How to change V8 public API](How-to-change-V8-public-API)
- Test infrastructure
    - [API stability](API-stability)
    - [Blink layout tests](Blink-layout-tests)
    - [Flake bisect](Flake-bisect)
- Debugging
    - [Using D8](Using-D8)
    - [D8 on Android](D8-on-Android)
    - [V8 Inspector API](Debugging-over-the-V8-Inspector-API)
    - [Stack Trace API](Stack-Trace-API)
    - [ARM debugging](ARM-Debugging)
    - [Debugging Builtins with GDB](Debugging-Builtins-with-GDB)
    - [GDB JIT Interface](GDB-JIT-Interface)
    - [Memory Leaks](Memory-Leaks)
- Embedding V8
    - [Getting started](Getting-Started-with-Embedding)
    - [Example code](Example-code)
    - [Embedder’s guide](Embedder's-Guide)
    - [Version numbers](Version-numbers)
    - [Built-in functions](Built-in-functions)
    - [i18n support](i18n-support)
    - [Untrusted code mitigations](Untrusted-code-mitigations)
- Under the hood
    - [Ignition](/docs/ignition)
    - [TurboFan](/docs/turbofan)
    - [CodeStubAssembler built-ins](/docs/csa-builtins)
- Writing optimizable JavaScript
    - [V8 internal profiler](V8-Profiler)
    - [Using V8’s internal profiler](Using-V8’s-internal-profiler)
    - [V8 Linux perf integration](V8-Linux-perf-Integration)
    - [Profiling Chromium with V8](Profiling-Chromium-with-v8)
    - [Tracing V8](Tracing-V8)
