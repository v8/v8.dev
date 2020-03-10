---
title: 'Pointer Compression in V8'
author: 'Igor Sheludko and Santiago Aboy Solanes, *the* pointer compressors'
avatars:
  - 'igor-sheludko'
  - 'santiago-aboy-solanes'
date: 2020-03-17
tags:
  - internals
  - memory
description: 'Learn how we reduced our heap size up to 43% in the deep dive of Pointer Compression in V8!'
tweet: ''
---

<style type="text/css">@import url('http://fonts.googleapis.com/css?family=Gloria+Hallelujah');</style>

## Motivation

Back in 2014 Chrome switched from being a 32-bit process to being a 64-bit process. The reasons were [security, stability and performance](https://blog.chromium.org/2014/08/64-bits-of-awesome-64-bit-windows_26.html) (x64 architecture provides more registers than x86). However, this came at a memory price since each pointer across the whole Chrome now occupies 8 bytes instead of 4.

As of today, memory consumption in Chrome is still not perfect — we’ve all seen the memes — and it is something we at V8 (and Chrome in general) are always trying to improve.

When you browse with Chrome, it spins up several processes which communicate with each other. One kind of these processes is the so-called renderer process, which is responsible for displaying a web page in a tab, processing user interactions with the page and running the page’s JavaScript code.

If we take a closer look at the renderer process’s memory consumption, we might notice that on certain websites V8 contributes up to 60% of the renderer process memory consumption on desktop, and up to 36% on mobile. The difference between desktop and mobile can be explained by the fact that websites usually send more lightweight pages to mobile devices, which are assumed to be less powerful than desktop ones.

<figure>
  <img src="/_img/pointer-compression/memory-chrome.svg" width="845" height="522" alt="Chrome's renderer process’s memory consumption" loading="lazy">
  <figcaption>Chrome's renderer process’s memory consumption</figcaption>
</figure>

There are multiple ongoing efforts in V8 aimed at reducing memory consumption, and one of the approaches we have been thinking about for a long time now is Pointer Compression.

The idea is very simple - instead of storing 64-bit pointers we can store 32-bit offsets from some “base” address. We’re not the first ones with this idea, and similar approaches have already been implemented in other managed runtimes, like Oracle HotSpot JVM [[1]](#related-work) and IBM J9 JVM [[2]](#related-work). But, how much can we gain from such a compression in V8?

The V8 heap contains a whole slew of items, such as floating point values, string characters, interpreter bytecode, compiled code, pointers into the C++ heap — and in particular tagged values, which represent either pointers into the V8 heap or small integers. Upon inspection of the heap, we discovered that on real-world web sites these tagged values occupy around 70% of the V8 heap!

Let’s take a closer look at tagged values.

### Value tagging in V8
JavaScript values in V8, whether they are objects, arrays, numbers or strings, are represented as objects and allocated storage in the V8 heap. This allows us to represent any value as a pointer to this object. However, many JavaScript programs perform calculation on integer values, such as incrementing an index in a loop. To avoid us having to allocate new number storage each time an integer is incremented, V8 uses a well-known [pointer tagging](https://en.wikipedia.org/wiki/Tagged_pointer) technique to store additional or alternative data in V8 heap pointers. The tagged values thus serve a dual purpose: they are either strong/weak pointers to objects located in V8 heap, or a so-called small integer (“Smi”). Thanks to this, the value of an integer can be stored directly in the tagged value, without having to allocate additional storage for it.

V8 always allocates objects in the heap at word-aligned addresses, which allows to use the 2 or 3 least significant bits for tagging (depending on the machine word size). On 32-bit architectures, V8 uses the least significant bit to distinguish small integers (Smis) from heap object pointers, and for heap pointers uses the second least significant bit to distinguish strong references from weak ones:

<pre>
                        |----- 32 bits -----|
Pointer:                |_____address_____<b>w1</b>|
Smi:                    |___int31_value____<b>0</b>|
</pre>

where w is a bit used for distinguishing strong pointers from the weak ones.

Note that a Smi value can only carry a 31-bit payload, including the sign bit. In the case of pointers, we have 30 bits that can be used as a heap object address payload. Due to word alignment, the allocation granularity is 4 bytes, which gives us 4 GB of addressable space.

On 64-bit architectures V8 values look like this:

<pre>
            |----- 32 bits -----|----- 32 bits -----|
Pointer:    |________________address______________<b>w1</b>|
Smi:        |____int32_value____|000000000000000000<b>0</b>|
</pre>

You may notice that unlike 32-bit architectures, on 64-bit architectures V8 can use 32 bits for the Smi value payload. The benefits of 32-bit Smis will be discussed in the following sections.

### Compressed tagged values and new heap layout
With Pointer Compression, our goal is to somehow fit both kinds of tagged values on 64-bit architectures into 32 bits. We can fit Pointers into 32 bits by:
 * making sure all V8 objects are allocated within a 4Gb memory range
 * representing pointers as offsets within this range

Having such a hard limit is unfortunate, but V8 in Chrome already has a 2GB or 4GB “soft” limit on the size of the V8 heap (depending on how powerful the underlying device is), even on 64-bit architectures.

Other V8 embedders, such as Node.js, may require bigger heaps, and thus either the compression scheme has to be updated or V8 with full pointers has to be used.

So, now we have to do something about heap layout to ensure that 32-bit pointers will uniquely identify V8 objects.

#### Trivial heap layout
The trivial compression scheme would be to allocate objects in the first 4GB of address space.
<figure>
  <img src="/_img/pointer-compression/heap-layout-0.svg" width="827" height="260" alt="Trivial heap layout" loading="lazy">
  <figcaption>Trivial heap layout</figcaption>
</figure>

However, this is not an option for V8 since Chrome’s renderer process to may need to create multiple V8 instances in the same renderer process:
* One for the main JavaScript thread
* One per **Web/Service Worker**

And in this case the 4GB limit will be imposed for all the JavaScript instances together.

#### Heap layout, v1
But if we just arrange V8 heap in a contiguous 4GB region of address space somewhere else then an **unsigned** 32-bit offset from the base will uniquely identify the pointer.

<figure>
  <img src="/_img/pointer-compression/heap-layout-1.svg" width="827" height="323" alt="Heap layout, base aligned to start" loading="lazy">
  <figcaption>Heap layout, base aligned to start</figcaption>
</figure>

If we also ensure that the base is 4GB-aligned then the upper 32 bits will be the same for all pointers:
```
            |----- 32 bits -----|----- 32 bits -----|
Pointer:    |________base_______|______offset_____w1|
```

We can also make Smis them compressible by limiting the Smi payload to 31 bits and arithmetically shifting it to the lower 32 bits.
```
         |----- 32 bits -----|----- 32 bits -----|
Smi:     |sssssssssssssssssss|____int31_value___0|
```

where s is the sign value of the Smi payload. We need this sign-extended representation in order to be able to convert Smi to int64_t (and back) with just a one-bit arithmetic shift of the 64-bit word.

Now, we can see that the upper half-word of both pointers and Smis is fully defined by the lower half-word, so we can store just the latter in memory, reducing the memory required for storing tagged value by half:
```
                    |----- 32 bits -----|----- 32 bits -----|
Compressed pointer:                     |______offset_____w1|
Compressed Smi:                         |____int31_value___0|
```

Given that the base is 4GB-aligned, the compression is just a truncation:

```cpp
uint64_t uncompressed_tagged;
uint32_t compressed_tagged = uint32_t(uncompressed_tagged);
```

The decompression code however, is a bit more complicated, as we need to distinguish between sign-extending the Smi and zero-extending the pointer, as well as whether or not to add in the base.

```cpp
uint32_t compressed_tagged;

uint64_t uncompressed_tagged;
if (compressed_tagged & 1) {
  // pointer case
  uncompressed_tagged = base + uint64_t(compressed_tagged);
} else {
  // Smi case
  uncompressed_tagged = int64_t(compressed_tagged);
}
```

Let’s try to change the compression scheme to simplify the decompression code.

#### Heap layout, v2
If instead we put the base in the _middle_ of the 4GB reservation, we can treat the compressed value as a **signed** 32-bit offset from the base.

<figure>
  <img src="/_img/pointer-compression/heap-layout-2.svg" width="827" height="363" alt="Heap layout, base aligned to the middle" loading="lazy">
  <figcaption>Heap layout, base aligned to the middle</figcaption>
</figure>

If we keep the base 4GB-aligned then the compression code will stay the same (note that this means that the reservation is not 4GB aligned anymore).

The decompression code, however, becomes nicer. Sign-extension is now common for both Smi and pointer cases and the only branch is on whether to add the base in the pointer case.

```cpp
int32_t compressed_tagged;

// Common code for both pointer and Smi cases
int64_t uncompressed_tagged = int64_t(compressed_tagged);
if (uncompressed_tagged & 1) {
  // pointer case
  uncompressed_tagged += base;
}
```

The performance of branches in code depends on the branch prediction unit in the CPU, and we thought that perhaps if we were to implement the decompression in a branchless way, we could get better performance. With a small amount of bit magic, we can write a branchless version of the code above:

```cpp
int32_t compressed_tagged;

// Same code for both pointer and Smi cases
int64_t sign_extended_tagged = int64_t(compressed_tagged);
int64_t selector_mask = -(sign_extended_tagged & 1);
// Mask will be 0 in case of Smi or all 1s in case of pointer
int64_t uncompressed_tagged =
    sign_extended_tagged + (base & selector_mask);
```

So we decided to start with the branchless implementation.

### Performance evolution
It took some time before we got a fully working Pointer Compression implementation in V8, passing all the tests and working in Chrome. However, we got there in the end, and finally we could start looking at the actual performance and quality of the code.

#### Initial performance
We measured performance on [Octane](https://v8.dev/blog/retiring-octane#the-genesis-of-octane) -- a peak-performance benchmark we have used in the past. Although we are no longer focusing on improving peak performance in our day-to-day work, we also don’t want to regress peak performance, particularly for something as performance-sensitive as _all pointers_. Octane continues to be a good benchmark for this task.

This graph shows Octane's score on x64 architecture while we were optimizing and polishing the Pointer Compression implementation.

<figure>
  <img src="/_img/pointer-compression/perf-octane-1.svg" width="913" height="218" alt="First round of Octane's improvements" loading="lazy">
  <figcaption>First round of Octane's improvements</figcaption>
</figure>

In the graph, higher is better. The red line is the existing full-sized-pointer x64 build, while the green line is the pointer compressed version.

With the first working implementation, we had a ~35% regression gap.
##### Bump (1), +7%
First we validated our “branchless is faster” hypothesis, by comparing the branchless decompression with the branchful one. It turned out that our hypothesis was wrong, and the branchful version was 7% faster on x64. That was quite a significant difference!

Let’s take a look at the x64 assembly.

TODO: Is there a way to not have a line on each line? As in, the code is one big cell
TODO: Is there a way to align text to the top?

:::table-wrapper
| Decompression | Branchless              | Branchful                    |
|---------------|-------------------------|------------------------------|
| Code          | ```movsxlq r11,[...]```<br>```movl r10,r11```<br>```andl r10,0x1```<br>```negq r10```<br>```andq r10,r13```<br>```addq r11,r10``` | ```movsxlq r11,[...]```<br>```testb r11,0x1```<br>```jz done```<br>```addq r11,r13```<br>```done:``` |
| Summary       | 20 bytes<br>6 instructions executed<br>no branches<br>1 additional register<br> | 13 bytes<br>3 or 4 instructions executed<br>1 branch |
:::

**r13** here is a dedicated register used for the base value. Notice how the branchless code is both bigger, and requires more registers.

On Arm64 we observed the same - the branchful version was clearly faster on powerful CPUs
(although the code size was the same for both cases).

:::table-wrapper
| Decompression | Branchless              | Branchful                    |
|---------------|-------------------------|------------------------------|
| Code          | ```ldur w6, [...]```<br>```sbfx x16, x6, #0, #1```<br>```and x16, x16, x26```<br>```add x6, x16, w6, sxtw``` | ```ldur w6, [...]```<br>```sxtw x6, w6```<br>```tbz w6, #0, #done```<br>```add x6, x26, x6```<br>```done:``` |
| Summary       | 16 bytes<br>4 instructions executed<br>no branches<br>1 additional register<br> | 16 bytes<br>3 or 4 instructions executed<br>1 branch |
:::

On low-end Arm64 devices we observed almost no performance difference in either direction.

The takeaway is: It seems that branch predictors in modern CPUs are very good and code size (particularly execution path length) affected performance more.
##### Bump (2), +2%
[TurboFan](https://v8.dev/docs/turbofan) is V8’s optimizing compiler, built around a concept called “Sea of Nodes”. This page outlines a [high-level overview of TurboFan](https://v8.dev/blog/turbofan-jit), but in short, each operation is represented as a node in a graph. These nodes have various dependencies, including both data-flow and control-flow.

There are two operations that are crucial for Pointer Compression: Loads and Stores. If  we were to decompress every time we loaded a compressed value from the heap, and compress it before we store it, then the pipeline could just keep working as it otherwise did in full-pointer mode. Thus we added new explicit value operations in the node graph - Decompress and Compress.

Obviously, there are cases where the decompression is not actually necessary. A trivial example is when a compressed value is loaded from somewhere and then stored to a new location. There are also more complicated examples.

In order to optimize unnecessary operations, we implemented a new “Decompression Elimination” phase in TurboFan. Its job is to eliminate decompressions directly followed by compressions. Since these nodes might not be directly next to each other it also tries to propagate decompressions through the graph, with the hope of encountering a compress down the line and eliminate them both. This gave us a 2% improvement (2) of Octane’ score.
##### Bump (3), +2%
While we were looking at the generated code, we noticed that the decompression of a value that had just been loaded produced code that was a bit too verbose:
```
movl rax, <mem>   // load
movlsxlq rax, rax // sign extend
```

Once we fixed that to sign extend the value loaded from memory directly:
```
movlsxlq rax, <mem>
```
we got yet another 2% improvement (3).
##### Bump (4), +11%
TurboFan optimization phases work by using pattern matching on the graph: once a sub-graph matches a certain pattern it is replaced with a semantically equivalent (but more optimal) sub-graph or instruction. 

Unsuccessful attempts to find a match are not a failure, and therefore the presence of explicit Decompress/Compress operations in the graph caused previously successful pattern matching attempts to no longer succeed, which resulted in optimizations silently failing.

One example of a “broken” optimization was allocation preternuring (see [the paper](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43823.pdf) for details). Once we updated the pattern matching to be aware of the new compression/decompression nodes we got another 11% improvement (4).

<figure>
  <img src="/_img/pointer-compression/perf-octane-2.svg" width="859" height="178" alt="Second round of Octane's improvements" loading="lazy">
  <figcaption>Second round of Octane's improvements</figcaption>
</figure>

##### Bump (5), +0.5%
While implementing the Decompression Elimination in TurboFan we learned a lot. The explicit Decompression/Compression node approach had the following properties:

Pros: 
* Explicitness of such operations allowed us to optimize unnecessary decompressions by doing canonical pattern matching of sub-graphs

But, as we continued the implementation, we discovered cons:
* A combinatorial explosion of possible conversion operations because of new internal value representations, which could now be compressed pointer, compressed Smi, and compressed any, in addition to the existing set of representations (Smi, tagged pointer, tagged any, word8, word16, word32, word64, float32, float64, simd128), became unmanageable
* Some existing optimizations based on graph pattern-matching silently didn’t fire, which caused regressions here and there. Although we found and fixed some of them, the complexity of TurboFan continued to increase.
* The register allocator was increasingly unhappy about the amount of nodes in the graph, and quite often generated bad code
* The larger node graphs slowed the TurboFan optimization phases, and increased memory consumption during compilation

So, we decided to take a step back and think of a simpler way of supporting Pointer Compression in TurboFan. 

In short, the new approach is to drop all explicit Compression/Decompression nodes and Compressed Pointer/Smi/Any representations completely. Instead, we assume that the semantics are “uncompress-on-load / compress-on-store”, and we set a “should-decompress”/”should-compress” flag on the Load and Store nodes directly. Such an approach significantly reduced the complexity of Pointer Compression support in TurboFan and improved the quality of generated code.

The new implementation (5) was as effective as the initial version and gave another 0.5% improvement.
##### Bump (6), +2.5%
We were getting close to parity, but the performance gap was still too big. At some point we came up with a new idea: what if we ensure that any code that deals with Smi values will never “look” at the upper 32 bits? Remember the decompression implementation:

```cpp
// Old decompression implementation
int64_t uncompressed_tagged = int64_t(compressed_tagged);
if (uncompressed_tagged & 1) {
  // pointer case
  uncompressed_tagged += base;
}
```

With the assumption that the upper bits of a Smi are undefined, we can avoid the special casing between the pointer and Smi cases and unconditionally add the base when decompressing.

```cpp
// New decompression implementation
int64_t uncompressed_tagged = base + int64_t(compressed_tagged);
```

Since we don’t care about sign extending the Smi, this change also allows us to return to heap layout v1 (with the base pointing to the beginning of the 4GB reservation).

<figure>
  <img src="/_img/pointer-compression/heap-layout-1.svg" width="827" height="323" alt="Heap layout, base aligned to start" loading="lazy">
  <figcaption>Heap layout, base aligned to start</figcaption>
</figure>

In terms of the decompression code, this changes a sign-extension operation to a zero-extension, which is just as cheap. However, this simplifies things on the runtime (C++) side: for example, the address space region reservation code (see implementation details section).

Here’s the assembly code for comparison:
:::table-wrapper
| Decompression | Branchless              | Branchful                    |
|---------------|-------------------------|------------------------------|
| Code          | ```movsxlq r11,[...]```<br>```testb r11,0x1```<br>```jz done```<br>```addq r11,r13```<br>```done:``` | ```movl r11,[rax+0x13]```<br>```addq r11,r13``` |
| Summary       | 13 bytes<br>3 or 4 instructions executed<br>1 branch | 7 bytes<br>2 instructions executed<br>no branches |
:::

So, we adapted all the Smi-using code pieces in V8 to the new compression scheme (6), which gave us another 2.5% improvement.

#### Remaining gap
The remaining performance gap is explained by two optimizations for 64-bit builds that we had to disable due to fundamental incompatibility with Pointer Compression.

<figure>
  <img src="/_img/pointer-compression/perf-octane-3.svg" width="858" height="300" alt="Final round of Octane's improvements" loading="lazy">
  <figcaption>Final round of Octane's improvements</figcaption>
</figure>

##### 32-bit Smi optimization (7), -1%
Let’s recall what Smis look like in full pointer mode on 64-bit architectures.

```
        |----- 32 bits -----|----- 32 bits -----|
Smi:    |____int32_value____|0000000000000000000|
```

32-bit Smi has the following benefits:
1) it can represent a bigger range of integers without the need to box them into number objects
2) such a shape provides direct access to the 32-bit value when reading/writing

This optimization can’t be done with Pointer Compression, because there’s no space in the 32-bit compressed pointer for the bit which distinguishes pointers from Smis. If we disable it in the full-pointer 64-bit version we see a 1% regression of the Octane score.

##### Double field unboxing (8), -3%
This optimization tries to store floating point values directly in the object’s fields under certain assumptions, to reduce the amount of number object allocations even more than Smis do alone.

Imagine the following JavaScript code:
```javascript
function Point(x, y) {
  this.x = x;
  this.y = y;
}
let p = new Point(3.1, 5.3);
```
Generally speaking, if we look at how the object **p** looks like in memory, we’ll see something like this: 

<figure>
  <img src="/_img/pointer-compression/heap-point-1.svg" width="832" height="232" alt="Object p in memory" loading="lazy">
  <figcaption>Object p in memory</figcaption>
</figure>

You can read more about hidden classes and properties and elements backing stores in [this article](https://v8.dev/blog/fast-properties).

On 64-bit architectures, double values are the same size as pointers. So, if we assume that Point’s fields always contain number values, we can store them directly in the object fields.

<figure>
  <img src="/_img/pointer-compression/heap-point-2.svg" width="832" height="112" alt="" loading="lazy">
</figure>

If the assumption breaks for some field, say after executing this line
```javascript
let q = new Point(2, “ab”);
```
then number values must be stored boxed instead, and if there is speculatively-optimized code somewhere that relied on this assumption it must no longer be used and must be thrown away (deoptimized).

<figure>
  <img src="/_img/pointer-compression/heap-point-3.svg" width="832" height="262" alt="Objects p and q in memory" loading="lazy">
  <figcaption>Objects p and q in memory</figcaption>
</figure>

If applicable, double field unboxing gives the following benefits:
* It provides direct access to the floating point data through the object pointer, avoiding the additional dereference via number object,
* This allows us to generate smaller and faster optimized code for tight loops doing a lot of double field accesses (for example in number-crunching applications)

With Pointer Compression enabled, the double values simply do not fit into the compressed fields anymore. However, in the future we may adapt this optimization for Pointer Compression.

Note that number-crunching code which requires high throughput could be rewritten in an optimizable way even without this double field unboxing optimization (in a way compatible with Pointer Compression), by storing data in Float64 TypedArrays, or even by using [Wasm](https://webassembly.github.io/spec/core/).

##### More improvements (9), 1%
Finally, a bit of fine-tuning of the decompression elimination optimization gave another 1% performance improvement.

### Some implementation details
In order to simplify integration of Pointer Compression into existing code we decided to decompress values on every load and to compress them on every store thus changing only storage format of tagged values while keeping the execution format unchanged.

#### Native code side
In order to be able to generate efficient code when decompression is required the base value must always be available. Luckily V8 already had a dedicated register always pointing to a “roots table” containing references to JavaScript and V8-internal objects which must be always available (for example, undefined, null, true, false and many more). This register is called “root register” and it is used for generating smaller and [shareable builtins code](https://v8.dev/blog/embedded-builtins). 
So, we put the roots table into the V8 heap reservation area and thus the root register became usable for both purposes - as a root pointer and as a base value for decompression.

#### C++ side
V8 runtime accesses objects in V8 heap through C++ classes providing a convenient view on the data stored in the heap. Note that V8 objects are rather POD-like structures than a C++ objects. The helper “view” classes contain just one uintptr_t field with a respective tagged value. Since the view classes are word-sized we can pass them around by value with zero overhead (many thanks to modern C++ compilers). 

Here is an pseudo example of a helper class:

```cpp
// Hidden class
class Map {
 public:
  ...
  inline DescriptorArray instance_descriptors() const;
  ...
  // The actual tagged pointer value stored in the Map view object.
  const uintptr_t ptr_;
};

DescriptorArray Map::instance_descriptors() const {
  uintptr_t field_address =
      FieldAddress(ptr_, kInstanceDescriptorsOffset);

  uintptr_t da = *reinterpret_cast<uintptr_t*>(field_address);
  return DescriptorArray(da);
}
```

In order to minimize the number of changes required for a first run of pointer compressed version we integrated computation of a base value required for decompression into getters.

```cpp
inline uintptr_t GetBaseForPointerCompression(uintptr_t address) {
  // Round address down to 4GB
  const uintptr_t kBaseAlignment = 1 << 32;
  return address & -kBaseAlignment;
}

DescriptorArray Map::instance_descriptors() const {
  uintptr_t field_address =
      FieldAddress(ptr_, kInstanceDescriptorsOffset);

  uint32_t compressed_da = *reinterpret_cast<uint32_t*>(field_address);

  uintptr_t base = GetBaseForPointerCompression(ptr_);
  uintptr_t da = base + compressed_da;
  return DescriptorArray(da);
}
```

Performance measurements confirmed that computation of base in every load hurts performance. The reason is that C++ compiler doesn’t know that the result of GetBaseForPointerCompression() call is the same for any address from V8 heap and thus the compiler is not able to merge computations of base values. Given that the code consists of several instructions and a 64-bit constant this results in a significant code bloat.

In order to address this issue we reused V8 instance pointer as a base for decompression (remember the V8 instance data in the heap layout). This pointer is usually available in runtime functions, so we simplified the getters code by requiring an V8 instance pointer and it recovered the regressions:

```cpp
DescriptorArray Map::instance_descriptors(const Isolate* isolate) const {
  uintptr_t field_address =
      FieldAddress(ptr_, kInstanceDescriptorsOffset);

  uint32_t compressed_da = *reinterpret_cast<uint32_t*>(field_address);

  // No rounding is needed since isolate pointer is already the base.  
  uintptr_t base = reinterpret_cast<uintptr_t>(isolate);
  uintptr_t da = DecompressTagged(base, compressed_value);
  return DescriptorArray(da);
}
```
## Results
Let’s take a look at Pointer Compression’s final numbers!

We use a set of web pages for measuring our memory and performance metrics that reflect popular real-world websites. In them, we observed that Pointer Compression reduces V8 heap size up to 43%!

In turn, it reduces Chrome’s renderer process memory by 20% on Desktop and 10% in Mobile. This difference appears due to V8 being a lower percentage of the renderer process memory on Mobile.

<figure>
  <img src="/_img/pointer-compression/V8-heap-memory.svg" width="600" height="371" alt="Memory savings when browsing in Windows 10" loading="lazy">
  <figcaption>Memory savings when browsing in Windows 10</figcaption>
</figure>

We are proud to announce that these memory improvements came hand in hand with performance improvements. On real websites we utilize less CPU and garbage collector time!

:::table-wrapper
|             | V8’s time | Desktop     | Mobile      |
|-------------|-----------|-------------|-------------|
| Facebook    | CPU<br>GC | -8%<br>-10% | -6%<br>-17% |
| CNN         | CPU<br>GC | -3%<br>-14% | -8%<br>-20% |
| Google Maps | CPU<br>GC | -4%<br>-7%  | -6%<br>-12% |
:::

## Conclusion
The journey to get here was no bed of roses but it was worth our while. [300+ commits](https://github.com/v8/v8/search?o=desc&q=repo%3Av8%2Fv8+%22%5Bptr-compr%5D%22&s=committer-date&type=Commits) later, V8 with Pointer Compression uses as much memory as if we were running a 32-bit application, while having the performance of a 64-bit one.

We are always looking forward to improving things, and have the following related tasks in our pipeline:
* Improve code quality: less size and better performance.
* Address related performance regressions, including re-implementing double field unboxing in a Pointer Compression friendly way.
* Explore the idea of supporting bigger heaps, in the 8 to 16 GB range.

## Related work
[1] [Compressed oops in the Hotspot JVM](https://wiki.openjdk.java.net/display/HotSpot/CompressedOops)
[2] [Compressed pointers support in IBM J9 VM. Whitepaper](ftp://public.dhe.ibm.com/software/webserver/appserv/was/WAS_V7_64-bit_performance.pdf)