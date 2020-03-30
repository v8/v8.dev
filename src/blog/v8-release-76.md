---
title: 'V8 release v7.6'
author: 'Adam Klein'
avatars:
  - 'adam-klein'
date: 2019-06-19 16:45:00
tags:
  - release
description: 'V8 v7.6 features Promise.allSettled, faster JSON.parse, localized BigInts, speedier frozen/sealed arrays, and much more!'
tweet: '1141356209179516930'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.6](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.6), which is in beta until its release in coordination with Chrome 76 Stable in several weeks. V8 v7.6 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Performance (size & speed) { #performance }

### `JSON.parse` improvements

In modern JavaScript applications, JSON is commonly used as a format to communicate structured data. By speeding up JSON parsing, we can reduce the latency of this communication. In V8 v7.6, we’ve overhauled our JSON parser to be much faster at scanning and parsing JSON. This results in up to 2.7× faster parsing of data served by popular web pages.

![Chart showing improved performance of `JSON.parse` on a variety of websites](/_img/v8-release-76/json-parsing.svg)

Up to V8 v7.5, the JSON parser was a recursive parser that would use native stack space relative to the nesting depth of the incoming JSON data. This meant we could run out of stack for very deeply nested JSON data. V8 v7.6 switches to an iterative parser that manages its own stack, which is limited only by available memory.

The new JSON parser is also more memory-efficient. By buffering properties before we create the final object we can now decide how to allocate the result in an optimal way. For objects with named properties we allocate objects with the exact amount of space needed for the named properties in the incoming JSON data (up to 128 named properties). In case JSON objects contain indexed property names, we allocate an elements backing store that uses the minimal amount of space; either a flat array or a dictionary. JSON arrays are now parsed to an array that exactly fits the number of elements in the input data.

### Frozen/sealed array improvements

Performance of calls on frozen or sealed arrays (and array-like objects) received numerous improvements. V8 v7.6 boosts the following JavaScript coding patterns, where `frozen` is a frozen or sealed array or array-like object:

- `frozen.indexOf(v)`
- `frozen.includes(v)`
- spread calls such as `fn(...frozen)`
- spread calls with a nested array spread such as `fn(...[...frozen])`
- apply calls with array spread such as `fn.apply(this, [...frozen])`

The chart below shows the improvements.

![Chart showing performance boost on a variety of array operations](/_img/v8-release-76/frozen-sealed-elements.svg)

[See the “fast frozen & sealed elements in V8” design doc](https://bit.ly/fast-frozen-sealed-elements-in-v8) for more details.

### Unicode string handling

An optimization when [converting strings to Unicode](https://chromium.googlesource.com/v8/v8/+/734c1456d942a03d79aab4b3b0e57afbc803ceea) resulted in a significant speed-up for calls such as `String#localeCompare`, `String#normalize`, and some of the `Intl` APIs. For example, this change resulted in around 2× the raw throughput of `String#localeCompare` for one-byte strings.

## JavaScript language features

### `Promise.allSettled`

[`Promise.allSettled(promises)`](/features/promise-combinators#promise.allsettled) provides a signal when all the input promises are _settled_, which means they’re either _fulfilled_ or _rejected_. This is useful in cases where you don’t care about the state of the promise, you just want to know when the work is done, regardless of whether it was successful. [Our explainer on promise combinators](/features/promise-combinators) has more details and includes an example.

### Improved `BigInt` support { #localized-bigint }

[`BigInt`](/features/bigint) now has better API support in the language. You can now format a `BigInt` in a locale-aware manner by using the `toLocaleString` method. This works just like it does for regular numbers:

```js
12345678901234567890n.toLocaleString('en'); // 🐌
// → '12,345,678,901,234,567,890'
12345678901234567890n.toLocaleString('de'); // 🐌
// → '12.345.678.901.234.567.890'
```

If you plan on formatting multiple numbers or `BigInt`s using the same locale, it’s more efficient to use the `Intl.NumberFormat` API, which now supports `BigInt`s in its `format` and `formatToParts` methods. This way, you can create a single re-usable formatter instance.

```js
const nf = new Intl.NumberFormat('fr');
nf.format(12345678901234567890n); // 🚀
// → '12 345 678 901 234 567 890'
nf.formatToParts(123456n); // 🚀
// → [
// →   { type: 'integer', value: '123' },
// →   { type: 'group', value: ' ' },
// →   { type: 'integer', value: '456' }
// → ]
```

### `Intl.DateTimeFormat` improvements { #intl-datetimeformat }

Apps commonly display date intervals or date ranges to show the span of an event, such as a hotel reservation, the billing period of a service, or a music festival. The `Intl.DateTimeFormat` API now supports `formatRange` and `formatRangeToParts` methods to conveniently format date ranges in a locale-specific manner.

```js
const start = new Date('2019-05-07T09:20:00');
// → 'May 7, 2019'
const end = new Date('2019-05-09T16:00:00');
// → 'May 9, 2019'
const fmt = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const output = fmt.formatRange(start, end);
// → 'May 7 – 9, 2019'
const parts = fmt.formatRangeToParts(start, end);
// → [
// →   { 'type': 'month',   'value': 'May',  'source': 'shared' },
// →   { 'type': 'literal', 'value': ' ',    'source': 'shared' },
// →   { 'type': 'day',     'value': '7',    'source': 'startRange' },
// →   { 'type': 'literal', 'value': ' – ',  'source': 'shared' },
// →   { 'type': 'day',     'value': '9',    'source': 'endRange' },
// →   { 'type': 'literal', 'value': ', ',   'source': 'shared' },
// →   { 'type': 'year',    'value': '2019', 'source': 'shared' },
// → ]
```

Additionally, the `format`, `formatToParts`, and `formatRangeToParts` methods now support the new `timeStyle` and `dateStyle` options:

```js
const dtf = new Intl.DateTimeFormat('de', {
  timeStyle: 'medium',
  dateStyle: 'short'
});
dtf.format(Date.now());
// → '19.06.19, 13:33:37'
```

## Native stack walking

While V8 can walk its own call stack (e.g. when debugging or profiling in the DevTools), the Windows operating system was unable to walk a call stack that contains code generated by TurboFan when running on the x64 architecture. This could cause _broken stacks_ when using native debuggers or ETW sampling to analyze processes that use V8. A recent change enables V8 to [register the necessary metadata](https://chromium.googlesource.com/v8/v8/+/3cda21de77d098a612eadf44d504b188a599c5f0) for Windows to be able to walk these stacks on x64, and in v7.6 this is enabled by default.

## V8 API

Please use `git log branch-heads/7.5..branch-heads/7.6 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.6 -t branch-heads/7.6` to experiment with the new features in V8 v7.6. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
