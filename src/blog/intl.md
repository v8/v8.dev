---
title: 'Faster and more feature-rich internationalization APIs'
author: '[சத்யா குணசேகரன் (Sathya Gunasekaran)](https://twitter.com/_gsathya)'
date: 2019-04-25 16:45:37
avatars:
  - 'sathya-gunasekaran'
tags:
  - ECMAScript
  - Intl
---
The ECMAScript Internationalization API Specification (ECMA-402, or `Intl`) provides key locale-specific functionality such as date formatting, number formatting, plural form selection, and collation. The Chrome V8 and Google Internationalization teams have been collaborating on adding features to V8’s ECMA-402 implementation, while cleaning up technical debt and improving performance and interoperability with other browsers.

## Underlying architectural improvements

Initially the ECMA-402 spec was implemented mostly in JavaScript using V8-extensions and lived outside the V8 codebase. Using the external Extension API meant that several of V8’s internally used APIs for type checking, lifetime management of external C++ objects and internal private data storage couldn’t be used. As part of improving startup performance, this implementation was later moved in to the V8 codebase to enable [snapshotting](/blog/custom-startup-snapshots) of these builtins.

V8 uses specialized `JSObject`s with custom [shapes (hidden classes)](https://mathiasbynens.be/notes/shapes-ics) to describe built-in JavaScript objects specified by ECMAScript (like `Promise`s, `Map`s, `Set`s, etc). With this approach, V8 can pre-allocate the required number of internal slots and generate fast accesses to these, rather than grow the object one property at a time leading to slower performance and worse memory usage.

The `Intl` implementation was not modeled after such an architecture, as a consequence of the historic split. Instead, all the built-in JavaScript objects as specified by the Internationalization spec (like `NumberFormat`, `DateTimeFormat`) were generic `JSObject`s that had to transition through several property additions for their internal slots.

Another artifact of not having a specialized `JSObject`s was that type checking was now more complex. The type information was stored under a private symbol and type-checked on both the JS and C++ side using expensive property access, rather than just looking up its shape.

### Modernizing the codebase

With the current move away from writing self-hosted builtins in V8, it made sense to use this opportunity to modernize the ECMA402 implementation.

### Moving away from self-hosted JS

Although self-hosting lends itself to concise and readable code, the frequent usage of slow runtime calls to access ICU APIs led to performance issues. As a result, a lot of ICU functionality was duplicated in JavaScript to reduce the number of such runtime calls.

By rewriting the builtins in C++, it became much faster to access the ICU APIs as there is no runtime call overhead now.

### Improving ICU

ICU is a set of C/C++ libraries used by a large set of applications, including all the major JavaScript engines, for providing Unicode and globalization support. As part of switching `Intl` to ICU in V8’s implementation, we [found](https://unicode-org.atlassian.net/browse/ICU-20140) [and](https://unicode-org.atlassian.net/browse/ICU-9562) [fixed](https://unicode-org.atlassian.net/browse/ICU-20098) several ICU bugs.

As part of implementing new proposals such as [`Intl.RelativeTimeFormat`](https://developers.google.com/web/updates/2018/10/intl-relativetimeformat), [`Intl.ListFormat`](https://developers.google.com/web/updates/2018/12/intl-listformat) and `Intl.Locale`, we’ve extended ICU by adding [several](https://unicode-org.atlassian.net/browse/ICU-13256) [new](https://unicode-org.atlassian.net/browse/ICU-20121) [APIs](https://unicode-org.atlassian.net/browse/ICU-20342) to support these new ECMAScript proposals.

All of these additions help other JavaScript engines implement these proposals quicker now, pushing the web forward! For example, development is in progress in Firefox on implementing several new `Intl` APIs based on our ICU work.

## Performance

As a result of this work, we improved the performance of the Internationalization API by optimizing several fast paths and caching the initialization of the various `Intl` objects and the `toLocaleString` methods on `Number.prototype`, `Date.prototype`, and `String.prototype`.

For example, creating a new `Intl.NumberFormat` object became around 24× faster.

<figure>
  <img src="/_img/intl/performance.svg" intrinsicsize="713x371" alt="">
  <figcaption><a href=https://cs.chromium.org/chromium/src/v8/test/js-perf-test/Intl/constructor.js>Microbenchmarks</a> testing the performance of creating various <code>Intl</code> objects</figcaption>
</figure>

Note that for better performance, it’s recommended to explicitly create *and reuse* an `Intl.NumberFormat` or `Intl.DateTimeFormat` or `Intl.Collator` object, rather than calling methods like `toLocaleString` or `localeCompare`.

## New `Intl` features

All of this work has provided a great foundation to build new features on and we’re continuing to ship all the new Internationalization proposals that are in Stage 3.

[`Intl.RelativeTimeFormat`](https://developers.google.com/web/updates/2018/10/intl-relativetimeformat) has shipped in Chrome 71, [`Intl.ListFormat`](https://developers.google.com/web/updates/2018/12/intl-listformat) has shipped in Chrome 72, [`Intl.Locale`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Locale) has shipped in Chrome 74, and [`dateStyle` and `timeStyle` options for `Intl.DateTimeFormat`](https://github.com/tc39/proposal-intl-datetime-style) and [BigInt support for `Intl.DateTimeFormat`](https://github.com/tc39/ecma402/pull/236) are shipping in Chrome 76. [`Intl.DateTimeFormat#formatRange`](https://github.com/tc39/proposal-intl-DateTimeFormat-formatRange), [`Intl.Segmenter`](https://github.com/tc39/proposal-intl-segmenter/), and [additional options for `Intl.NumberFormat`](https://github.com/tc39/proposal-unified-intl-numberformat/) are currently under development in V8, and we hope to ship them soon!

Many of these new APIs, and others further down the pipeline, are due to our work on standardizing new features to help developers with internationalization. [`Intl.DisplayNames`](https://github.com/tc39/proposal-intl-displaynames) is a Stage 1 proposal that allows users to localize the display names of language, region or script display names. [`Intl.DateTimeFormat#formatRange`](https://github.com/fabalbon/proposal-intl-DateTimeFormat-formatRange) is a Stage 3 proposal that specifies a way to format date ranges in a concise and locale-aware manner. [The unified `Intl.NumberFormat` API proposal](https://github.com/tc39/proposal-unified-intl-numberformat) is a Stage 3 proposal that improves `Intl.NumberFormat` by adding support for measurement units, currency and sign display policies, and scientific and compact notation. You can get involved in the future of ECMA-402 as well, by contributing at [its GitHub repository](https://github.com/tc39/ecma402).

## Conclusion

`Intl` provides a feature-rich API for several operations needed in internationalizing your web app, leaving the heavy lifting to the browser, without shipping as much data or code over the wire. Thinking through the proper use of these APIs can lead your UI to work better in different locales. Due to the work by the Google V8 and i18n teams in collaboration with TC39 and its ECMA-402 subgroup, you can now access more functionality with better performance, and expect further improvements over time.
