---
title: 'Static Roots: Objects with Compile-Time Constant Addresses'
author: 'Olivier Flückiger'
avatars:
  - olivier-flueckiger
date: 2024-02-05
tags:
  - JavaScript
description: "Static Roots makes the addresses of certain JS objects a compile-time constant."
tweet: ''
---

Did you ever wonder where `undefined`, `true`, and other core JavaScript objects come from? These objects are the atoms of any user defined object and need to be there first. V8 calls them immovable immutable roots and they live in their own heap – the read-only heap. Since they are used constantly, quick access is crucial. And what could be quicker than correctly guessing their memory address at compile time?

As an example, consider the extremely common `IsUndefined` [API function](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-value.h?q=symbol:%5Cbv8::Value::IsUndefined%5Cb%20case:yes). Instead of having to look up the address of the `undefined` object for reference, what if we could simply check if an object's pointer ends in, say, `0x61` to know if it is undefined. This is exactly what the V8’s *static roots* feature achieves. This post explores the hurdles we had to take to get there. The feature landed in Chrome 111 and brought performance benefits across the whole VM, particularly speeding up C++ code and builtin functions.

## Bootstrapping the Read-Only Heap

Creating the read-only objects takes some time, so V8 creates them at compile time. To compile V8, first a minimal proto-V8 binary called `mksnapshot` is compiled. This one creates all the shared read-only objects as well as the native code of builtin functions and writes them into a snapshot. Then, the actual V8 binary is compiled and bundled with the snapshot. To start V8 the snapshot is loaded into memory and we can immediately start using its content. The following diagram shows the simplified build process for the standalone `d8` binary.

![](/_img/static-roots/static-roots1.svg)

Once `d8` is up and running all the read-only objects have their fixed place in memory and never move. When we JIT code, we can e.g., directly refer to `undefined` by its address. However, when building the snapshot and when compiling the C++ for libv8 the address is not known yet. It depends on two things unknown at build time. First, the binary layout of the read-only heap and second, where in the memory space that read-only heap is located.

## How to Predict Addresses?

V8 uses [pointer compression](https://v8.dev/blog/pointer-compression). Instead of full 64 bit addresses we refer to objects by a 32 bit offset into a 4GB region of memory. For many operations such as property loads or comparisons, the 32 bit offset into that cage is all that is needed to uniquely identify an object. Therefore our second problem — not knowing where in the memory space the read-only heap is placed — is not actually a problem. We simply place the read-only heap at the start of every pointer compression cage thus giving it a known location. For instance of all objects in V8’s heap, `undefined` always has the smallest compressed address, starting at 0x61 bytes. That’s how we know that if the lower 32 bits of any JS object’s full address are 0x61, then it must be `undefined`.

This is already useful, but we want to be able to use this address in the snapshot and in libv8 – a seemingly circular problem. However, if we ensure that `mksnapshot` deterministically creates a bit identical read-only heap, then we can re-use these addresses across builds. To use them in libv8 itself, we basically build V8 twice:

![](/_img/static-roots/static-roots2.svg)

The first time round calling `mksnapshot` the only artifact produced is a file that contains the [addresses](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/roots/static-roots.h) relative to the cage base of every object in the read-only heap. In the second stage of the build we compile libv8 again and a flag ensures that whenever we refer to `undefined` we literally use `cage_base + StaticRoot::kUndefined` instead; the static offset of `undefined` of course being defined in the static-roots.h file. In many cases this will allow the C++ compiler creating libv8 and the builtins compiler in `mksnapshot` to create much more efficient code as the alternative is to always load the address from a global array of root objects. We end up with a `d8` binary where the compressed address of `undefined` is hardcoded to be `0x61`.

Well, morally this is how everything works, but practically we only build V8 once – ain’t nobody got time for this. The generated static-roots.h file is cached in the source repository and only needs to be recreated if we change the layout of the read-only heap.

## Further Applications

Speaking of practicalities, static roots enable even more optimizations. For instance we have since grouped common objects together allowing us to implement some operations as range checks over their addresses. For instance all string maps (i.e., the [hidden-class](https://v8.dev/docs/hidden-classes) meta objects describing the layout of different string types) are next to each other, hence an object is a string if its map has a compressed address between `0xdd` and `0x49d`. Or, truthy objects must have an address that is at least `0xc1`.

Not everything is about the performance of JITed code in V8. As this project has shown, a relatively small change to the C++ code can have significant impact too. For instance Speedometer 2, a benchmark which exercises the V8 API and the interaction between V8 and its embedder, gained about 1% in score on an M1 CPU thanks to static roots.
