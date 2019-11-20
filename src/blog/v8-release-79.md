---
title: 'V8 release v7.9'
author: 'Santiago Aboy Solanes, pointer compressor extraordinaire'
avatars:
  - 'santiago-aboy-solanes'
date: 2019-11-20
tags:
  - release
description: 'V8 v7.9 features removed deprecation for Double ⇒ Tagged transitions, handling API getters in builtins, OSR caching, and WASM support for multiple code spaces.'
tweet: 'TODO'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 7.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/7.9), which is in beta until its release in coordination with Chrome 79 Stable in several weeks. V8 v7.9 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## Performance (size & speed) { #performance }

### Removed deprecation for Double ⇒ Tagged transitions

You might remember from previous blog posts that V8 tracks how fields are represented in objects’ shapes. When the representation of a field changes, the current object’s shape has to be “deprecated”, and a new shape is created with the new field representation.

One exception to this is when old field values are guaranteed to be compatible with the new representation. In those cases we can simply swap in the new representation in-place on the object shape, and it will still work for the old objects’ field values. In V8 v7.6 we enabled these in-place representation changes for Smi ⇒ Tagged and HeapObject ⇒ Tagged transitions, but we couldn’t avoid Double ⇒ Tagged because of our MutableHeapNumber optimisation.

In V8 v7.9, we got rid of MutableHeapNumber, and instead use HeapNumbers that are implicitly mutable when they belong to a Double representation field. This means we have to be a little more careful about dealing with HeapNumbers (which now are mutable if they are on a double field and immutable otherwise), but HeapNumbers are compatible with the Tagged representation, and therefore we can avoid deprecation in the Double ⇒ Tagged case as well.

This relatively simple change improved the Speedometer AngularJS score by 4%.

<figure>
  <img src="/_img/v8-release-79/Speedometer-AngularJS.svg" width="701" height="380" alt="" loading="lazy">
  <figcaption>Speedometer AngularJS score improvements</figcaption>
</figure>

### Handle API getters in builtins

Previously, V8 would always miss to the C++ runtime when handling getters defined by the embedding API (such as Blink). These included getters defined in the HTML spec such as `Node.nodeType`, `Node.nodeName`, etc.

V8 would do the entire prototype walk in the builtin to load the getter and then bail out to the runtime once it realizes that the getter is defined by the API. In the C++ runtime, it would walk the prototype chain to get the getter again before executing it, duplicating a lot of work.

In general, the [inline caching (IC)](https://mathiasbynens.be/notes/shapes-ics) mechanism can help mitigate this as V8 would install an IC handler after the first miss to the C++ runtime. But with the new [lazy feedback allocation](https://v8.dev/blog/v8-release-77#lazy-feedback-allocation), V8 doesn’t install IC handlers until the function has been executed for some time.

Now in V8 v7.9, these getters are handled in the builtins without having to miss to the C++ runtime even when they don’t have IC handlers installed, by taking advantage of special API stubs that can call directly into the API getter. This results in a 12% decrease in the amount of time spent in IC runtime in Speedometer’s Backbone and jQuery benchmark.

<figure>
  <img src="/_img/v8-release-79/Speedometer.svg" width="600" height="371" alt="" loading="lazy">
  <figcaption>Speedometer Backbone and jQuery improvements</figcaption>
</figure>

### OSR caching

When V8 identifies that certain functions are hot it marks them for optimization on the next call. When the function executes again, V8 compiles the function using the optimizing compiler and starts using the optimized code from the subsequent call. However, for functions with long running loops this is not sufficient. V8 uses a technique called on-stack replacement (OSR) to install optimized code for the currently executing function. This allows us to start using the optimized code during the first execution of the function, while it is stuck in a hot loop.

If the function is executed a second time, it is very likely to be OSRed again. Before V8 v7.9 we needed to re-optimize the function again in order to OSR it, however from v7.9 we added OSR caching to retain optimized code for OSR replacements, keyed by the loop header that was used as the entry point in the OSRed function. This has improved performance of some peak-performance benchmarks by 5–18%.

<figure>
  <img src="/_img/v8-release-79/OSR-caching.svg" width="769" height="476" alt="" loading="lazy">
  <figcaption>OSR caching improvements</figcaption>
</figure>

## WebAssembly

### Support for multiple code spaces

So far, each WebAssembly module consisted of exactly one code space on 64-bit architectures, which was reserved on module creation. This allowed us to use near calls within a module, but limited us to 128 MB of code space on arm64, and required to reserved 1 GB upfront on x64.

In v7.9, V8 got support for multiple code spaces on 64-bit architectures. This allows us to only reserve the estimated needed code space, and add more code spaces later if needed. Far jump will be used for calls between code spaces that are too far apart for near jumps. Instead of ~1000 WebAssembly modules per process V8 now support several million, only limited by the actual amount of memory available.

## V8 API

Please use `git log branch-heads/7.8..branch-heads/7.9 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 7.9 -t branch-heads/7.9` to experiment with the new features in V8 v7.9. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
