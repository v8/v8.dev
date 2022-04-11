---
title: 'V8 release v9.5'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
 - 'ingvar-stepanyan'
date: 2021-09-21
tags:
 - release
description: 'V8 release v9.5 brings updated internationalization APIs and WebAssembly exception handling support.'
tweet: '1440296019623759872'
---
Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.5](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.5), which is in beta until its release in coordination with Chrome 95 Stable in several weeks. V8 v9.5 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### `Intl.DisplayNames` v2

In v8.1 we launched the [`Intl.DisplayNames` API](https://v8.dev/features/intl-displaynames) API in Chrome 81, with supported types “language”, “region”, “script”, and “currency”. With v9.5, we now have added two new supported types: “calendar” and “dateTimeField”. They return the display names of different calendar types and date time fields correspondingly:

```js
const esCalendarNames = new Intl.DisplayNames(['es'], { type: 'calendar' });
const frDateTimeFieldNames = new Intl.DisplayNames(['fr'], { type: 'dateTimeField' });
esCalendarNames.of('roc');  // "calendario de la República de China"
frDateTimeFieldNames.of('month'); // "mois"
```

We also enhanced the support for the “language” type with a new languageDisplay option, which could be either “standard” or “dialect” (as the default value if not specified):

```js
const jaDialectLanguageNames = new Intl.DisplayNames(['ja'], { type: 'language' });
const jaStandardLanguageNames = new Intl.DisplayNames(['ja'], { type: 'language' , languageDisplay: 'standard'});
jaDialectLanguageNames.of('en-US')  // "アメリカ英語"
jaDialectLanguageNames.of('en-AU')  // "オーストラリア英語"
jaDialectLanguageNames.of('en-GB')  // "イギリス英語"

jaStandardLanguageNames.of('en-US') // "英語 (アメリカ合衆国)"
jaStandardLanguageNames.of('en-AU') // "英語 (オーストラリア)"
jaStandardLanguageNames.of('en-GB') // "英語 (イギリス)"
```

### Extended `timeZoneName` option

`Intl.DateTimeFormat API` in v9.5 now supports four new values for the `timeZoneName` option:

- “shortGeneric” to output the name of the time zone as in a short generic non-location format, such as “PT”, “ET”,  without indicating whether it is under daylight saving time.
- “longGeneric” to output the name of the time zone as in a short generic non-location format, such as “Pacific Time”, “Mountain Time”, without indicating whether it is under daylight saving time.
- “shortOffset” to output the name of the time zone as in the short localized GMT format, such as “GMT-8”.
- “longOffset” to output the name of the time zone as in the long localized GMT format, such as “GMT-0800”.

## WebAssembly

### Exception Handling

V8 now supports the [WebAssembly Exception Handling (Wasm EH) proposal](https://github.com/WebAssembly/exception-handling/blob/master/proposals/exception-handling/Exceptions.md) so that modules compiled with a compatible toolchain (e.g. [Emscripten](https://emscripten.org/docs/porting/exceptions.html)) can be executed in V8. The proposal is designed to keep the overhead low compared to the previous workarounds using JavaScript.

For example, we compiled the [Binaryen](https://github.com/WebAssembly/binaryen/) optimizer to WebAssembly with old and new exception handling implementations.

When exception handling is enabled, the code size increase [goes down from about 43% for the old JavaScript-based exception handling to only 9% for the new Wasm EH feature](https://github.com/WebAssembly/exception-handling/issues/20#issuecomment-919716209).

When we ran `wasm-opt.wasm -O3` on a few big test files, Wasm EH's version showed no performance loss compared to the baseline without exceptions, while JavaScript-based EH version took around 30% longer.

However, Binaryen uses exception checking sparsely. In exception-heavy workloads the performance difference is expected to be even larger.

## V8 API

The main v8.h header file has been split into several parts which can be included separately. For instance `v8-isolate.h` now contains the `v8::Isolate class`. Many header files that declare methods passing `v8::Local<T>` can now import `v8-forward.h` to get the definition of `v8::Local` and all v8 heap object types.

Please use `git log branch-heads/9.4..branch-heads/9.5 include/v8\*.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.5 -t branch-heads/9.5` to experiment with the new features in V8 v9.5. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
