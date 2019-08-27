---
title: 'V8 release v6.2'
author: 'the V8 team'
date: 2017-09-11 13:33:37
tags:
  - release
description: 'V8 v6.2 includes performance improvements, more JavaScript language features, an increased max string length, and more.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.2](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.2), which is in beta until its release in coordination with Chrome 62 Stable in several weeks. V8 v6.2 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Performance improvements

The performance of [`Object#toString`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString) was previously already identified as a potential bottleneck, since it’s often used by popular libraries like [lodash](https://lodash.com/) and [underscore.js](http://underscorejs.org/), and frameworks like [AngularJS](https://angularjs.org/). Various helper functions like [`_.isPlainObject`](https://github.com/lodash/lodash/blob/6cb3460fcefe66cb96e55b82c6febd2153c992cc/isPlainObject.js#L13-L50), [`_.isDate`](https://github.com/lodash/lodash/blob/6cb3460fcefe66cb96e55b82c6febd2153c992cc/isDate.js#L8-L25), [`angular.isArrayBuffer`](https://github.com/angular/angular.js/blob/464dde8bd12d9be8503678ac5752945661e006a5/src/Angular.js#L739-L741) or [`angular.isRegExp`](https://github.com/angular/angular.js/blob/464dde8bd12d9be8503678ac5752945661e006a5/src/Angular.js#L680-L689) are often used throughout application and library code to perform runtime type checks.

With the advent of ES2015, `Object#toString` became monkey-patchable via the new [`Symbol.toStringTag`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag) symbol, which also made `Object#toString` more heavy-weight and more challenging to speed up. In this release we ported an optimization initially implemented in the [SpiderMonkey JavaScript engine](https://bugzilla.mozilla.org/show_bug.cgi?id=1369042#c0) to V8, speeding up throughput of `Object#toString` by a factor of **6.5×**.

<figure>
  <img src="/_img/v8-release-62/perf.svg" width="681" height="421" alt="" loading="lazy">
</figure>

It also impacts the Speedometer browser benchmark, specifically the AngularJS subtest, where we measured a solid 3% improvement. Read the [detailed blog post](https://ponyfoo.com/articles/investigating-performance-object-prototype-to-string-es2015) for additional information.

<figure>
  <img src="/_img/v8-release-62/speedometer.svg" width="733" height="453" alt="" loading="lazy">
</figure>

We’ve also significantly improved the performance of [ES2015 proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), speeding up calling a proxy object via `someProxy(params)` or `new SomeOtherProxy(params)` by up to **5×**:

<figure>
  <img src="/_img/v8-release-62/proxy-call-construct.svg" width="600" height="371" alt="" loading="lazy">
</figure>

And similarly, the performance of accessing a property on a proxy object via `someProxy.property` improved by almost **6.5×**:

<figure>
  <img src="/_img/v8-release-62/proxy-property.svg" width="600" height="371" alt="" loading="lazy">
</figure>

This is part of an ongoing internship. Stay tuned for a more detailed blog post and final results.

We’re also excited to announce that thanks to [contributions](https://chromium-review.googlesource.com/c/v8/v8/+/620150) from [Peter Wong](https://twitter.com/peterwmwong), the performance of the [`String#includes`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes) built-in improved by more than **3×** since the previous release.

Hashcode lookups for internal hash tables got much faster, resulting in improved performance for `Map`, `Set`, `WeakMap`, and `WeakSet`. An upcoming blog post will explain this optimization in detail.

<figure>
  <img src="/_img/v8-release-62/hashcode-lookups.png" width="1600" height="309" alt="" loading="lazy">
</figure>

The garbage collector now uses a [Parallel Scavenger](https://bugs.chromium.org/p/chromium/issues/detail?id=738865) for collecting the so-called young generation of the heap.

## Enhanced low-memory mode

Over the last few releases V8’s low-memory mode was enhanced (e.g. by [setting initial semi-space size to 512 KB](https://chromium-review.googlesource.com/c/v8/v8/+/594387)). Low-memory devices now hit fewer out-of-memory situations. This low-memory behavior might have a negative impact on runtime performance though.

## More regular expressions features

Support for [the `dotAll` mode](https://github.com/tc39/proposal-regexp-dotall-flag) for regular expressions, enabled through the `s` flag, is now enabled by default. In `dotAll` mode, the `.` atom in regular expressions matches any character, including line terminators.

```js
/foo.bar/su.test('foo\nbar'); // true
```

[Lookbehind assertions](https://github.com/tc39/proposal-regexp-lookbehind), another new regular expression feature, are now available by default. The name already describes its meaning pretty well. Lookbehind assertions offer a way to restrict a pattern to only match if preceded by the pattern in the lookbehind group. It comes in both matching and non-matching flavors:

```js
/(?<=\$)\d+/.exec('$1 is worth about ¥123'); // ['1']
/(?<!\$)\d+/.exec('$1 is worth about ¥123'); // ['123']
```

More details about these features are available in our blog post titled [Upcoming regular expression features](https://developers.google.com/web/updates/2017/07/upcoming-regexp-features).

## Template literal revision

The restriction on escape sequences in template literals has been loosened [per the relevant proposal](https://tc39.es/proposal-template-literal-revision/). This enables new use cases for template tags, such as writing a LaTeX processor.

```js
const latex = (strings) => {
  // …
};

const document = latex`
\newcommand{\fun}{\textbf{Fun!}}
\newcommand{\unicode}{\textbf{Unicode!}}
\newcommand{\xerxes}{\textbf{King!}}
Breve over the h goes \u{h}ere // Illegal token!
`;
```

## Increased max string length

The maximum string length on 64-bit platforms increased from `2**28 - 16` to `2**30 - 25` characters.

## Full-codegen is gone

In V8 v6.2, the final major pieces of the old pipeline are gone. More than 30K lines of code were deleted in this release — a clear win for reducing code complexity.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.2 -t branch-heads/6.2` to experiment with the new features in V8 v6.2. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
