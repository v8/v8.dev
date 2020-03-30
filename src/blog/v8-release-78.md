---
title: 'V8 release v7.8'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), the lazy sourcerer'
avatars:
  - 'ingvar-stepanyan'
date: 2019-09-27
tags:
  - release
description: 'V8 v7.8 features streaming compilation on preload, WebAssembly C API, faster object destructuring and RegExp matching, and improved startup times.'
tweet: '1177600702861971459'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.8](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.8), which is in beta until its release in coordination with Chrome 78 Stable in several weeks. V8 v7.8 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript performance (size & speed) { #performance }

### Script streaming on preload

You might remember [our script streaming work from V8 v7.5](/blog/v8-release-75#script-streaming-directly-from-network), where we improved our background compilation to read data directly from the network. In Chrome 78, we are enabling script streaming during preload.

Previously, script streaming started when a `<script>` tag was encountered during HTML parsing, and the parsing would either pause until compilation finished (for normal scripts) or the script would execute once it finished compiling (for async scripts). This means that for normal, synchronous scripts like this:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="main.js"></script>
</head>
...
```

…the pipeline would previously look roughly like this:

<figure>
  <img src="/_img/v8-release-78/script-streaming-0.svg" width="458" height="130" alt="" loading="lazy">
</figure>

Since synchronous scripts can use `document.write()`, we have to pause parsing the HTML when we see the `<script>` tag. Since compilation starts when the `<script>` tag is encountered, there’s a big gap between parsing the HTML and actually running the script, during which we can’t continue loading the page.

However, we _also_ encounter the `<script>` tag in an earlier stage, where we scan the HTML looking for resources to preload, so the pipeline was really more like this:

<figure>
  <img src="/_img/v8-release-78/script-streaming-1.svg" width="600" height="130" alt="" loading="lazy">
</figure>

It’s a reasonably safe assumption that if we preload a JavaScript file, we’ll want to execute it eventually. So, since Chrome 76, we’ve been experimenting with preload streaming, where loading the script also starts compiling it.

<figure>
  <img src="/_img/v8-release-78/script-streaming-2.svg" width="495" height="130" alt="" loading="lazy">
</figure>

Even better, since we can start compiling before the script finishes loading, the pipeline with preload streaming actually looks more like this:

<figure>
  <img src="/_img/v8-release-78/script-streaming-3.svg" width="480" height="217" alt="" loading="lazy">
</figure>

This means that in some cases we can reduce perceptible compilation time (the gap between `<script>`-tag-seen and script-starting-to-execute) down to zero. In our experiments, this perceptible compilation time dropped, on average, by 5–20%.

The best news is that thanks to our experimentation infrastructure, we’ve been able to not only enable this by default in Chrome 78, but also turn it on it for users of Chrome 76 onwards.

### Faster object destructuring

Object destructuring of the form…

```js
const {x, y} = object;
```

…is almost equivalent to the desugared form...

```js
const x = object.x;
const y = object.y;
```

…except that it also needs to throw a special error for `object` being `undefined` or `null`...

```
$ v8 -e 'const object = undefined; const {x, y} = object;'
unnamed:1: TypeError: Cannot destructure property `x` of 'undefined' or 'null'.
const object = undefined; const {x, y} = object;
                                 ^
```

…rather than the normal error you’d get when trying to dereference undefined:

```
$ v8 -e 'const object = undefined; object.x'
unnamed:1: TypeError: Cannot read property 'x' of undefined
const object = undefined; object.x
                                 ^
```

This extra check made destructuring slower than simple variable assignment, as [reported to us via Twitter](https://twitter.com/mkubilayk/status/1166360933087752197).

As of V8 v7.8, object destructuring is **as fast** as the equivalent desugared variable assignment (in fact, we generate the same bytecode for both). Now, instead of explicit `undefined`/`null` checks, we rely on an exception being thrown when loading `object.x`, and we intercept the exception if it’s the result of destructuring.

### Lazy source positions

When compiling bytecode from JavaScript, source position tables are generated that tie bytecode sequences to character positions within the source code. However, this information is only used when symbolizing exceptions or performing developer tasks such as debugging and profiling and so this is largely wasted memory.

To avoid this, we now compile bytecode without collecting source positions (assuming no debugger or profiler is attached). The source positions are only collected when a stack trace is actually generated, for instance when calling `Error.stack` or printing an exception’s stack trace to the console. This does have some cost, as generating source positions requires the function to be reparsed and compiled, however most websites don’t symbolize stack traces in production and therefore don’t see any observable performance impact. In our lab testing we saw between 1-2.5% reductions in V8’s memory usage.

![Memory savings from lazy source positions on an AndroidGo device](/_img/v8-release-78/memory-savings.svg)

### Faster RegExp match failures

Generally, a RegExp attempts to find a match by iterating forward through the input string and checking for a match starting from each position. Once that position gets close enough to the end of the string that no match is possible, V8 now (in most cases) stops trying to find possible beginnings of new matches, and instead quickly returns a failure. This optimization applies to both compiled and interpreted regular expressions, and yields a speedup on workloads where failure to find a match is common, and the minimum length of any successful match is relatively large compared to the average input string length.

On the UniPoker test in JetStream 2, which inspired this work, V8 v7.8 brings a 20% improvement to the average-of-all-iterations subscore.

## WebAssembly

### WebAssembly C/C++ API

As of v7.8, V8’s implementation of the [Wasm C/C++ API](https://github.com/WebAssembly/wasm-c-api) graduates from experimental status to being officially supported. It allows you to use a special build of V8 as a WebAssembly execution engine in your C/C++ applications. No JavaScript involved! For more details and instructions, see [the documentation](https://docs.google.com/document/d/1oFPHyNb_eXg6NzrE6xJDNPdJrHMZvx0LqsD6wpbd9vY/edit).

### Improved startup time

Calling a JavaScript function from WebAssembly or a WebAssembly function from JavaScript involves executing some wrapper code, responsible for translating the function's arguments from one representation to the other.  Generating these wrappers can be quite expensive: in the [Epic ZenGarden demo](https://s3.amazonaws.com/mozilla-games/ZenGarden/EpicZenGarden.html), compiling wrappers takes about 20% of the module startup time (compilation + instantiation) on an 18-core Xeon machine.

For this release, we improved the situation by making better use of background threads on multi-core machines. We relied on recent efforts to [scale function compilation](/blog/v8-release-77#wasm-compilation), and integrated wrapper compilation into this new asynchronous pipeline. Wrapper compilation now accounts for about 8% of the Epic ZenGarden demo startup time on the same machine.

## V8 API

Please use `git log branch-heads/7.7..branch-heads/7.8 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.8 -t branch-heads/7.8` to experiment with the new features in V8 v7.8. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
