---
title: 'V8 release v8.4'
author: 'Camillo Bruni, enjoying some fresh booleans'
avatars:
 - 'camillo-bruni'
date: 2020-06-30
tags:
 - release
description: 'V8 v8.4 features weak references and improved WebAssembly performance.'
tweet: '1277983235641761795'
---
Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.4](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.4), which is in beta until its release in coordination with Chrome 84 Stable in several weeks. V8 v8.4 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## WebAssembly

### Improved start-up time

WebAssembly’s baseline compiler ([Liftoff](https://v8.dev/blog/liftoff)) now supports [atomic instructions](https://github.com/WebAssembly/threads) and [bulk memory operations](https://github.com/WebAssembly/bulk-memory-operations). This means that even if you use these pretty recent spec additions, you get blazingly fast start-up times.

### Better debugging

In an ongoing effort to improve the debugging experience in WebAssembly, we are now able to inspect any WebAssembly frame that is live whenever you pause execution or reach a breakpoint.
This was realized by re-using [Liftoff](https://v8.dev/blog/liftoff) for debugging. In the past, all code that had breakpoints or was stepped through needed to execute in the WebAssembly interpreter, which slowed down execution substantially (often around 100×). With Liftoff, you only lose about one third of your performance, but you can step through all code and inspect it at any time.

### SIMD Origin Trial

The SIMD proposal enables WebAssembly to take advantage of commonly available hardware vector instructions to accelerate compute intensive workloads. V8 has [support](https://v8.dev/features/simd) for the [WebAssembly SIMD proposal](https://github.com/WebAssembly/simd). To enable this in Chrome, use the flag `chrome://flags/#enable-webassembly-simd` or sign up for an [origin trial](https://developers.chrome.com/origintrials/#/view_trial/-4708513410415853567). [Origin trials](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md) allow developers to experiment with a feature before it is standardized, and provide valuable feedback. Once an origin has opted into the trial users are opted into the feature for the duration of the trial period without having to update Chrome flags.

## JavaScript

### Weak references and finalizers

:::note
**Warning!** Weak references and finalizers are advanced features! They depend on garbage collection behavior. Garbage collection is non-deterministic and may not occur at all.
:::

JavaScript is a garbage collected language, which means memory occupied by objects that are no longer reachable by the program may be automatically reclaimed when the garbage collector runs. With the exception of references in `WeakMap` and `WeakSet`, all references in JavaScript are strong and prevent the referenced object from being garbage collected. For instance,

```js
const globalRef = {
  callback() { console.log('foo'); }
};
// As long as globalRef is reachable through the global scope,
// neither it nor the function in its callback property will be collected.
```

JavaScript programmers can now hold on to objects weakly via the `WeakRef` feature. Objects that are referenced by weak references do not prevent their being garbage collected if they are not also strongly referenced.

```js
const globalWeakRef = new WeakRef({
  callback() { console.log('foo'); }
});

(async function() {
  globalWeakRef.deref().callback();
  // Logs “foo” to console. globalWeakRef is guaranteed to be alive
  // for the first turn of the event loop after it was created.

  await new Promise((resolve, reject) => {
    setTimeout(() => { resolve('foo'); }, 42);
  });
  // Wait for a turn of the event loop.

  globalWeakRef.deref()?.callback();
  // The object inside globalWeakRef may be garbage collected
  // after the first turn since it is not otherwise reachable.
})();
```

The companion feature to `WeakRef`s is `FinalizationRegistry`, which lets programmers register callbacks to be invoked after an object is garbage collected. For example, the program below may log `42` to the console after the unreachable object in the IIFE is collected.

```js
const registry = new FinalizationRegistry((heldValue) => {
  console.log(heldValue);
});

(function () {
  const garbage = {};
  registry.register(garbage, 42);
  // The second argument is the “held” value which gets passed
  // to the finalizer when the first argument is garbage collected.
})();
```

Finalizers are scheduled to run on the event loop and never interrupt synchronous JavaScript execution.

These are advanced and powerful features, and with any luck, your program won’t need them. Please see our [explainer](https://v8.dev/features/weak-references) to learn more about them!

### Private methods and accessors

Private fields, which shipped in v7.4, are rounded out with support for private methods and accessors. Syntactically, the names of private methods and accessors start with `#`, just like private fields. The following is a brief taste of the syntax.

```js
class Component {
  #privateMethod() {
    console.log("I'm only callable inside Component!");
  }
  get #privateAccessor() { return 42; }
  set #privateAccessor(x) { }
}
```

Private methods and accessors have the same scoping rules and semantics as private fields. Please see our [explainer](https://v8.dev/features/class-fields) to learn more.

Thanks to [Igalia](https://twitter.com/igalia) for contributing the implementation!

## V8 API

Please use `git log branch-heads/8.3..branch-heads/8.4 include/v8.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 8.4 -t branch-heads/8.4` to experiment with the new features in V8 v8.4. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
