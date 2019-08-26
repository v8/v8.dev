---
title: 'V8 release v6.6'
author: 'the V8 team'
date: 2018-03-27 13:33:37
tags:
  - release
tweet: '978534399938584576'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.6), which is in beta until its release in coordination with Chrome 66 Stable in several weeks. V8 v6.6 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript language features

### `Function.prototype.toString` revision { #function-tostring }

[`Function.prototype.toString()`](/features/function-tostring) now returns exact slices of source code text, including whitespace and comments. Here’s an example comparing the old and the new behavior:

```js
// Note the comment between the `function` keyword
// and the function name, as well as the space following
// the function name.
function /* a comment */ foo () {}

// Previously:
foo.toString();
// → 'function foo() {}'
//             ^ no comment
//                ^ no space

// Now:
foo.toString();
// → 'function /* comment */ foo () {}'
```

### JSON ⊂ ECMAScript { #json-ecmascript }

Line separator (U+2028) and paragraph separator (U+2029) symbols are now allowed in string literals, [matching JSON](/features/subsume-json). Previously, these symbols were treated as line terminators within string literals, and so using them resulted in a `SyntaxError` exception.

### Optional `catch` binding { #optional-catch-binding }

The `catch` clause of `try` statements can now be [used without a parameter](/features/optional-catch-binding). This is useful if you don’t have a need for the `exception` object in the code that handles the exception.

```js
try {
  doSomethingThatMightThrow();
} catch { // → Look mom, no binding!
  handleException();
}
```

### One-sided string trimming { #string-trimming }

In addition to `String.prototype.trim()`, V8 now implements [`String.prototype.trimStart()` and `String.prototype.trimEnd()`](/features/string-trimming). This functionality was previously available through the non-standard `trimLeft()` and `trimRight()` methods, which remain as aliases of the new methods for backward compatibility.

```js
const string = '  hello world  ';
string.trimStart();
// → 'hello world  '
string.trimEnd();
// → '  hello world'
string.trim();
// → 'hello world'
```

### `Array.prototype.values` { #array-values }

