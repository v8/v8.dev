---
title: 'Speeding up V8 heap snapshots'
description: 'This post about V8 heap snapshots presents some performance problems found by Bloomberg engineers, and how we fixed them to make JavaScript memory analysis faster than ever.'
author: 'Jose Dapena Paz'
date: 2023-06-23
tags:
 - memory
 - tools
---
*This blog post has been authored by José Dapena Paz (Igalia), with contributions from Jason Williams (Bloomberg), Ashley Claymore (Bloomberg), and Rob Palmer (Bloomberg).*

In this post about V8 heap snapshots, I will talk about some performance problems found by Bloomberg engineers, and how we fixed them to make JavaScript memory analysis faster than ever.

## The Problem

Ashley Claymore was working on diagnosing a memory leak in a JavaScript application. It was failing with *Out-Of-Memory* errors. Despite the process having access to plenty of system memory, V8 places a hard limit on the amount of memory dedicated to the garbage-collected heap from which all JavaScript objects are allocated. This V8 heap limit (~1400MB) was being hit.

The standard way to debug a routine memory leak scenario like this is to capture a heap snapshot and then inspect the various summaries and object attributes using DevTools "Memory" tab to find out what is consuming the most memory.  In DevTools, you click the round button marked _"Take heap snapshot"_ to perform the capture. For Node.js applications, you can [trigger the snapshot](https://nodejs.org/en/docs/guides/diagnostics/memory/using-heap-snapshot) programmatically using this API:

```javascript
require('v8').writeHeapSnapshot();
```

The desire was to capture several snapshots at different points in the application's life, so that DevTools Memory viewer could be used to show the difference between each.  The problem was that capturing a single full-size (500MB) snapshot was taking **over 30 minutes** alone!

It was this slowness in the memory analysis workflow that we needed to solve.

## Narrowing down the Problem

Jason Williams started investigating the issue using some V8 parameters. As described in the previous post, V8 has some nice command line parameters that can help with that. These options were used to curate the heap snapshots , simplify the reproduction, and improve observability:

`--max-old-space-size=100`
: This limits the heap to 100 megabytes and helps to reproduce the issue much faster.

`--heapsnapshot-near-heap-limit=10`
: This tells V8 to produce a maximum of 10 snapshots, each time it comes close to running out of memory.  This prevents thrashing where the memory-starved program spends a long time producing more snapshots than needed.

`--enable-etw-stack-walking`
: This allows tools such as ETW, WPA & xperf to see the JS stack which has been called in V8. (Node v20+)

`--interpreted-frames-native-stack`
: This flag is used in combination with tools like ETW, WPA & xperf to see the native stack when profiling. (Node v20+).

After each snapshot, V8 tries to force garbage collection to reduce memory usage and avoid hitting the limit. In the test case, the memory usage increases, but, after several iterations, garbage collection ultimately could not free up enough space and so the application terminated with an *Out-Of-Memory* error.

Jason took recordings using Windows Performance Analyzer (see below) in order to narrow down the issue. This revealed that most CPU time was being spent within the V8 Heap Explorer. Specifically, around 30 minutes would elapse just walking through the heap to visit each node and collect the name. This didn’t seem to make much sense - why would recording the name of each property take so long?

This is when I was asked to take a look.

## Quantifying the Problem

We knew the snapshots were dramatically increasing execution time, so the first step was adding support in V8 to better understand the time used by heap snapshotting. The capture process itself is split into two phases: generation, then serialization.

We landed [this patch](https://chromium-review.googlesource.com/c/v8/v8/+/4428810) upstream to introduce a new command line flag `--profile_heap_snapshot` to V8, which enables recording of both the generation and serialization times.

Using this flag, we learned some interesting things!

First, we could observe the exact time the CPU was using for each snapshot. In our reduced test case, the first took 5 minutes, the second took 8 minutes, and each subsequent snapshot kept on taking longer and longer.  Nearly all of this time was spent in the generation phase.

We also identified other widely-used JavaScript applications that demonstrated the same slowdown, in particular, running ESLint on TypeScript. The problem was not app-specific.

Furthermore, we found the problem happened on both Windows and Linux. The problem was also not platform-specific.

## Windows Performance Analyzer to the rescue

As the problem was initially reported on a Windows platform, I used [Windows Performance Toolkit](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/), based on [ETW](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/event-tracing-for-windows--etw-), for analysis. This is a powerful low-level expert tool to find out exactly what a program is doing on Windows.

To record the session, I followed these steps:

1. Open [Windows Performance Recorder](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-recorder) and selected CPU profiling, verbose detail level, general scenario, and file logging mode.

    ![](/_img/speeding-up-v8-heap-snapshots/d62c099f-6218-4991-a298-c735afe3d6ce.png){.no-darkening}


2. After that, I started the recording session (pressing the Start button).
3. Then, I executed the failing script with `NODE_OPTIONS="--max-old-space-size=100 --heapsnapshot-near-heap-limit=10 --profile-heap-snapshot`. I had to modify Node.js to accept `--profile-heap-snapshot`, as its command line parameters filter has not yet been updated to accept the newer V8 flags.
4. I just let it run a couple of dumps (it would already take over 10 minutes!) and then I stopped the recording.

## First Optimization: Improved StringsStorage hashing

When I opened the recording with [Windows Performance Analyzer](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-analyzer), what did I find? This:

![](/_img/speeding-up-v8-heap-snapshots/345360c1-297e-43d2-901f-ea4fa81ede3c.png){.no-darkening}


One third of the samples was spent in `v8::internal::StringsStorage::GetEntry`:

```javascript
181 base::HashMap::Entry* StringsStorage::GetEntry(const char* str, int len) {
182   uint32_t hash = ComputeStringHash(str, len);
183   return names_.LookupOrInsert(const_cast<char*>(str), hash);
184 }
```

Where exactly? I added the source line numbers to the break down and found this:

![](/_img/speeding-up-v8-heap-snapshots/59293b17-6d52-4d9e-8737-5b23d038d50a.png){.no-darkening}

So, that inlined `ComputeStringHash` call is causing over 30% of the delay! But why?

Let’s first talk about `StringsStorage`. Its purpose is to store a unique copy of all the strings that will be used in the heap snapshot. For fast access and handling uniqueness, this class uses a flatmap: a hashmap backed by an array, where collisions are handled by storing elements in the next position of the array.

I started to suspect the problem could be too many collisions, which could lead to long searches in the array. But I needed to prove it. So I added exhaustive logs to see the generated hash keys and, on insertion, see how far an entry could end after the expected position for its hash key.

Things were… not right: the offset of many items was over 20 entries. But some cases were really bad, in the order of thousands of positions off from their expected position!

Part of the problem was caused by the scripts using strings for lots of numbers - and especially a big range of numbers from 1 to several hundreds without gaps. The hash key algorithm had two implementations, one for numbers and another for other strings. While the string hash function was quite classical, the problem came with the numbers implementation that would basically be the value of the number - with a prefix for the number of digits.

Some examples of problems with this hash function:

* Once we had strings with a hash key value in lower positions, then the storing of new numbers would offset all the positions.
* Or even worse: if we would introduce a string with a hash key value that would be a low number, and we already found several hundreds or thousands of consecutive numbers, then that value would be moved several hundreds or thousands of positions.

What did I do to fix it? As the problem comes mostly from numbers represented as strings that would fall in consecutive positions, I modified the hash function so we would rotate the resulting hash value 2 positions to the left. So, for each number, we would introduce 3 free positions. Why 2? Empirical testing across several work-sets showed this number was the best choice to minimize collisions.

[This hashing fix](https://chromium-review.googlesource.com/c/v8/v8/+/4428811) has landed in V8.

## Second Optimization: Caching source positions

After fixing the hashing, we re-profiled and found a further optimization opportunity that would take a significant part of the time. *An old friend*.

For each allocation in the V8 heap, the heap snapshot tries to record the call stack responsible for the allocation. Therefore, for each stack frame, it needs to know the function name and its source location (filename, line number, column number). It was the fetching of this information that turned out to be super slow!

What was happening? It was something similar to [what I fixed in the ETW stack walk](https://chromium-review.googlesource.com/c/v8/v8/+/3669698) and that I explained in [this post](https://blogs.igalia.com/dape/2022/12/21/native-call-stack-profiling-3-3-2022-work-in-v8/).

To compute the source code lines of a function, V8 knows the linear position of the function in the file. But, to find the source line, it needs to traverse the whole file to identify where each newline occurs. This is expensive.

When requesting line information, V8 already knows how to cache the source line positions per-script. But the heap snapshot implementation was not using a cache!

The solution? Before generating the heap snapshot, we now iterate over all the scripts in the V8 context to compute and cache the source line positions.

[This source position caching fix](https://chromium-review.googlesource.com/c/v8/v8/+/4538766) has also landed in V8.

## Did we make it fast?

After enabling both fixes, we re-profiled. Both of our fixes only affect snapshot generation time, so, as expected, snapshot serialization times were unaffected.

When operating on a JS program containing...

* Unoptimized development JS, generation time is **50% faster** 👍
* Optimized production JS, generation time is **90% faster** 😮

Why such a massive difference between optimized and unoptimized code? It is mostly because of the source code line optimization. In code optimized using bundling and minification, there are fewer JS files and these files tend to be large, which means finding the newlines takes longer. And therefore, these larger files benefit most from the source position caching that only performs this work once.

The optimizations were validated on both Windows and Linux target environments.

For the particularly challenging problem originally faced by the Bloomberg engineers, the total end-to-end time to capture a 100MB snapshot was reduced from a painful 10 minutes down to a very pleasant 6 seconds. That is **a 100x win!** 🔥

The optimizations are generic wins that we expect to be widely applicable to anyone performing memory debugging on V8, Node, and Chromium. These wins shipped in V8 11.5.130, which means they are found in Chromium 115.0.5576.0. We look forward to Node gaining these optimizations once it adopts the newer V8 release.

## What’s next?

First, it would be useful for Node.js to accept the new `--profile-heap-snapshot` flag. Today, it filters V8 command line options, and only allows a known subset.

Information accuracy in snapshots can be improved further. Today, each script source code line information is stored in a representation in the V8 heap itself. And that’s a problem because we want to measure the heap precisely without the observability infrastructure affecting the subject we are observing. Ideally, we would store the cache of line information outside the V8 heap in order to make heap snapshot information more accurate.

Finally, now that we improved the generation phase, the biggest cost is now the serialization phase. Further analysis may reveal new optimization opportunities in serialization.

## The end

This work was possible thanks to the sponsorship of [Igalia](https://www.igalia.com) and [Bloomberg](https://techatbloomberg.com).
