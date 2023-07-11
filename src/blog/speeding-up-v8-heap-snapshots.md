---
title: 'Speeding up V8 heap snapshots'
description: 'This post about V8 heap snapshots presents some performance problems found by Bloomberg engineers, and how we fixed them to make JavaScript memory analysis faster than ever.'
author: 'Jose Dapena Paz'
date: 2023-06-23
tags:
 - memory
 - tools
---
*This blog post has been authored by José Dapena Paz (Igalia), with contributions from Jason Williams (Bloomberg), Ashley Claymore (Bloomberg), Rob Palmer (Bloomberg) and Joyee Cheung(Igalia).*

In this post about V8 heap snapshots, I will talk about some performance problems found by Bloomberg engineers, and how we fixed them to make JavaScript memory analysis faster than ever.

## The Problem

Ashley Claymore was working on diagnosing a memory leak in a JavaScript application. It was failing with *Out-Of-Memory* errors. For the tested application, the V8 heap limit was configured to be around 1400MB. Normally V8's garbage collector should be able to keep the heap usage under that limit, so the failures indicated that there was a leak.

A common technique to debug a routine memory leak scenario like this is to capture a heap snapshot first, then load it in the DevTools "Memory" tab and find out what is consuming the most memory by inspecting the various summaries and object attributes. In the DevTools UI, the heap snapshot can be taken in the "Memory" tab. For Node.js applications, the heap snapshot [can be triggered programmatically](https://nodejs.org/en/docs/guides/diagnostics/memory/using-heap-snapshot) using this API:

```javascript
require('v8').writeHeapSnapshot();
```

We wanted to capture several snapshots at different points in the application's life, so that DevTools Memory viewer could be used to show the difference between the heaps at different times. The problem was that capturing a single full-size (500MB) snapshot was taking **over 30 minutes** alone!

It was this slowness in the memory analysis workflow that we needed to solve.

## Narrowing down the Problem

Jason Williams started investigating the issue using some V8 parameters. As described in the previous post, V8 has some nice command line parameters that can help with that. These options were used to create the heap snapshots, simplify the reproduction, and improve observability:

`--max-old-space-size=100`
: This limits the heap to 100 megabytes and helps to reproduce the issue much faster.

`--heapsnapshot-near-heap-limit=10`
: This is a Node.js specific command line parameter that tells Node.js to generate a snapshot each time it comes close to running out of memory. It is configured to generate up to 10 snapshots in total. This prevents thrashing where the memory-starved program spends a long time producing more snapshots than needed.

`--enable-etw-stack-walking`
: This allows tools such as ETW, WPA & xperf to see the JS stack which has been called in V8. (available in Node.js v20+)

`--interpreted-frames-native-stack`
: This flag is used in combination with tools like ETW, WPA & xperf to see the native stack when profiling. (available in Node.js v20+).

When V8 is close to the heap limit, it forces a garbage collection to reduce the memory usage and avoid hitting the limit. It also notifies the embedder that the heap is about to reach the memory limit. The `--heapsnapshot-near-heap-limit` flag in Node.js dumps a new heap snapshot upon notification. In the test case, the memory usage decreases, but, after several iterations, garbage collection ultimately can not free up enough space and so the application is terminated with an *Out-Of-Memory* error.

Jason took recordings using Windows Performance Analyzer (see below) in order to narrow down the issue. This revealed that most CPU time was being spent within the V8 Heap Explorer. Specifically, it took around 30 minutes just to walk through the heap to visit each node and collect the name. This didn’t seem to make much sense - why would recording the name of each property take so long?

This is when I was asked to take a look.

## Quantifying the Problem

The first step was adding support in V8 to better understand where time is spent during the capturing of heap snapshots. The capture process itself is split into two phases: generation, then serialization. We landed [this patch](https://chromium-review.googlesource.com/c/v8/v8/+/4428810) upstream to introduce a new command line flag `--profile_heap_snapshot` to V8, which enables logging of both the generation and serialization times.

Using this flag, we learned some interesting things!

First, we could observe the exact time the CPU was using for each snapshot. In our reduced test case, the first took 5 minutes, the second took 8 minutes, and each subsequent snapshot kept on taking longer and longer.  Nearly all of this time was spent in the generation phase.

We also identified other widely-used JavaScript applications that demonstrated the same slowdown, in particular, running ESLint on TypeScript. The problem was not app-specific.

Furthermore, we found the problem happened on both Windows and Linux. The problem was also not platform-specific.

## Windows Performance Analyzer to the rescue

As the problem was initially reported on a Windows platform, I used [Windows Performance Toolkit](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/), based on [ETW](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/event-tracing-for-windows--etw-), for analysis. This is a powerful low-level expert tool to find out exactly what a program is doing on Windows.

To record the session, I followed these steps:

1. Opened [Windows Performance Recorder](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-recorder) and selected CPU profiling, verbose detail level, general scenario, and file logging mode.

    ![](/_img/speeding-up-v8-heap-snapshots/d62c099f-6218-4991-a298-c735afe3d6ce.png){.no-darkening}


2. After that, I started the recording session (pressing the Start button).
3. Then, I executed the failing script with `NODE_OPTIONS="--max-old-space-size=100 --heapsnapshot-near-heap-limit=10 --profile-heap-snapshot`. I had to modify Node.js to accept `--profile-heap-snapshot` in `NODE_OPTIONS`, as it uses an allowlist to filter V8 flags that can be configured through the environment variable.
4. I just let it run to generate a couple of heap snapshots (it would already take over 10 minutes!) and then I stopped the recording.

## First Optimization: Improved StringsStorage hashing

When I opened the recording with [Windows Performance Analyzer](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-analyzer), this was what I found:

![](/_img/speeding-up-v8-heap-snapshots/345360c1-297e-43d2-901f-ea4fa81ede3c.png){.no-darkening}


One third of the samples was spent in `v8::internal::StringsStorage::GetEntry`:

```javascript
181 base::HashMap::Entry* StringsStorage::GetEntry(const char* str, int len) {
182   uint32_t hash = ComputeStringHash(str, len);
183   return names_.LookupOrInsert(const_cast<char*>(str), hash);
184 }
```

Because this was run with a release build, the information of the inlined function calls were folded into `StringsStorage::GetEntry()`. To figure out exactly how much time the inlined function calls were taking, I added the "Source Line Number" column to the breakdown and found that most of the time was spent on line 182, which was a call to `ComputeStringHash()`:

![](/_img/speeding-up-v8-heap-snapshots/59293b17-6d52-4d9e-8737-5b23d038d50a.png){.no-darkening}

So over 30% of the snapshot generation time was spent on `ComputeStringHash()`, but why?

Let’s first talk about `StringsStorage`. Its purpose is to store a unique copy of all the strings that will be used in the heap snapshot. For fast access and avoiding duplicates, this class uses a flatmap: a hashmap backed by an array, where collisions are handled by storing elements in the next position of the array.

I started to suspect that the problem could be caused by collisions, which could lead to long searches in the array. But I needed to prove it. So I added exhaustive logs to see the generated hash keys and, on insertion, see how far it was between the expected position calculated from the hash key and the actual position the entry ended up in due to collisions.

In the logs, things were… not right: the offset of many items was over 20, and in the worst case, in the order of thousands!

Part of the problem was caused by the scripts using strings for lots of numbers - and especially a big range of numbers from 1 to several hundreds without gaps. The hash key algorithm had two implementations, one for numbers and another for other strings. While the string hash function was quite classical, the implementation for the numbers would basically return the value of the number prefixed by the number of digits, which was problematic.

Some examples of problems with this hash function:

- Once we inserted a string whose hash key value was a small number, we would run into collisions when we tried to store another number in that location, and there would be similar collisions if we tried to store subsequent numbers consecutively.
- Or even worse: if there were already a lot of consecutive numbers stored in the map, and we wanted to insert a string whose hash key value was in that range, we had to move the entry along all the occupied locations to find a free location.

What did I do to fix it? As the problem comes mostly from numbers represented as strings that would fall in consecutive positions, I modified the hash function so we would rotate the resulting hash value 2 positions to the left. So, for each number, we would introduce 3 free positions. Why 2? Empirical testing across several work-sets showed this number was the best choice to minimize collisions.

[This hashing fix](https://chromium-review.googlesource.com/c/v8/v8/+/4428811) has landed in V8.

## Second Optimization: Caching source positions

After fixing the hashing, we re-profiled and found a further optimization opportunity that would take a significant part of the time. *An old friend*.

For each allocation in the V8 heap, the heap snapshot tries to record the call stack responsible for the allocation. Therefore, for each stack frame, it needs to know the function name and its source location (filename, line number, column number). It was the fetching of this information that turned out to be super slow!

What was happening? It was something similar to [what I fixed in the ETW stack walk](https://chromium-review.googlesource.com/c/v8/v8/+/3669698) and that I explained in [this post](https://blogs.igalia.com/dape/2022/12/21/native-call-stack-profiling-3-3-2022-work-in-v8/).

To compute the source code lines of a function, V8 knows the linear position of the function in the script. But, to find the source line, it needs to traverse the whole script to identify where each newline occurs. This is expensive.

When requesting line information, V8 already implements caching of the source line positions per-script in method `Script::InitLineEnds()`. That information is stored in each script using a new heap object. Unfortunately, the snapshot implementation cannot modify the heap when traversing it, so the newly calculated line information cannot be cached.

The solution? Before generating the heap snapshot, we now iterate over all the scripts in the V8 context to compute and cache the source line positions. As this is not done when we traverse the heap for heap snapshot generation, it is still possible to modify the heap and store the source line positions as a cache.

[This source position caching fix](https://chromium-review.googlesource.com/c/v8/v8/+/4538766) has also landed in V8.

## Did we make it fast?

After enabling both fixes, we re-profiled. Both of our fixes only affect snapshot generation time, so, as expected, snapshot serialization times were unaffected.

When operating on a JS program containing...

- Development JS, generation time is **50% faster** 👍
- Production JS, generation time is **90% faster** 😮

Why was there a massive difference between production and development code? The production code is optimized using bundling and minification, so there are fewer JS files, and these files tend to be large. It takes longer to calculate source lines positions for these large files, so they benefit the most when we can cache the source position and avoid repeating calculations.

The optimizations were validated on both Windows and Linux target environments.

For the particularly challenging problem originally faced by the Bloomberg engineers, the total end-to-end time to capture a 100MB snapshot was reduced from a painful 10 minutes down to a very pleasant 6 seconds. That is **a 100x win!** 🔥

The optimizations are generic wins that we expect to be widely applicable to anyone performing memory debugging on V8, Node.js, and Chromium. These wins were shipped in V8 11.5.130, which means they are found in Chromium 115.0.5576.0. We look forward to Node.js gaining these optimizations in the next semver-major release.

## What’s next?

First, it would be useful for Node.js to accept the new `--profile-heap-snapshot` flag in `NODE_OPTIONS`. In some use cases, users cannot control the the command line options passed to Node.js directly and have to configure them through the environment variable `NODE_OPTIONS`. Today, Node.js filters V8 command line options set in the environment variable, and only allows a known subset, which could make it harder to test new V8 flags in Node.js, as what happened in our case.

Information accuracy in snapshots can be improved further. Today, each script source code line information is stored in a representation in the V8 heap itself. And that’s a problem because we want to measure the heap precisely without the performance measurement overhead affecting the subject we are observing. Ideally, we would store the cache of line information outside the V8 heap in order to make heap snapshot information more accurate.

Finally, now that we improved the generation phase, the biggest cost is now the serialization phase. Further analysis may reveal new optimization opportunities in serialization.

## The end

This work was possible thanks to the sponsorship of [Igalia](https://www.igalia.com) and [Bloomberg](https://techatbloomberg.com).