[The `Array.prototype.values()` method](https://tc39.es/ecma262/#sec-array.prototype.values) gives arrays the same iteration interface as the ES2015 `Map` and `Set` collections: all can now be iterated over by `keys`, `values`, or `entries` by calling the same-named method. This change has the potential to be incompatible with existing JavaScript code. If you discover odd or broken behavior on a website, please try to disable this feature via `chrome://flags/#enable-array-prototype-values` and [file an issue](https://bugs.chromium.org/p/v8/issues/entry?template=Defect+report+from+user).

## Code caching after execution

The terms _cold_ and _warm load_ might be well-known for people concerned about loading performance. In V8, there is also the concept of a _hot load_. Let’s explain the different levels with Chrome embedding V8 as an example:

- **Cold load:** Chrome sees the visited web page for the first time and does not have any data cached at all.
- **Warm load**: Chrome remembers that the web page was already visited and can retrieve certain assets (e.g. images and script source files) from the cache. V8 recognizes that the page shipped the same script file already, and therefore caches the compiled code along with the script file in the disk cache.
- **Hot load**: The third time Chrome visits the web page, when serving script file from the disk cache, it also provides V8 with the code cached during the previous load. V8 can use this cached code to avoid having to parse and compile the script from scratch.

Before V8 v6.6 we cached the generated code immediately after the top-level compile. V8 only compiles the functions that are known to be immediately executed during the top-level compile and marks other functions for lazy compilation. This meant that cached code only included top-level code, while all other functions had to be lazily compiled from scratch on each page load. Beginning with version 6.6, V8 caches the code generated after the script’s top-level execution. As we execute the script, more functions are lazily compiled and can be included in the cache. As a result, these functions don’t need to be compiled on future page loads, reducing compile and parse time in hot load scenarios by between 20–60%. The visible user change is a less congested main thread, thus a smoother and faster loading experience.

Look out for a detailed blog post on this topic soon.

## Background compilation

For some time V8 has been able to [parse JavaScript code on a background thread](https://blog.chromium.org/2015/03/new-javascript-techniques-for-rapid.html). With V8’s new [Ignition bytecode interpreter that shipped last year](/blog/launching-ignition-and-turbofan), we were able to extend this support to also enable compilation of the JavaScript source to bytecode on a background thread. This enables embedders to perform more work off the main thread, freeing it up to execute more JavaScript and reduce jank. We enabled this feature in Chrome 66, where we see between 5% to 20% reduction on main-thread compilation time on typical websites. For more details, please see [the recent blog post on this feature](/blog/background-compilation).

## Removal of AST numbering

We have continued to reap benefits from simplifying our compilation pipeline after the [Ignition and TurboFan launch last year](/blog/launching-ignition-and-turbofan). Our previous pipeline required a post-parsing stage called "AST Numbering", where nodes in the generated abstract syntax tree were numbered so that the various compilers using it would have a common point of reference.

Over time this post-processing pass had ballooned to include other functionality: numbering suspend point for generators and async functions, collecting inner functions for eager compilation, initializing literals or detecting unoptimizable code patterns.

With the new pipeline, the Ignition bytecode became the common point of reference, and the numbering itself was no longer required — but, the remaining functionality was still needed, and the AST numbering pass remained.

In V8 v6.6, we finally managed to [move out or deprecate this remaining functionality](https://bugs.chromium.org/p/v8/issues/detail?id=7178) into other passes, allowing us to remove this tree walk. This resulted in a 3-5% improvement in real-world compile time.

## Asynchronous performance improvements

We managed to squeeze out some nice performance improvements for promises and async functions, and especially managed to close the gap between async functions and desugared promise chains.

<figure>
  <img src="/_img/v8-release-66/promise.png" width="1508" height="1028" alt="" loading="lazy">
</figure>

In addition, the performance of async generators and async iteration was improved significantly, making them a viable option for the upcoming Node 10 LTS, which is scheduled to include V8 v6.6. As an example, consider the following Fibonacci sequence implementation:

```js
async function* fibonacciSequence() {
  for (let a = 0, b = 1;;) {
    yield a;
    const c = a + b;
    a = b;
    b = c;
  }
}

async function fibonacci(id, n) {
  for await (const value of fibonacciSequence()) {
    if (n-- === 0) return value;
  }
}
```

We’ve measured the following improvements for this pattern, before and after Babel transpilation:

<figure>
  <img src="/_img/v8-release-66/async-generator.png" width="1508" height="1028" alt="" loading="lazy">
</figure>

Finally, [bytecode improvements](https://chromium-review.googlesource.com/c/v8/v8/+/866734) to “suspendable functions” such as generators, async functions, and modules, have improved the performance of these functions while running in the interpreter, and decreased their compiled size. We’re planning on improving the performance of async functions and async generators even further with upcoming releases, so stay tuned.

## Array performance improvements

The throughput performance of `Array#reduce` was increased by more than 10× for holey double arrays ([see our blog post for an explanation what holey and packed arrays are](/blog/elements-kinds)). This widens the fast-path for cases where `Array#reduce` is applied to holey and packed double arrays.

<figure>
  <img src="/_img/v8-release-66/array-reduce.png" width="1300" height="742" alt="" loading="lazy">
</figure>

## Untrusted code mitigations

In V8 v6.6 we’ve landed [more mitigations for side-channel vulnerabilities](/docs/untrusted-code-mitigations) to prevent information leaks to untrusted JavaScript and WebAssembly code.

## GYP is gone

This is the first V8 version that officially ships without GYP files. If your product needs the deleted GYP files, you need to copy them into your own source repository.

## Memory profiling

Chrome’s DevTools can now trace and snapshot C++ DOM objects and display all reachable DOM objects from JavaScript with their references. This feature is one of the benefits of the new C++ tracing mechanism of the V8 garbage collector. For more information please have a look at [the dedicated blog post](/blog/tracing-js-dom).

## V8 API

Please use `git log branch-heads/6.5..branch-heads/6.6 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.6 -t branch-heads/6.6` to experiment with the new features in V8 v6.6. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
