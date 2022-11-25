---
title: 'Oilpan library'
author: 'Anton Bikineev, Omer Katz ([@omerktz](https://twitter.com/omerktz)), and Michael Lippautz ([@mlippautz](https://twitter.com/mlippautz)), efficient and effective file movers'
avatars:
  - anton-bikineev
  - omer-katz
  - michael-lippautz
date: 2021-11-10
tags:
  - internals
  - memory
  - cppgc
description: 'V8 ships with Oilpan, a garbage collection library for hosting managed C++ memory.'
tweet: '1458406645181165574'
---

While the title of this post may suggest taking a deep dive into a collection of books around oil pans – which, considering construction norms for pans, is a topic with a surprising amount of literature – we are instead looking a bit closer at Oilpan, a C++ garbage collector that is hosted through V8 as a library since V8 v9.4.

Oilpan is a [trace-based garbage collector](https://en.wikipedia.org/wiki/Tracing_garbage_collection), meaning that it determines live objects by traversing an object graph in a marking phase. Dead objects are then reclaimed in a sweeping phase, which we have [blogged about in the past](https://v8.dev/blog/high-performance-cpp-gc). Both phases may run interleaved or parallel to actual C++ application code. Reference handling for heap objects is precise, and conservative for the native stack. This means that Oilpan knows where references are on the heap but has to scan the memory assuming random bit sequences represent pointers for the stack. Oilpan also supports compaction (defragmenting the heap) for certain objects when garbage collection runs without a native stack.

So, what’s the deal with providing it as a library through V8?

Blink, being forked from WebKit, originally used reference counting, a [well-known paradigm for C++ code](https://en.cppreference.com/w/cpp/memory/shared_ptr), for managing its on-heap memory. Reference counting is supposed to solve memory management issues but is known to be prone to memory leaks due to cycles. On top of this inherent problem, Blink also suffered from [use-after-free issues](https://en.wikipedia.org/wiki/Dangling_pointer) as sometimes reference counting would be omitted for performance reasons. Oilpan was initially developed specifically for Blink to simplify the programming model and get rid of memory leaks and use-after-free issues. We believe Oilpan succeeded in simplifying the model and also in making the code more secure.

Another maybe less pronounced reason for introducing Oilpan in Blink was to aid integration into other garbage collected systems such as V8 which eventually materialized in implementing the [unified JavaScript and C++ heap](https://v8.dev/blog/tracing-js-dom) where Oilpan takes care of processing C++ objects[^1]. With more and more object hierarchies being managed and better integration with V8, Oilpan became increasingly complex over time and the team realized that they were reinventing the same concepts as in V8’s garbage collector and solving the same problems. Integration in Blink required building around 30k targets to actually run a hello world garbage collection test for unified heap.

Early 2020, we started a journey in carving out Oilpan from Blink and encapsulating it into a library. We decided to host the code in V8, reuse abstractions where possible, and do some spring cleaning on the garbage collection interface. In addition to fixing all of the aforementioned issues, [a library](https://docs.google.com/document/d/1ylZ25WF82emOwmi_Pg-uU6BI1A-mIbX_MG9V87OFRD8/) would also enable other projects to make use of garbage-collected C++. We launched the library in V8 v9.4 and enabled it in Blink starting in Chromium M94.

## What’s in the box?

Similar to the rest of V8, Oilpan now provides a [stable API](https://chromium.googlesource.com/v8/v8.git/+/HEAD/include/cppgc/) and embedders may rely on the regular [V8 conventions](https://v8.dev/docs/api). For example, this means that APIs are properly documented (see [GarbageCollected](https://chromium.googlesource.com/v8/v8.git/+/main/include/cppgc/garbage-collected.h#17)) and will go through a deprecation period in case they are subject to being removed or changed.

The core of Oilpan is available as a stand-alone C++ garbage collector in the `cppgc` namespace. The setup also allows for reusing an existing V8 platform to create a heap for managed C++ objects. Garbage collections can be configured to run automatically, integrating in the task infrastructure or can be triggered explicitly considering the native stack as well. The idea is to allow embedders that just want managed C++ objects to avoid dealing with V8 as a whole, see this [hello world program](https://chromium.googlesource.com/v8/v8.git/+/main/samples/cppgc/hello-world.cc) as an example. An embedder of this configuration is PDFium which uses Oilpan’s stand-alone version for [securing XFA](https://groups.google.com/a/chromium.org/g/chromium-dev/c/RAqBXZWsADo/m/9NH0uGqCAAAJ?utm_medium=email&utm_source=footer) which allows for more dynamic PDF content.

Conveniently, tests for the core of Oilpan use this setup which means that it’s a matter of seconds to build and run a specific garbage collection test. As of today, [>400 of such unit tests](https://source.chromium.org/chromium/chromium/src/+/main:v8/test/unittests/heap/cppgc/) for the core of Oilpan exist. The setup also serves as a playground to experiment and try out new things and may be used to validate assumptions around raw performance.

Oilpan library also takes care of processing C++ objects when running with the unified heap through V8 which allows full tangling of C++ and JavaScript object graphs. This configuration is used in Blink for managing the C++ memory of the DOM and more. Oilpan also exposes a trait system that allows for extending the core of the garbage collector with types that have very specific needs for determining liveness. This way it is possible for Blink to provide its own collection libraries that even allow building JavaScript-style ephemeron maps ([`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)) in C++. We don’t recommend this to everyone but it shows what this system is capable of in case there’s a need for customization.

## Where are we headed?

Oilpan library provides us with a solid foundation that we can now leverage to improve performance. Where we would previously need to specify garbage collection specific functionality on V8’s public API to interact with Oilpan, we can now directly implement what we need. This allows for fast iteration and also taking shortcuts and improving performance where possible.

We also see potential in providing certain basic containers directly through Oilpan to avoid reinventing the wheel. This would allow other embedders to benefit from data structures that were previously created specifically for Blink.

Seeing a bright future for Oilpan, we would like to mention that the existing [`EmbedderHeapTracer`](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-embedder-heap.h;l=75) APIs are not going to be further improved and may be deprecated at some point. Assuming embedders making use of such APIs already implemented their own tracing system, migrating to Oilpan should be as simple as just allocating the C++ objects on a newly created [Oilpan heap](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-cppgc.h;l=91) that is then attached to a V8 Isolate. Existing infrastructure for modeling references such as [`TracedReference`](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-traced-handle.h;l=334) (for references into V8) and [internal fields](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-object.h;l=502) (for references outgoing from V8) are supported by Oilpan.

Stay tuned for more garbage collection improvements in the future!

Encountering issues, or have suggestions? Let us know:

- [oilpan-dev@chromium.org](mailto:oilpan-dev@chromium.org)
- Monorail: [Blink>GarbageCollection](https://bugs.chromium.org/p/chromium/issues/entry?template=Defect+report+from+user&components=Blink%3EGarbageCollection) (Chromium), [Oilpan](https://bugs.chromium.org/p/v8/issues/entry?template=Defect+report+from+user&components=Oilpan) (V8)

[^1]: Find more info on garbage collection across components in the [research article](https://research.google/pubs/pub48052/).
