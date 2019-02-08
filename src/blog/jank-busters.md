---
title: 'Jank Busters Part One'
author: 'the jank busters: Jochen Eisinger, Michael Lippautz, and Hannes Payer'
avatars:
  - 'michael-lippautz'
  - 'hannes-payer'
date: 2015-10-30 13:33:37
tags:
  - memory
---
Jank, or in other words visible stutters, can be noticed when Chrome fails to render a frame within 16.66ms (disrupting 60 frames per second motion). As of today most of the V8 garbage collection work is performed on the main rendering thread, c.f. Figure 1, often resulting in jank when too many objects need to be maintained. Eliminating jank has always been a high priority for the V8 team ([1](https://blog.chromium.org/2011/11/game-changer-for-interactive.html), [2](https://www.youtube.com/watch?v=3vPOlGRH6zk), [3](/blog/free-garbage-collection)). This blog discusses a few optimizations that were implemented between M41 and M46 which significantly reduce garbage collection pauses resulting in better user experience.

<figure>
  <img src="/_img/jank-busters/gc-main-thread.png" intrinsicsize="798x137" alt="">
  <figcaption>Figure 1: Garbage collection performed on the main thread</figcaption>
</figure>

A major source of jank during garbage collection is processing various bookkeeping data structures. Many of these data structures enable optimizations that are unrelated to garbage collection. Two examples are the list of all ArrayBuffers, and each ArrayBuffer’s list of views. These lists allow for an efficient implementation of the DetachArrayBuffer operation without imposing any performance hit on access to an ArrayBuffer view. In situations, however, where a web page creates millions of ArrayBuffers, (e.g., WebGL-based games), updating those lists during garbage collection causes significant jank. In M46, we removed these lists and instead detect detached buffers by inserting checks before every load and store to ArrayBuffers. This amortizes the cost of walking the big bookkeeping list during GC by spreading it throughout program execution resulting in less jank. Although the per-access checks can theoretically slow down the throughput of programs that heavily use ArrayBuffers, in practice V8's optimizing compiler can often remove redundant checks and hoist remaining checks out of loops, resulting in a much smoother execution profile with little or no overall performance penalty.

Another source of jank is the bookkeeping associated with tracking the lifetimes of objects shared between Chrome and V8. Although the Chrome and V8 memory heaps are distinct, they must be synchronized for certain objects, like DOM nodes, that are implemented in Chrome's C++ code but accessible from JavaScript. V8 creates an opaque data type called a handle that allows Chrome to manipulate a V8 heap object without knowing any of the details of the implementation. The object's lifetime is bound to the handle: as long as Chrome keeps the handle around, V8's garbage collector won't throw away the object. V8 creates an internal data structure called a global reference for each handle it passes back out to Chrome through the V8 API, and these global references are what tell V8’s garbage collector that the object is still alive. For WebGL games, Chrome may create millions of such handles, and V8, in turn, needs to create the corresponding global references to manage their lifecycle. Processing these huge amounts of global references in the main garbage collection pause is observable as jank. Fortunately, objects communicated to WebGL are often just passed along and never actually modified, enabling simple static [escape analysis](https://en.wikipedia.org/wiki/Escape_analysis). In essence, for WebGL functions that are known to usually take small arrays as parameters the underlying data is copied on the stack, making a global reference obsolete. The result of such a mixed approach is a reduction of pause time by up to 50% for rendering-heavy WebGL games.

Most of V8’s garbage collection is performed on the main rendering thread. Moving garbage collection operations to concurrent threads reduces the waiting time for the garbage collector and further reduces jank. This is an inherently complicated task since the main JavaScript application and the garbage collector may simultaneous observe and modify the same objects. Until now, concurrency was limited to sweeping the old generation of the regular object JS heap. Recently, we also implemented concurrent sweeping of the code and map space of the V8 heap. Additionally, we implemented concurrent unmapping of unused pages to reduce the work that has to be performed on the main thread, c.f. Figure 2.

<figure>
  <img src="/_img/jank-busters/gc-concurrent-threads.png" intrinsicsize="800x260" alt="">
  <figcaption>Figure 2: Some garbage collection operations performed on the concurrent garbage collection threads.</figcaption>
</figure>

The impact of the discussed optimizations is clearly visible in WebGL-based games, for example [Turbolenz’s Oort Online demo](http://oortonline.gl/). The following video compares Chrome 41 to Chrome 46:

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/PgrCJpbTs9I" width="640" height="360"></iframe>
  </div>
</figure>

We are currently in the process of making more garbage collection components incremental, concurrent, and parallel, to shrink garbage collection pause times on the main thread even further. Stay tuned as we have some interesting patches in the pipeline.
