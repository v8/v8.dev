---
title: 'V8 is Faster and Safer than Ever!'
author: '[Victor Gomes](https://twitter.com/VictorBFG), the Glühwein expert'
avatars:
  - victor-gomes
date: 2023-12-14
tags:
  - JavaScript
  - WebAssembly
  - security
  - benchmarks
description: "V8's impressive accomplishments in 2023"
tweet: ''
---

Welcome to the thrilling world of V8, where speed is not just a feature but a way of life. As we bid farewell to 2023, it's time to celebrate the impressive accomplishments V8 has achieved this year.

Through innovative performance optimizations, V8 continues to push the boundaries of what's possible in the ever-evolving landscape of the Web. We introduced a new mid-tier compiler and implemented several improvements to the top-tier compiler infrastructure, the runtime and the garbage collector, which have resulted in significant speed gains across the board.

In addition to performance improvements, we landed exciting new features for both Javascript and WebAssembly. We also shipped a new approach to bringing garbage-collected programming languages efficiently to the Web with [WebAssembly Garbage Collection (WasmGC)](https://v8.dev/blog/wasm-gc-porting).

But our commitment to excellence doesn't stop there – we've also prioritized safety. We improved our sandboxing infrastructure and introduced [Control-flow Integrity (CFI)](https://en.wikipedia.org/wiki/Control-flow_integrity) to V8, providing a safer environment for users.

Below, we've outlined some key highlights from the year.

# Maglev: new mid tier optimizing compiler

We've introduced a new optimizing compiler named [Maglev](https://v8.dev/blog/maglev), strategically positioned between our existing [Sparkplug](https://v8.dev/blog/sparkplug) and [TurboFan](https://v8.dev/docs/turbofan) compilers. It functions in-between as a high-speed optimizing compiler, efficiently generating optimized code at an impressive pace. It generates code approximately 20 times slower than our baseline non-optimizing compiler Sparkplug, but 10 to 100 times faster than the top-tier TurboFan. We've observed significant performance improvements with Maglev, with [JetStream](https://browserbench.org/JetStream2.1/) improving by 8.2% and [Speedometer](https://browserbench.org/Speedometer2.1/) by 6%. Maglev's faster compilation speed and reduced reliance on TurboFan resulted in a 10% energy savings in V8's overall consumption during Speedometer runs. [While not fully complete](https://en.m.wikipedia.org/wiki/Full-employment_theorem), Maglev's current state justifies its launch in Chrome 117. More details in our [blog post](https://v8.dev/blog/maglev).

# Turboshaft: new architecture for the top-tier optimizing compiler

Maglev wasn't our only investment in improved compiler technology. We've also introduced Turboshaft, a new internal architecture for our top-tier optimizing compiler Turbofan, making it both easier to extend with new optimizations and faster at compiling. Since Chrome 120, the CPU-agnostic backend phases all use Turboshaft rather than Turbofan, and compile about twice as fast as before. This is saving energy and is paving the way for more exciting performance gains next year and beyond. Keep an eye out for updates!

# Faster HTML parser

We observed a significant portion of our benchmark time being consumed by HTML parsing. While not a direct enhancement to V8, we took initiative and applied our expertise in performance optimization to add a faster HTML parser to Blink. These changes resulted in a notable 3.4% increase in Speedometer scores. The impact on Chrome was so positive that the WebKit project promptly integrated these changes into [their repository](https://github.com/WebKit/WebKit/pull/9926). We take pride in contributing to the collective goal of achieving a faster Web!

# Faster DOM allocations

We have also been actively investing to the DOM side. Significant optimizations have been applied to the memory allocation strategies in [Oilpan](https://chromium.googlesource.com/v8/v8/+/main/include/cppgc/README.md) - the allocator for the DOM objects. It has gained a page pool, which notably reduced the cost of the round-trips to the kernel. Oilpan now supports both compressed and uncompressed pointers, and we avoid compressing high-traffic fields in Blink. Given how frequently decompression is performed, it had a wide spread impact on performance. In addition, knowing how fast the allocator is, we oilpanized frequently-allocated classes, which made allocation workloads 3x faster and showed significant improvement on DOM-heavy benchmarks such as Speedometer.

# New JavaScript features

JavaScript continues to evolve with newly standardized features, and this year was no exception. We shipped [resizable ArrayBuffers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer#resizing_arraybuffers) and [ArrayBuffer transfer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer), String [`isWellFormed`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/isWellFormed) and [`toWellFormed`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toWellFormed), [RegExp `v` flag](https://v8.dev/features/regexp-v-flag) (a.k.a. Unicode set notation), [`JSON.parse` with source](https://github.com/tc39/proposal-json-parse-with-source), [Array grouping](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy), [`Promise.withResolvers`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers), and [`Array.fromAsync`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync). Unfortunately, we had to unship [iterator helpers](https://github.com/tc39/proposal-iterator-helpers) after discovering a web incompatibility, but we've worked with TC39 to fix the issue and will reship soon. Finally, we also made ES6+ JS code faster by [eliding some redundant temporal dead zone checks](https://docs.google.com/document/d/1klT7-tQpxtYbwhssRDKfUMEgm-NS3iUeMuApuRgZnAw/edit?usp=sharing) for `let` and `const` bindings.

# WebAssembly updates

Many new features and performance improvements landed for Wasm this year. We enabled support for [multi-memory](https://github.com/WebAssembly/multi-memory), [tail-calls](https://github.com/WebAssembly/tail-call) (see our [blog post](https://v8.dev/blog/wasm-tail-call) for more details), and [relaxed SIMD](https://github.com/WebAssembly/relaxed-simd) to unleash next-level performance. We finished implementing [memory64](https://github.com/WebAssembly/memory64) for your memory-hungry applications and are just waiting for the proposal to [reach phase 4](https://github.com/WebAssembly/memory64/issues/43) so we can ship it! We made sure to incorporate the latest updates to the [exception-handling proposal](https://github.com/WebAssembly/exception-handling) while still supporting the previous format. And we kept investing in [JSPI](https://v8.dev/blog/jspi) for [enabling another big class of applications on the web](https://docs.google.com/document/d/16Us-pyte2-9DECJDfGm5tnUpfngJJOc8jbj54HMqE9Y/edit#bookmark=id.razn6wo5j2m). Stay tuned for next year!

# WebAssembly Garbage Collection

Speaking of bringing new classes of applications to the web, we also finally shipped WebAssembly Garbage Collection (WasmGC) after several years of work on the [proposal](https://github.com/WebAssembly/gc/blob/main/proposals/gc/MVP.md)'s standardization and [implementation](https://bugs.chromium.org/p/v8/issues/detail?id=7748). Wasm now has a built-in way to allocate objects and arrays that are managed by V8's existing garbage collector. That enables compiling applications written in Java, Kotlin, Dart, and similar garbage-collected languages to Wasm – where they typically run about twice as fast as when they're compiled to JavaScript. See [our blog post](https://v8.dev/blog/wasm-gc-porting) for a lot more details.

# Security

On the security side, our three main topics for the year were sandboxing, fuzzing, and CFI. On the [sandboxing](https://docs.google.com/document/d/1FM4fQmIhEqPG8uGp5o9A-mnPB5BOeScZYpkHjo0KKA8/edit?usp=sharing) side we focused on building the missing infrastructure such as the code- and trusted pointer table. On the fuzzing side we invested into everything from fuzzing infrastructure to special purpose fuzzers and better language coverage. Some of our work was covered in [this presentation](https://www.youtube.com/watch?v=Yd9m7e9-pG0). Finally, on the CFI-side we laid the foundation for our [CFI architecture](https://v8.dev/blog/control-flow-integrity) so that it can be realized on as many platforms as possible. Besides these, some smaller but noteworthy efforts include work on [mitigating a popular exploit technique](https://crbug.com/1445008) around `the_hole`` and the launch of a new exploit bounty program in the form of the [V8CTF](https://github.com/google/security-research/blob/master/v8ctf/rules.md). 

# Conclusion

Throughout the year, we dedicated efforts to numerous incremental performance enhancements. The combined impact of these small projects, along with the ones detailed in the blog post, is substantial! Below are benchmark scores illustrating V8’s performance improvements achieved in 2023, with an overall growth of `14%` for JetStream and an impressive `34%` for Speedometer.

![Web performance benchmarks measured on a 13” M1 MacBook Pro.](/_img/holiday-season-2023/scores.svg)

These results show that V8 is faster and safer than ever. Buckle up, fellow developer, because with V8, the journey into fast and furious Web has only just begun! We're committed to keeping V8 the best JavaScript and WebAssembly engine on the planet!

From all of us at V8, we wish you a joyous holiday season filled with fast, safe and fabulous experiences as you navigate the Web!
