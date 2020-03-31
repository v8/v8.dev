---
title: 'V8 release v7.1'
author: 'Stephan Herhut ([@herhut](https://twitter.com/herhut)), cloned cloner of clones'
avatars:
  - stephan-herhut
date: 2018-10-31 15:44:37
tags:
  - release
description: 'V8 v7.1 features embedded bytecode handlers, improved TurboFan escape analysis, postMessage(wasmModule), Intl.RelativeTimeFormat, and globalThis!'
tweet: '1057645773465235458'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.1](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.1), which is in beta until its release in coordination with Chrome 71 Stable in several weeks. V8 v7.1 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Memory

Following the work in v6.9/v7.0 to [embed builtins directly into the binary](/blog/embedded-builtins), bytecode handlers for the interpreter are now also [embedded into the binary](https://bugs.chromium.org/p/v8/issues/detail?id=8068). This saves around 200 KB on average per Isolate.

## Performance

The escape analysis in TurboFan, which performs scalar replacement for objects that are local to an optimization unit, was improved to also [handle local function contexts for higher-order functions](https://bit.ly/v8-turbofan-context-sensitive-js-operators) when variables from the surrounding context escape to a local closure. Consider the following example:

```js
function mapAdd(a, x) {
  return a.map(y => y + x);
}
```

Note that `x` is a free variable of the local closure `y => y + x`. V8 v7.1 can now fully elide the context allocation of `x`, yielding an improvement of up to **40%** in some cases.

![Performance improvement with new escape analysis (lower is better)](/_img/v8-release-71/improved-escape-analysis.svg)

The escape analysis is now also able to eliminate some cases of variable index access to local arrays. Here’s an example:

```js
function sum(...args) {
  let total = 0;
  for (let i = 0; i < args.length; ++i)
    total += args[i];
  return total;
}

function sum2(x, y) {
  return sum(x, y);
}
```

Note that the `args` are local to `sum2` (assuming that `sum` is inlined into `sum2`). in V8 v7.1, TurboFan can now eliminate the allocation of `args` completely and replace the variable index access `args[i]` with a ternary operation of the form `i === 0 ? x : y`. This yields a ~2% improvement on the JetStream/EarleyBoyer benchmark. We might extend this optimization for arrays with more than two elements in the future.

## Structured cloning of Wasm modules

Finally, [`postMessage` is supported for Wasm modules](https://github.com/WebAssembly/design/pull/1074). `WebAssembly.Module` objects can now be `postMessage`'d to web workers. To clarify, this is scoped to just web workers (same process, different thread), and not extended to cross-process scenarios (such as cross-origin `postMessage` or shared web workers).

## JavaScript language features

[The `Intl.RelativeTimeFormat` API](/features/intl-relativetimeformat) enables localized formatting of relative times (e.g. “yesterday”, “42 seconds ago”, or “in 3 months”) without sacrificing performance. Here's an example:

```js
// Create a relative time formatter for the English language that does
// not always have to use numeric value in the output.
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

rtf.format(-1, 'day');
// → 'yesterday'

rtf.format(0, 'day');
// → 'today'

rtf.format(1, 'day');
// → 'tomorrow'

rtf.format(-1, 'week');
// → 'last week'

rtf.format(0, 'week');
// → 'this week'

rtf.format(1, 'week');
// → 'next week'
```

Read [our `Intl.RelativeTimeFormat` explainer](/features/intl-relativetimeformat) for more information.

V8 v7.1 also adds support for [the `globalThis` proposal](/features/globalthis), enabling a universal mechanism to access the global object even in strict functions or modules regardless of the platform.

## V8 API

Please use `git log branch-heads/7.0..branch-heads/7.1 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.1 -t branch-heads/7.1` to experiment with the new features in V8 v7.1. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
