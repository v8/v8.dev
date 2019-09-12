---
title: 'A Lighter V8'
author: 'Mythri Alle, Dan Elphick and [Ross McIlroy](https://twitter.com/rossmcilroy), V8 weight-watchers'
avatars:
  - 'mythri-alle'
  - 'dan-elphick'
  - 'ross-mcilroy'
date: 2019-09-12 12:44:37
tags:
  - internals
  - memory
  - presentations
description: 'The V8 Lite project dramatically reduced the memory overhead of V8 on typical websites, this is how we did it.'
---

In late 2018 we started a project called V8 Lite, aimed at dramatically reducing V8’s memory usage. Initially this project was envisioned as a separate *Lite mode* of V8 specifically aimed at low-memory mobile devices or embedder use-cases that care more about reduced memory usage than throughput execution speed.  However, in the process of this work, we realized that many of the memory optimizations we had made for this *Lite mode* could be brought over to regular V8 thereby benefiting all users of V8.

In this post we highlight some of the key optimizations we developed and the memory savings they provided in real world workloads.

:::note
**Note:** If you prefer watching a presentation over reading articles, then enjoy the video below! If not, skip the video and read on.
:::

<figure>
  <div class="video video-16:9">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/56ogP8-eRqA" allow="picture-in-picture" allowfullscreen loading="lazy"></iframe>
  </div>
  <figcaption><a href="https://www.youtube.com/watch?v=56ogP8-eRqA">“V8 Lite  ⁠— slimming down JavaScript memory”</a> as presented by Ross McIlroy at BlinkOn 10.</figcaption>
</figure>

## Lite Mode

