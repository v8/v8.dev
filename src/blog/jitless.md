---
title: 'JIT-less V8'
author: 'Jakob Gruber ([@schuay](https://twitter.com/schuay))'
avatars:
  - 'jakob-gruber'
date: 2019-03-13 13:03:19
tags:
  - internals
tweet: '1105777150051999744'
---
V8 v7.4 now supports JavaScript execution without allocating executable memory at runtime.

In its default configuration, V8 relies heavily on the ability to allocate and modify executable memory at runtime. For example, the [TurboFan optimizing compiler](/blog/turbofan-jit) creates native code for hot JavaScript (JS) functions just-in-time, and most JS regular expressions are compiled down to native code by the [irregexp engine](https://blog.chromium.org/2009/02/irregexp-google-chromes-new-regexp.html). Creating executable memory at runtime is part of what makes V8 fast.

But in some situations it can be desirable to run V8 without allocating executable memory:

1. Some platforms (e.g. iOS, smart TVs, game consoles) prohibit write access to executable memory for non-privileged applications, and it has thus been impossible to use V8 there so far; and
1. disallowing writes to executable memory reduces the attack surface of the application for exploits.

V8’s new JIT-less mode is intended to address these points. When V8 is started with the `--jitless` flag, V8 runs without any runtime allocation of executable memory.

How does it work? Essentially, V8 switches into an interpreter-only mode based on our existing technology: all JS user code runs through the [Ignition interpreter](/blog/ignition-interpreter), and regular expression pattern matching is likewise interpreted. WebAssembly is currently unsupported, but interpretation is also in the realm of possibility. V8’s builtins are still compiled to native code, but are no longer part of the managed JS heap, thanks to our recent efforts to [embed them into the V8 binary](/blog/embedded-builtins).

Ultimately, these changes allowed us to create V8’s heap without requiring executable permissions for any of its memory regions.

## Results

Since JIT-less mode disables the optimizing compiler, it comes with a performance penalty. We looked at a variety of benchmarks to better understand how V8’s performance characteristics change. [Speedometer 2.0](/blog/speedometer-2) is intended to represent a typical web application; the [Web Tooling Benchmark](/blog/web-tooling-benchmark) includes a set of common JS developer tools; and we also include a benchmark that simulates a [browsing workflow on the Living Room YouTube app](https://chromeperf.appspot.com/report?sid=518c637ffa0961f965afe51d06979375467b12b87e72061598763e5a36876306). All measurements were made locally on an x64 Linux desktop over 5 runs.

<figure>
  <img src="/_img/jitless/benchmarks.svg" intrinsicsize="626x387" alt="">
  <figcaption>JIT-less vs. default V8. Scores are normalized to 100 for V8’s default configuration.</figcaption>
</figure>

Speedometer 2.0 is around 40% slower in JIT-less mode. Roughly half of the regression can be attributed to the disabled optimizing compiler. The other half is caused by the regular expression interpreter, which was originally intended as a debugging aid, and will see performance improvements in the future.

The Web Tooling Benchmark tends to spend more time in TurboFan-optimized code and thus shows a larger regression of 80% when JIT-less mode is enabled.

Finally, we measured a simulated browsing session on the Living Room YouTube app which includes both video playback and menu navigation. Here, JIT-less mode is roughly on-par and only shows a 6% slowdown in JS execution compared to a standard V8 configuration. This benchmark demonstrates how peak optimized code performance is not always correlated to [real-world performance](/blog/real-world-performance), and in many situations embedders can maintain reasonable performance even in JIT-less mode.

Memory consumption only changed slightly, with a median of 1.7% decrease of V8’s heap size for loading a representative set of websites.

We encourage embedders on restricted platforms or with special security requirements to consider V8’s new JIT-less mode, available now in V8 v7.4. As always, questions and feedback are welcome at the [v8-users](https://groups.google.com/forum/#!forum/v8-users) discussion group.
