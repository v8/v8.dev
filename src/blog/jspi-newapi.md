---
title: 'WebAssembly JSPI has a new API'
description: 'This article details some upcoming changes to the JavaScript Promise Integration (JSPI) API.'
author: 'Francis McCabe, Thibaud Michaud, Ilya Rezvov, Brendan Dahl'
date: 2024-06-04
tags:
  - WebAssembly
---
WebAssembly’s JavaScript Promise Integration (JSPI) API has a new API, available in Chrome release M126. We talk about what has changed, how to use it with Emscripten, and what is the roadmap for JSPI.

JSPI is an API that allows WebAssembly applications that use *sequential* APIs to access Web APIs that are *asynchronous*. Many Web APIs are crafted in terms of JavaScript `Promise` objects: instead of immediately performing the requested operation, they return a `Promise` to do so. On the other hand, many applications compiled to WebAssembly come from the C/C++ universe, which is dominated by APIs that block the caller until they are completed.

JSPI hooks into the Web architecture to allow a WebAssembly application to be suspended when the `Promise` is returned and resumed when the `Promise` is resolved.

You can find out more about JSPI and how to use it [in this blog post](https://v8.dev/blog/jspi) and in the [specification](https://github.com/WebAssembly/js-promise-integration).

## What is new?

### The end of `Suspender` objects

In January 2024, the Stacks sub-group of the Wasm CG [voted](https://github.com/WebAssembly/meetings/blob/297ac8b5ac00e6be1fe33b1f4a146cc7481b631d/stack/2024/stack-2024-01-29.md) to amend the API for JSPI. Specifically, instead of an explicit `Suspender` object, we will use the JavaScript/WebAssembly boundary as the delimiter for determining what computations are suspended.

The difference is fairly small but potentially significant: when a computation is to be suspended, it is the most recent call into a wrapped WebAssembly export that determines the 'cut point' for what is suspended.

The implication of this is that a developer using JSPI has a little less control over that cut point. On the other hand, not having to explicitly manage `Suspender` objects makes the API significantly easier to use.

### No more `WebAssembly.Function`

Another change is to the style of the API. Instead of characterizing JSPI wrappers in terms of the `WebAssembly.Function` constructor, we provide specific functions and constructors.

This has a number of benefits:

- It removes dependency on the [*Type Reflection* Proposal](https://github.com/WebAssembly/js-types).
- It makes tooling for JSPI simpler: the new API functions no longer need to refer explicitly to the WebAssembly types of functions.

This change is enabled by the decision to no longer have explicitly referenced `Suspender` objects. 

### Returning without suspending

A third change refers to the behavior of suspending calls. Instead of always suspending when calling a JavaScript function from a suspending import, we only suspend when the JavaScript function actually returns a `Promise`.

This change, while apparently going against the [recommendations](https://www.w3.org/2001/tag/doc/promises-guide#accepting-promises) of the W3C TAG, represents a safe optimization for JSPI users. It is safe because JSPI is actually taking on the role of a *caller* to a function that returns a `Promise`.

This change will likely have minimal impact on most applications; however, some applications will see a notable benefit by avoiding unnecessary trips to the browser's event loop.

### The new API

The API is straightforward: there is a function that takes a function exported from a WebAssembly module and converts it into a function that returns a `Promise`:

```js
Function Webassembly.promising(Function wsFun)
```

Note that even if the argument is typed as a JavaScript `Function`, it is actually restricted to WebAssembly functions.

On the suspending side, there's a new class `WebAssembly.Suspending`, together with a constructor that takes a JavaScript function as an argument. In WebIDL, this is written as follows:

```js
interface Suspending{
  constructor (Function fun);
}
```

Note that this API has an asymmetric feel to it: there's have a function that takes a WebAssembly function and returns a new promising (_sic_) function; whereas to mark a suspending function, you enclose it in a `Suspending` object. This reflects a deeper reality about what is happening under the hood.

The suspending behavior of an import is intrinsically part of the *call* to the import: i.e., some function inside the instantiated module calls the import and suspends as a result.

On the other hand, the `promising` function takes a regular WebAssembly function and returns a new one that can respond to being suspended and which returns a `Promise`.

### Using the new API

If you are an Emscripten user, then using the new API will typically involve no changes to your code. You must be using a version of Emscripten that is at least 3.1.61, and you must be using a version of Chrome that is at least 126.0.6478.17 (Chrome M126).

If you are rolling your own integration, then your code should be significantly simpler. In particular, it is no longer necessary to have code that stores the passed-in `Suspender` object (and retrieve it when calling the import). You can simply use regular sequential code within the WebAssembly module.

### The old API

The old API will continue to operate at least until October 29, 2024 (Chrome M128). After that, we plan on removing the old API.

Note that Emscripten itself will no longer support the old API as of version 3.1.61.

### Detecting which API is in your browser

Changing APIs should never be taken lightly. We are able to do so in this case because JSPI itself is still provisional. There is a simple way that you can test to see which API is enabled in your browser:

```js
function oldAPI(){
  return WebAssembly.Suspender!=undefined
}

function newAPI(){
  return WebAssembly.Suspending!=undefined
}
```

The `oldAPI` function returns true if the old JSPI API is enabled in your browser, and the `newAPI` function returns true if the new JSPI API is enabled.

## What is happening with JSPI?

### Implementation aspects

The biggest change to JSPI that we are working on is actually invisible to most programmers: so-called growable stacks.

The current implementation of JSPI is based on allocating stacks of a fixed size. In fact, the allocated stacks are rather large. This is because we have to be able to accommodate arbitrary WebAssembly computations which may require deep stacks to handle recursion properly.

However, this is not a sustainable strategy: we would like to support applications with millions of suspended coroutines; this is not possible if each stack is 1MB in size.

Growable stacks refers to a stack allocation strategy that allows a WebAssembly stack to grow as needed. That way, we can start with very small stacks for those applications that only need small stack space, and grow the stack when the application runs out of space (otherwise known as stack overflow).

There are several potential techniques for implementing growable stacks. One that we are investigating is segmented stacks. A segmented stack consists of a chain of stack regions &mdash; each of which has a fixed size, but different segments may have different sizes.

Note that while we may be solving the stack overflow issue for coroutines, we are not planning to make the main or central stack growable. Thus, if your application runs out of stack space, growable stacks will not fix your problem unless you use JSPI.

### The standards process

As of publication, there is an active [origin trial for JSPI](https://v8.dev/blog/jspi-ot). The new API will be live during the remainder of the origin trial &mdash; available with Chrome M126.

The previous API will also be available during the origin trial; however, it is planned to be retired shortly after Chrome M128.

After that, the main thrust for JSPI revolves around the standardization process. JSPI is currently (at publication time) in phase 3 of the W3C Wasm CG process. The next step, i.e., moving to phase 4, marks the crucial adoption of JSPI as a standard API for the JavaScript and WebAssembly ecosystems.

We would like to know what you think about these changes to JSPI! Join the discussion at the [W3C WebAssembly Community Group repo](https://github.com/WebAssembly/js-promise-integration).