In order to optimize V8’s memory usage, we first needed to understand how memory is used by V8 and what object types contribute a large proportion of V8’s heap size. We used V8’s [memory visualization](https://v8.dev/blog/optimizing-v8-memory#memory-visualization) tools to trace heap composition across a number of typical web pages.

<figure>
  <img src="/_img/v8-lite/memory-categorization.svg" width="950" height="440" alt="" loading="lazy">
  <figcaption>Percentage of V8’s heap used by different object types when loading Times of India.</figcaption>
</figure>

In doing so, we determined that a significant portion of V8’s heap was dedicated to objects that aren’t essential to JavaScript execution, but are used to optimize JavaScript execution and handle exceptional situations. Examples include: optimized code; type feedback used to determine how to optimize the code; redundant metadata for bindings between C++ and JavaScript objects; metadata only required during exceptional circumstances such as stack trace symbolization; and bytecode for functions that are only executed a few times during page loading.

As a result of this, we started work on a *Lite mode* of V8 that trades off speed of JavaScript execution against improved memory savings by vastly reducing the allocation of these optional objects.

<figure>
  <img src="/_img/v8-lite/v8-lite.svg" width="149" height="231" alt="" loading="lazy">
</figure>

A number of the *Lite mode* changes could be made by configuring existing V8 settings, for example, disabling V8’s TurboFan optimizing compiler. However, others required more involved changes to V8.

In particular, we decided that since *Lite mode* doesn’t optimize code, we could avoid collection of type feedback required by the optimizing compiler.  When executing code in the Ignition interpreter, V8 will collect feedback about the types of operands which are passed to various operations (e.g., `+` or `o.foo`), in order to tailor later optimization to those types.  This information is stored in *feedback vectors* which contribute a significant portion of V8’s heap memory usage. *Lite mode* could avoid allocating these feedback vectors, however the interpreter and parts of V8’s inline-cache infrastructure expected feedback vectors to be available, and so required considerable refactoring to be able to support this feedback-free execution.

*Lite mode* launched in V8 version 7.3 and provides a 22% reduction in typical web page heap size compared to V8 version 7.1 by disabling code optimization, not allocating feedback vectors and performed aging of seldom executed bytecode (described below). This is a nice result for those applications that explicitly want to trade off performance for better memory usage. However in the process of doing this work we realized that we could achieve most of the memory savings of *Lite mode* with none of the performance impact by making V8 lazier.

## Lazy feedback allocation

Disabling feedback vector allocation entirely not only prevents optimization of code by V8’s TurboFan compiler, but also prevents V8 from performing [inline-caching](https://en.wikipedia.org/wiki/Inline_caching) of common operations, such as object property loads in the Ignition interpreter. As such, doing so caused a significant regression to V8’s execution time, reducing page-load-time by 12% and increasing the CPU time used by V8 by 120% on typical interactive web page scenarios.

To bring most of these savings to regular V8 without these regressions, we instead moved to an approach where we lazily allocate feedback vectors after the function has executed a certain amount of bytecode (currently 1KB). Since most functions aren’t executed very often, we avoid feedback vector allocation in most cases, but quickly allocate them where needed to avoid performance regressions and still allow code to be optimized.

One additional complication with this approach is related to the fact that feedback vectors form a tree, with the feedback vectors for inner functions being held as entries in their outer function’s feedback vector.  This is necessary so that newly created function closures receive the same feedback vector array as all other closures created for the same function. With lazy allocation of feedback vectors we can’t form this tree using feedback vectors, since there is no guarantee that an outer function will have allocated its feedback vector by the time an inner function does so. To address this, we created a new `ClosureFeedbackCellArray` to maintain this tree, then swap out a function’s `ClosureFeedbackCellArray` with a full `FeedbackVector` when it becomes hot.

<figure>
  <img src="/_img/v8-lite/lazy-feedback.svg" width="1257" height="480" alt="" loading="lazy">
  <figcaption>Feedback vector trees before and after lazy feedback allocation.</figcaption>
</figure>

Our lab experiments and in-the-field telemetry showed no performance regressions for lazy feedback on desktop, and on mobile platforms we actually saw a performance improvement on low-end devices due to a reduction in garbage collection.  As such, we have enabled lazy feedback allocation in all builds of V8, including *Lite mode* where the slight regression in memory compared to our original no-feedback allocation approach is more than compensated by the improvement in real world performance.

## Lazy source positions

When compiling bytecode from JavaScript, source position tables are generated that tie bytecode sequences to character positions within the JavaScript source code. However, this information is only needed when symbolizing exceptions or performing developer tasks such as debugging, and so is rarely used.

To avoid this waste, we now compile bytecode without collecting source positions (assuming no debugger or profiler is attached). The source positions are only collected when a stack trace is actually generated, for instance when calling `Error.stack` or printing an exception’s stack trace to the console. This does have some cost, as generating source positions requires the function to be reparsed and compiled, however most websites don’t symbolize stack traces in production and therefore don’t see any observable performance impact.

One issue we had to address with this work was to require repeatable bytecode generation, which had not previously been guaranteed. If V8 generates different bytecode when collecting source positions compared to the original code, then the source positions will not line up and stack traces could point to the wrong position in the source code.

In certain circumstances V8 could generate different bytecode depending on whether a function was [eagerly or lazily compiled](https://v8.dev/blog/preparser#skipping-inner-functions), due to some parser information being lost between the initial eager parse of a function, and later lazy compilation. These mismatches were mostly benign, for example losing track of the fact that a variable is immutable and therefore not being able to optimize it as such. However some of the mismatches uncovered by this work did have the potential to cause incorrect code execution in certain circumstances. As a result, we fixed these mismatches and added checks and a stress mode to ensure that eager and lazy compilation of a function always produce consistent outputs, giving us greater confidence in the correctness and consistency of V8’s parser and preparser.

## Bytecode flushing

Bytecode compiled from JavaScript source takes up a significant chunk of V8 heap space, typically around 15%, including related metadata. There are many functions which are only executed during initialization, or rarely used after having been compiled.

As a result, we added support for flushing compiled bytecode from functions during garbage collection if they haven’t been executed recently.  In order to do this, we keep track of the *age* of a function’s bytecode, incrementing the *age* every [major (mark-compact)](https://v8.dev/blog/trash-talk#major-gc) garbage collection, and resetting it to zero when the function is executed. Any bytecode which crosses an aging threshold is eligible to be collected by the next garbage collection. If it is collected and then later executed again, it will then be recompiled.

There were technical challenges to ensure that bytecode is only ever flushed when it is no longer necessary. For instance, if function `A` calls another long-running function `B`, function `A` could be aged while it is still on the stack.  We don’t want to flush the bytecode for function `A` even if it reaches its aging threshold because we need to return to it when the long-running function `B` returns. As such, we treat bytecode as weakly held from a function when it reaches its aging threshold, but strongly held by any references to it on the stack or elsewhere. We only flush the code when there are no strong links remaining.

In addition to flushing bytecode, we also flush feedback vectors associated with these flushed functions. However we can’t flush feedback vectors during the same GC cycle as the bytecode because they aren’t retained by the same object - bytecode is held by a native-context independent `SharedFunctionInfo`, whereas the feedback vector is retained by the native-context dependent `JSFunction`. As a result we flush feedback vectors on the subsequent GC cycle.

<figure>
  <img src="/_img/v8-lite/bytecode-flushing.svg" width="1200" height="492" alt="" loading="lazy">
  <figcaption>The object layout for an aged function after two GC cycles.</figcaption>
</figure>

## Additional optimizations

In addition to these larger projects, we also uncovered and addressed a couple of inefficiencies.

The first was to reduce the size of `FunctionTemplateInfo` objects. These objects store internal metadata about [FunctionTemplates](https://v8.dev/docs/embed#templates), which are used to enable embedders, such as Chrome, to provide C++ callback implementations of functions that can be called by JavaScript code. Chrome introduces a lot of FunctionTemplates in order to implement DOM Web APIs, and therefore `FunctionTemplateInfo` objects contributed to V8’s heap size. After analysing the typical usage of FunctionTemplates, we found that of the eleven fields on a `FunctionTemplateInfo` object, only three were typically set to a non-default value. We therefore split the `FunctionTemplateInfo` object such that the rare fields are stored in a side-table which is only allocated on demand if required.

The second optimization is related to how we deoptimize from TurboFan optimized code. Since TurboFan performs speculative optimizations, it might need to fall back to the interpreter (deoptimize) if certain conditions no longer hold. Each deopt point has an id which enables the runtime to determine where in the bytecode it should return execution to in the interpreter. Previously this id was calculated by having the optimized code jump to a particular offset within a large jump table, which loaded the correct id into a register and then jumped into the runtime to perform the deoptimization.  This had the advantage of requiring only a single jump instruction in the optimized code for each deopt point. However the deoptimize jump table was pre-allocated and had to be large enough to support the whole deoptimization id range. We instead modified TurboFan such that deopt points in optimized code load the deopt id directly before calling into the runtime. This enabled us to remove this large jump table entirely, at the expense of a slight increase in optimized code size.

## Results

We have released the optimizations described above over the last seven releases of V8. Typically they landed first in *Lite mode*, and then were later brought to the default configuration of V8.

<figure>
  <img src="/_img/v8-lite/savings-by-release.svg" width="700" height="433" alt="" loading="lazy">
  <figcaption>Average V8 heap size for a set of typical web pages on an AndroidGo device.</figcaption>
</figure>

<figure>
  <img src="/_img/v8-lite/breakdown-by-page.svg" width="677" height="411" alt="" loading="lazy">
  <figcaption>Per-page breakdown of memory savings of V8 v7.8 (Chrome 78) compared to v7.1 (Chrome 71).</figcaption>
</figure>

Over this time, we have reduced the V8 heap size by an average of 18% across a range of typical websites, which corresponds to an average decrease of 1.5MB for low-end AndroidGo mobile devices. This has been possible without any significant impact on JavaScript performance either on benchmarks or as measured on real world webpage interactions.

*Lite Mode* can provide further memory savings at some cost to JavaScript execution throughput by disabling function optimization. On average *Lite mode* provides 22% memory savings, with some pages seeing up to 32% reductions. This corresponds to a 1.8MB reduction in V8 heap size on an AndroidGo device.

<figure>
  <img src="/_img/v8-lite/breakdown-by-optimization.svg" width="677" height="411" alt="" loading="lazy">
  <figcaption>Breakdown of memory savings of V8 v7.8 (Chrome 78) compared to v7.1 (Chrome 71).</figcaption>
</figure>

When split by the impact of each individual optimization, it is clear that different pages derive a different proportion of their benefit from each of these optimizations. Going forward, we will continue to identify potential optimizations which can further reduce V8’s memory usage while still remaining blazingly fast at JavaScript execution.
