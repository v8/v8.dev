---
title: 'One small step for Chrome, one giant heap for V8'
author: 'guardians of the heap Ulan Degenbaev, Hannes Payer, Michael Lippautz, and DevTools master Alexey Kozyatinskiy'
avatars:
  - 'ulan-degenbaev'
  - 'michael-lippautz'
  - 'hannes-payer'
date: 2017-02-09 13:33:37
tags:
  - memory
---
V8 has a hard limit on its heap size. This serves as a safeguard against applications with memory leaks. When an application reaches this hard limit, V8 does a series of last resort garbage collections. If the garbage collections do not help to free memory V8 stops execution and reports an out-of-memory failure. Without the hard limit a memory leaking application could use up all system memory hurting the performance of other applications.

Ironically, this safeguard mechanism makes investigation of memory leaks harder for JavaScript developers. The application can run out of memory before the developer manages to inspect the heap in DevTools. Moreover the DevTools process itself can run out memory because it uses an ordinary V8 instance. For example, taking a heap snapshot of [this demo](https://ulan.github.io/misc/heap-snapshot-demo.html) will abort execution due to out-of-memory on the current stable Chrome.

Historically the V8 heap limit was conveniently set to fit the signed 32-bit integer range with some margin. Over time this convenience lead to sloppy code in V8 that mixed types of different bit widths, effectively breaking the ability to increase the limit. Recently we cleaned up the garbage collector code, enabling the use of larger heap sizes. DevTools already makes use of this feature and taking a heap snapshot in the previously mentioned demo works as expected in the latest Chrome Canary.

We also added a feature in DevTools to pause the application when it is close to running out of memory. This feature is useful to investigate bugs that cause the application to allocate a lot of memory in a short period of time. When running [this demo](https://ulan.github.io/misc/oom.html) with the latest Chrome Canary, DevTools pauses the application before the out-of-memory failure and increases the heap limit, giving the user a chance to inspect the heap, evaluate expressions on the console to free memory and then resume execution for further debugging.

<figure>
  <img src="/_img/heap-size-limit/debugger.png" width="1362" height="836" alt="" loading="lazy">
</figure>

V8 embedders can increase the heap limit using the [`set_max_old_space_size`](https://codesearch.chromium.org/chromium/src/v8/include/v8.h?q=set_max_old_space_size) function of the `ResourceConstraints` API. But watch out, some phases in the garbage collector have a linear dependency on the heap size. Garbage collection pauses may increase with larger heaps.
