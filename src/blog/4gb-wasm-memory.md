---
title: 'Up to 4GB of memory in WebAssembly'
author: 'Andreas Haas, Jakob Kummerow, and Alon Zakai'
avatars:
  - 'andreas-haas'
  - 'jakob-kummerow'
  - 'alon-zakai'
date: 2020-05-14
tags:
  - WebAssembly
  - JavaScript
  - tooling
tweet: '1260944314441633793'
---

## Introduction

Thanks to recent work in Chrome and Emscripten, you can now use up to 4GB of memory in WebAssembly applications. That’s up from the previous limit of 2GB. It might seem odd that there was ever a limit - after all, no work was needed to allow people to use 512MB or 1GB of memory! - but it turns out that there are some special things happening in the jump from 2GB to 4GB, both in the browser and in the toolchain, which we’ll describe in this post.

## 32 bits

Some background before we get into more details: the new 4GB limit is the largest amount of memory possible with 32-bit pointers, which is what WebAssembly currently supports, known as “wasm32” in LLVM and elsewhere. There is work towards a “wasm64” ([“memory64”](https://github.com/WebAssembly/memory64/blob/master/proposals/memory64/Overview.md) in the wasm spec) in which pointers can be 64-bit and we would be able to make use of over 16 million terabytes of memory (!), but until then, 4GB is the most we can possibly hope to be able to access.

It seems like we should always have been able to access 4GB, since that’s what 32-bit pointers allow. Why then have we been limited to half that, just 2GB? There are multiple reasons, on both the browser and the toolchain side. Let’s start with the browser.

## Chrome/V8 work

In principle the changes in V8 sound simple: Just make sure that all code generated for WebAssembly functions, as well as all memory management code, uses unsigned 32-bit integers for memory indices and lengths, and we should be done. However, in practice, there's more to it than that! As WebAssembly memory can be exported to JavaScript as an ArrayBuffer, we also had to change the implementation of JavaScript ArrayBuffers, TypedArrays, and all Web APIs that use ArrayBuffers and TypedArrays, like Web Audio, WebGPU, and WebUSB.

The first issue we had to solve was that V8 used [Smis](https://v8.dev/blog/pointer-compression#value-tagging-in-v8) (i.e. 31 bit signed integers) for TypedArray indices and lengths, so the maximum size was actually 2<sup>30</sup>-1, or about 1GB. Additionally, it turns out that switching everything to 32-bit integers would not be enough, because the length of a 4GB memory actually does not fit into a 32-bit integer. To illustrate: in decimal, there are 100 numbers with two digits (0 through 99), but "100" itself is a three-digit number. Analogously, 4GB can be addressed with 32-bit addresses, but 4GB itself is a 33-bit number. We could have settled for a slightly lower limit, but as we had to touch all the TypedArray code anyway, we wanted to prepare it for even bigger future limits while we were at it. So we changed all code that deals with TypedArray indices or lengths to use 64-bit wide integer types, or JavaScript Numbers where interfacing with JavaScript is required. As an added benefit, this means that supporting even larger memories for wasm64 should be relatively straightforward now!

A second challenge was dealing with JavaScript's special-casing for Array elements, compared to regular named properties, which is reflected in our implementation of objects. (This is a rather technical issue to do with the JavaScript spec, so don’t worry if you don’t follow all the details.) Consider this example:

```js
console.log(array[5_000_000_000]);
```

If `array` is a plain JavaScript object or Array, then `array[5_000_000_000]` would be handled as a string-based property lookup. The runtime would look for a string-named property “5000000000”. If no such property can be found, it would walk up the prototype chain and look for that property, or eventually return `undefined` at the end of the chain. However, if `array` itself, or an object on its prototype chain, is a TypedArray, then the runtime must look for an indexed element at the index 5,000,000,000, or immediately return `undefined` if this index is out of bounds.

In other words, the rules for TypedArrays are quite different from normal Arrays, and the difference mostly manifests for huge indices. So as long as we only allowed smaller TypedArrays, our implementation could be relatively simple; in particular, looking at the property key just once was enough to decide whether the "indexed" or the "named" lookup path should be taken. To allow larger TypedArrays, we now have to make this distinction repeatedly as we walk up the prototype chain, which requires careful caching to avoid slowing down existing JavaScript code through repeated work and overhead.

## Toolchain work

On the toolchain side we had to do work as well, most of it on the JavaScript support code, not the compiled code in WebAssembly. The main issue was that Emscripten has always written memory accesses in this form:

```js
HEAP32[(ptr + offset) >> 2]
```

That reads 32 bits (4 bytes) as a signed integer from address `ptr + offset`. How this works is that `HEAP32` is an Int32Array, which means that each index in the array has 4 bytes. So we need to divide the byte address (`ptr + offset`) by 4 to get the index, which is what the `>> 2` does.

The problem is that `>>` is a *signed* operation! If the address is at the 2GB mark or higher, it will overflow the input into a negative number:

```js
// Just below 2GB is ok, this prints 536870911
console.log((2 * 1024 * 1024 * 1024 - 4) >> 2);
// 2GB overflows and we get -536870912 :(
console.log((2 * 1024 * 1024 * 1024) >> 2);
```

The solution is to do an *unsigned* shift, `>>>`:

```js
// This gives us 536870912, as we want!
console.log((2 * 1024 * 1024 * 1024) >>> 2);
```

Emscripten knows at compile time whether you may use 2GB or more memory (depending on the flags you use; see later for details). If your flags make 2GB+ addresses possible then the compiler will automatically rewrite all memory accesses to use `>>>` instead of `>>`, which includes not just `HEAP32` etc. accesses as in the examples above but also operations like `.subarray()` and `.copyWithin()`. In other words, the compiler will switch to use unsigned pointers instead of signed ones.

This transformation increases code size a little bit - one extra character in each shift - which is why we don’t do it if you aren’t using 2GB+ addresses. While the difference is typically less than 1%, it’s just unnecessary, and easy to avoid - and lots of small optimizations add up!

Other rare issues can arise in JavaScript support code. While normal memory accesses are handled automatically as described earlier, doing something like manually comparing a signed pointer to an unsigned one will (on address 2GB and above) return false. To find such issues we’ve audited Emscripten’s JavaScript and also run the test suite in a special mode where everything is placed at address 2GB or higher. (Note that if you write your own JavaScript support code you may have things to fix there as well, if you do manual things with pointers aside from normal memory accesses.)

## Trying it out

To test this, [get the latest Emscripten release](https://emscripten.org/docs/getting_started/downloads.html), or at least version 1.39.15. Then build with flags such as

```
emcc -s ALLOW_MEMORY_GROWTH -s MAXIMUM_MEMORY=4GB
```

Those enable memory growth, and allow the program to allocate all the way up to 4GB of memory. Note that by default you will only be able to allocate up to 2GB - you must explicitly opt in to using 2-4GB (this allows us to emit more compact code otherwise, by emitting `>>` instead of `>>>` as mentioned above).

Make sure to test on Chrome M83 (currently in Beta) or later. Please file issues if you find anything wrong!

## Conclusion

Support for up to 4GB memory is another step in making the web as capable as native platforms, allowing 32-bit programs to be able to use just as much memory as they would normally. By itself this doesn’t enable a completely new class of application, but it does enable higher-end experiences, such as a very large level in a game or manipulating large content in a graphical editor.

As mentioned earlier, support for 64-bit memory is also planned, which will allow accessing even more than 4GB. However, wasm64 will have the same downside as 64-bit does on native platforms, that pointers take twice as much memory. That’s why 4GB support in wasm32 is so important: We can access twice as much memory as before while code size remains as compact as wasm has always been!

As always, test your code on multiple browsers, and also remember that 2-4GB is a lot of memory! If you need that much you should use it, but don’t do so unnecessarily since there just won’t be enough free memory on many users’ machines. We recommend that you start with an initial memory that is as small as possible, and grow if necessary; and if you allow growth, gracefully handle the case of a `malloc()` failure.
