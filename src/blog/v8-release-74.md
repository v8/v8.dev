---
title: 'V8 release v7.4'
author: 'Georg Neis'
date: 2019-03-22 16:30:42
tags:
  - release
tweet: '1109094755936489472'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.4](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.4), which is in beta until its release in coordination with Chrome 74 Stable in several weeks. V8 v7.4 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JIT-less V8

V8 now supports *JavaScript* execution without allocating executable memory at runtime. In-depth information on this feature can be found in the [dedicated blog post](/blog/jitless).

## WebAssembly Threads/Atomics shipped

WebAssembly Threads/Atomics are now enabled on non-Android operating systems. This concludes the [origin trial/preview we enabled in V8 v7.0](/blog/v8-release-70#a-preview-of-webassembly-threads). A Web Fundamentals article explains [how to use WebAssembly Atomics with Emscripten](https://developers.google.com/web/updates/2018/10/wasm-threads).

This unlocks the usage of multiple cores on a user’s machine via WebAssembly, enabling new, computation-heavy use cases on the web.

## Performance

### Faster calls with arguments mismatch

In JavaScript it’s perfectly valid to call functions with too few or too many parameters (i.e. pass fewer or more than the declared formal parameters). The former is called _under-application_, the latter is called _over-application_. In case of under-application, the remaining formal parameters get assigned `undefined`, while in case of over-application, the superfluous parameters are ignored.

However, JavaScript functions can still get to the actual parameters by means of the [`arguments` object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments), by using [rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters), or even by using the non-standard [`Function.prototype.arguments` property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/arguments) on [sloppy mode](https://developer.mozilla.org/en-US/docs/Glossary/Sloppy_mode) functions. As a result, JavaScript engines must provide a way to get to the actual parameters. In V8 this is done via a technique called _arguments adaption_, which provides the actual parameters in case of under- or over-application. Unfortunately, arguments adaption comes at a performance cost, and is needed commonly in modern front-end and middleware frameworks (i.e. lots of APIs with optional parameters or variable argument lists).

There are scenarios where the engine knows that arguments adaption is not necessary since the actual parameters cannot be observed, namely when the callee is a strict mode function, and uses neither `arguments` nor rest parameters. In these cases, V8 now completely skips arguments adaption, reducing call overhead by up to **60%**.

<figure>
  <img src="/_img/v8-release-74/argument-mismatch-performance.svg" intrinsicsize="600x290" alt="">
  <figcaption>Performance impact of skipping arguments adaption, as measured through <a href="https://gist.github.com/bmeurer/4916fc2b983acc9ee1d33f5ee1ada1d3#file-bench-call-overhead-js">a micro-benchmark</a>.</figcaption>
</figure>

The graph shows that there’s no overhead anymore, even in case of an arguments mismatch (assuming that the callee cannot observe the actual arguments). For more details, see the [design document](https://bit.ly/v8-faster-calls-with-arguments-mismatch).

### Improved native accessor performance

The Angular team [discovered](https://mhevery.github.io/perf-tests/DOM-megamorphic.html) that calling into native accessors (i.e. DOM property accessors) directly via their respective `get` functions was significantly slower in Chrome than the [monomorphic](https://en.wikipedia.org/wiki/Inline_caching#Monomorphic_inline_caching) or even the [megamorphic](https://en.wikipedia.org/wiki/Inline_caching#Megamorphic_inline_caching) property access. This was due to taking the slow-path in V8 for calling into DOM accessors via [`Function#call()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call), instead of the fast-path that was already there for property accesses.

<figure>
  <img src="/_img/v8-release-74/native-accessor-performance.svg" intrinsicsize="600x271" alt="">
</figure>

We managed to improve the performance of calling into native accessors, making it significantly faster than the megamorphic property access. For more background, see [V8 issue #8820](https://bugs.chromium.org/p/v8/issues/detail?id=8820).

### Parser performance

In Chrome, large enough scripts are “streaming”-parsed on worker threads while they are being downloaded. In this release we identified and fixed a performance issue with custom UTF-8 decoding used by the source stream, leading to an average 8% faster streaming parse.

We found an additional issue in V8’s preparser, which most commonly runs on a worker thread: property names were unnecessarily deduplicated. Removing this deduplication improved the streaming parser by another 10.5%. This also improves main-thread parse time of scripts that aren’t streamed, like small scripts and inline scripts.

<figure>
  <img src="/_img/v8-release-74/parser-performance.jpg" srcset="/_img/v8-release-74/parser-performance@2x.jpg" intrinsicsize="1069x244" alt="">
  <figcaption>Each drop in the above chart represents one of the performance improvements in the streaming parser.</figcaption>
</figure>

## Memory

### Bytecode flushing

Bytecode compiled from JavaScript source takes up a significant chunk of V8 heap space, typically around 15%, including related meta-data. There are many functions which are only executed during initialization, or rarely used after having been compiled.

In order to reduce V8’s memory overhead, we have implemented support for flushing compiled bytecode from functions during garbage collection if they haven’t been executed recently. In order to enable this, we keep track of the age of a function’s bytecode, incrementing the age during garbage collections, and resetting it to zero when the function is executed. Any bytecode which crosses an aging threshold is eligible to be collected by the next garbage collection, and the function resets to lazily recompile its bytecode if it is ever executed again in the future.

Our experiments with bytecode flushing show that it provides significant memory savings for users of Chrome, reducing the amount of memory in V8’s heap by between 5–15% while not regressing performance or significantly increasing the amount of CPU time spent compiling JavaScript code.

<figure>
  <img src="/_img/v8-release-74/bytecode-flushing.svg" intrinsicsize="600x271" alt="">
</figure>

### Bytecode dead basic block elimination

The Ignition bytecode compiler attempts to avoid generating code that it knows to be dead, e.g. code after a `return` or `break` statement:

```js
return;
deadCall(); // skipped
```

However, previously this was done opportunistically for terminating statements in a statement list, so it did not take into account other optimizations, such as shortcutting conditions that are known to be true:

```js
if (2.2) return;
deadCall(); // not skipped
```

We tried to resolve this in V8 v7.3, but still on a per-statement level, which wouldn’t work when the control flow became more involved, e.g.

```js
do {
  if (2.2) return;
  break;
} while (true);
deadCall(); // not skipped
```

The `deadCall()` above would be at the start of a new basic block, which on a per-statement level is reachable as a target for `break` statements in the loop.

In V8 v7.4, we allow entire basic blocks to become dead, if no `Jump` bytecode (Ignition’s main control flow primitive) refers to them. In the above example, the `break` is not emitted, which means the loop has no `break` statements. So, the basic block starting with `deadCall()` has no referring jumps, and thus is also considered dead. While we don’t expect this to have a large impact on user code, it is particularly useful for simplifying various desugarings, such as generators, `for-of` and `try-catch`, and in particular removes a class of bugs where basic blocks could “resurrect” complex statements part-way through their implementation.

## JavaScript language features

### Private class fields

V8 v7.2 added support for the public class fields syntax. Class fields simplify class syntax by avoiding the need for constructor functions just to define instance properties. Starting in V8 v7.4, you can mark a field as private by prepending it with a `#` prefix.

```js
class IncreasingCounter {
  #count = 0;
  get value() {
    console.log('Getting the current value!');
    return this.#count;
  }
  increment() {
    this.#count++;
  }
}
```

Unlike public fields, private fields are not accessible outside of the class body:

```js
const counter = new IncreasingCounter();
counter.#count;
// → SyntaxError
counter.#count = 42;
// → SyntaxError
```

For more information, read our [explainer on public and private class fields](/features/class-fields).

### `Intl.Locale`

JavaScript applications generally use strings such as `'en-US'` or `'de-CH'` to identify locales. `Intl.Locale` offers a more powerful mechanism to deal with locales, and enables easily extracting locale-specific preferences such as the language, the calendar, the numbering system, the hour cycle, and so on.

```js
const locale = new Intl.Locale('es-419-u-hc-h12', {
  calendar: 'gregory'
});
locale.language;
// → 'es'
locale.calendar;
// → 'gregory'
locale.hourCycle;
// → 'h12'
locale.region;
// → '419'
locale.toString();
// → 'es-419-u-ca-gregory-hc-h12'
```

### Hashbang grammar

JavaScript programs can now start with `#!`, a so-called [hashbang](https://github.com/tc39/proposal-hashbang). The rest of the line following the hashbang is treated as a single-line comment. This matches de facto usage in command-line JavaScript hosts, such as Node.js. The following is now a syntactically valid JavaScript program:

```js
#!/usr/bin/env node
console.log(42);
```

## V8 API

Please use `git log branch-heads/7.3..branch-heads/7.4 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.4 -t branch-heads/7.4` to experiment with the new features in V8 v7.4. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
