---
title: 'Pointer compression in Oilpan'
author: 'Anton Bikineev, and Michael Lippautz ([@mlippautz](https://twitter.com/mlippautz)), walking disassemblers'
avatars:
  - anton-bikineev
  - michael-lippautz
date: 2022-11-28
tags:
  - internals
  - memory
  - cppgc
description: 'Pointer compression in Oilpan allows for compressing C++ pointers and reducing the heap size by up to 33%.'
tweet: '1597274125780893697'
---

> It is absolutely idiotic to have 64-bit pointers when I compile a program that uses less than 4 gigabytes of RAM. When such pointer values appear inside a struct, they not only waste half the memory, they effectively throw away half of the cache.
>
> – [Donald Knuth (2008)](https://cs.stanford.edu/~knuth/news08.html)


Truer words have (almost) never been spoken.  We also see CPU vendors not actually shipping [64-bit CPUs](https://en.wikipedia.org/wiki/64-bit_computing#Limits_of_processors) and Android OEMs [opting for only 39-bit of address space](https://www.kernel.org/doc/Documentation/arm64/memory.txt) to speed up page table walks in the Kernel.  V8 running in Chrome also [isolates sites into separate processes](https://www.chromium.org/Home/chromium-security/site-isolation/), which further limits the requirements of actual address space needed for a single tab.  None of this is completely new though, which is why we launched [pointer compression for V8 in 2020](https://v8.dev/blog/pointer-compression) and saw great improvements in memory across the web.  With the [Oilpan library](https://v8.dev/blog/oilpan-library) we have another building block of the web under control.  [Oilpan](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/cppgc/README.md) is a traced-based garbage collector for C++ which is among other things used to host the Document Object Model in Blink and thus an interesting target for optimizing memory.

## Background

Pointer compression is a mechanism to reduce the size of pointers on 64-bit platforms.  Pointers in Oilpan are encapsulated in a smart pointer called [`Member`](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/cppgc/member.h). In an uncompressed heap layout, `Member` references directly point to heap objects, i.e., 8 bytes of memory are used per reference. In such a scenario, the heap may be spread out over the whole address space as each pointer contains all the relevant information to refer to an object.

![Uncompressed heap layout](/_img/oilpan-pointer-compression/uncompressed-layout.svg)

With a compressed heap layout, `Member` references are only offsets into a heap cage, which is a contiguous region of memory.  The combination of a base pointer (base) that points to the beginning of the heap cage and a Member forms a full pointer, very similar to how [segmented addressing](https://en.wikipedia.org/wiki/Memory_segmentation#Segmentation_without_paging) works.  The size of a heap cage is limited by the available bits for the offset. E.g., a 4GB heap cage requires 32-bit offsets.

![Compressed heap layout](/_img/oilpan-pointer-compression/compressed-layout.svg)

Conveniently, Oilpan heaps are already contained in such a 4GB heap cage on 64-bit platforms, to allow referring to garbage collection metadata by just aligning any valid heap pointer down to the closest 4GB boundary.

Oilpan also supports multiple heaps in the same process to, e.g., support web workers with their own C++ heaps in Blink.  The problem arising from this setup is how to map heaps to possibly many heap cages.  Since heaps are bound to native threads in Blink, the solution at hand here is to refer to heap cages via a thread-local base pointer.  Depending on how V8 and its embedders are compiled, the thread local storage (TLS) model can be restricted to speed up how the base is loaded from memory.  Ultimately, the most generic TLS mode is required though to support Android, as on this platform the renderer (and thus V8) are loaded via `dlopen`.  It is such restrictions that make the use of TLS infeasible from a performance perspective[^1].  In order to provide best performance, Oilpan, similar to V8, allocates all heaps into a single heap cage when using pointer compression.  While this does restrict overall memory available, we believe that this is currently acceptable given that pointer compression already aims at reducing memory.  If a single 4GB heap cage proves to be too restrictive, the current compression scheme allows to increase the heap cage size to 16GB without sacrificing performance.

## Implementation in Oilpan

### Requirements

So far, we talked about a trivial encoding scheme where the full pointer is formed by adding a base to an offset that is stored in a Member pointer.  The actually implemented scheme is unfortunately not as simple though, as Oilpan requires that Member can be assigned one of the following:

1. A valid heap pointer to an object;
2. The C++ `nullptr` (or similar);
3. A sentinel value which must be known at compile time.  The sentinel value can e.g. be used to signal deleted values in hash tables that also support `nullptr` as entries.

The problematic part around `nullptr` and a sentinel is the lack of explicit types to catch these on the caller side:

```cpp
void* ptr = member.get();
if (ptr == nullptr) { /* ... * }
```

Since there’s no explicit type to store a possibly compressed `nullptr` value, an actual decompression is required to compare against the constant.

Having this usage in mind, we were looking for a scheme that transparently handles case 1.-3. Since the compression and decompression sequence will be inlined everywhere Member is used, the following properties are also desirable:

- Fast and compact instruction sequence to minimize icache misses.
- Branchless instruction sequence to avoid using up branch predictors.

Since it is expected that reads significantly outnumber writes, we allow for an asymmetric scheme where fast decompression is preferred.

### Compression and decompression

For brevity, this description only covers the final compression scheme used. See our [design doc](https://docs.google.com/document/d/1neGN8Jq-1JLrWK3cvwRIfrSjLgE0Srjv-uq7Ze38Iao) for more information on how we got there and the alternatives considered.

The main idea for the scheme that is implemented as of today is to separate regular heap pointers from `nullptr` and sentinel by relying on alignment of the heap cage.  Essentially, the heap cage is allocated with alignment such that the least significant bit of the upper halfword is always set.  We denote the upper and lower half (32 bits each) as U<sub>31</sub>...U<sub>0</sub> and L<sub>31</sub>...L<sub>0</sub>, respectively.

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
|              | upper half                               | lower half                                 |
| ------------ | ---------------------------------------: | -----------------------------------------: |
| heap pointer | <tt>U<sub>31</sub>...U<sub>1</sub>1</tt> | <tt>L<sub>31</sub>...L<sub>3</sub>000</tt> |
| `nullptr`    | <tt>0...0</tt>                           | <tt>0...000</tt>                           |
| sentinel     | <tt>0...0</tt>                           | <tt>0...010</tt>                           |
<!-- markdownlint-enable no-inline-html -->
:::

Compression generates a compressed value by merely right-shifting by one and truncating away the upper half of the value.  In this way, the alignment bit (which now becomes the most significant bit of the compressed value) signals a valid heap pointer.

:::table-wrapper
| C++                                             | x64 assembly  |
| :---------------------------------------------- | :------------ |
| ```cpp                                          | ```asm        \
| uint32_t Compress(void* ptr) {                  | mov rax, rdi  \
|   return ((uintptr_t)ptr) >> 1;                 | shr rax       \
| }                                               | ```           \
| ```                                             |               |
:::

The encoding for compressed values is thus as follows:

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
|              | compressed value                           |
| ------------ | -----------------------------------------: |
| heap pointer | <tt>1L<sub>31</sub>...L<sub>2</sub>00</tt> |
| `nullptr`    | <tt>0...00</tt>                            |
| sentinel     | <tt>0...01</tt>                            |
<!-- markdownlint-enable no-inline-html -->
:::

Note that this allows for figuring out whether a compressed value represents a heap pointer, `nullptr`, or the sentinel value, which is important to avoid useless decompressions in user code (see below).

The idea for decompression then is to rely on a specifically crafted base pointer, in which the least significant 32 bits are set to 1.

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
|              | upper half                               | lower half     |
| ------------ | ---------------------------------------: | -------------: |
| base         | <tt>U<sub>31</sub>...U<sub>1</sub>1</tt> | <tt>1...1</tt> |
<!-- markdownlint-enable no-inline-html -->
:::


The decompression operation first sign extends the compressed value and then left-shifts to undo the compression operation for the sign bit. The resulting intermediate value is encoded as follows

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
|              | upper half     | lower half                                 |
| ------------ | -------------: | -----------------------------------------: |
| heap pointer | <tt>1...1</tt> | <tt>L<sub>31</sub>...L<sub>3</sub>000</tt> |
| `nullptr`    | <tt>0...0</tt> | <tt>0...000</tt>                           |
| sentinel     | <tt>0...0</tt> | <tt>0...010</tt>                           |
<!-- markdownlint-enable no-inline-html -->
:::

Finally, the decompressed pointer is just the result of a bitwise and between this intermediate value and the base pointer.

:::table-wrapper
| C++                                                    | x64 assembly       |
| :----------------------------------------------------- | :----------------- |
| ```cpp                                                 | ```asm             \
| void* Decompress(uint32_t compressed) {                | movsxd rax, edi    \
|   uintptr_t intermediate =                             | add rax, rax       \
|       (uintptr_t)((int32_t)compressed) << 1;           | and rax, qword ptr \
|   return (void*)(intermediate & base);                 |     [rip + base]   \
| }                                                      | ```                \
| ```                                                    |                    |
:::

The resulting scheme handles cases 1.-3. transparently via a branchless asymmetric scheme.  Compression uses 3 bytes, not counting the initial register move as the call would anyways be inlined.  Decompression uses 13 bytes, counting the initial sign-extending register move.

## Selected details

The previous section explained the compression scheme used.  A compact compression scheme is necessary to achieve high performance.  The compression scheme from above still resulted in observable regressions in Speedometer.  The following paragraphs explain a few more tidbits needed to improve performance of Oilpan to an acceptable level.

### Optimizing cage base load

Technically, in C++ terms, the global base pointer can’t be a constant, because it is initialized at runtime after `main()`, whenever the embedder initializes Oilpan.  Having this global variable mutable would inhibit the important const propagation optimization, e.g. the compiler cannot prove that a random call doesn’t modify the base and would have to load it twice:

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
| C++                        | x64 assembly                    |
| :------------------------- | :------------------------------ |
| ```cpp                     | ```asm                          \
| void foo(GCed*);           | baz(Member<GCed>):              \
| void bar(GCed*);           |   movsxd rbx, edi               \
|                            |   add rbx, rbx                  \
| void baz(Member<GCed> m) { |   mov rdi, qword ptr            \
|   foo(m.get());            |       [rip + base]              \
|   bar(m.get());            |   and rdi, rbx                  \
| }                          |   call foo(GCed*)               \
| ```                        |   and rbx, qword ptr            \
|                            |       [rip + base] # extra load \
|                            |   mov rdi, rbx                  \
|                            |   jmp bar(GCed*)                \
|                            | ```                             |
<!-- markdownlint-enable no-inline-html -->
:::

With some additional attributes we taught clang to treat the global base as constant and thereby indeed perform only a single load within a context.

### Avoiding decompression at all

The fastest instruction sequence is a nop! With that in mind, for many pointer operations redundant compressions and decompressions can easily be avoided. Trivially, we do not need to decompress a Member to check if it is nullptr. We do not need to decompress and compress when constructing or assigning a Member from another Member. Comparison of pointers is preserved by compression, so we can avoid transformations for them as well. The Member abstraction nicely serves us as a bottleneck here.

Hashing can be sped up with compressed pointers. Decompression for hash calculation is redundant, because the fixed base does not increase the hash entropy. Instead, a simpler hashing function for 32-bit integers can be used. Blink has many hash tables that use Member as a key; the 32-bit hashing resulted in faster collections!

### Helping clang where it fails to optimize

When looking into the generated code we found another interesting place where the compiler did not perform enough optimizations:

:::table-wrapper
| C++                               | x64 assembly               |
| :-------------------------------- | :------------------------- |
| ```cpp                            | ```asm                     \
| extern const uint64_t base;       | Assign(unsigned int):      \
| extern std::atomic_bool enabled;  |   mov dword ptr [rdi], esi \
|                                   |   mov rdi, qword ptr       \
| void Assign(uint32_t ptr) {       |       [rip + base]         \
|   ptr_ = ptr                      |   mov al, byte ptr         \
|   WriteBarrier(Decompress(ptr));  |       [rip + enabled]      \
| }                                 |   test al, 1               \
|                                   |   jne .LBB4_2 # very rare  \
| void WriteBarrier(void* ptr) {    |   ret                      \
|   if (LIKELY(                     | .LBB4_2:                   \
|       !enabled.load(relaxed)))    |   movsxd rax, esi          \
|     return;                       |   add rax, rax             \
|   SlowPath(ptr);                  |   and rdi, rax             \
| }                                 |   jmp SlowPath(void*)      \
| ```                               | ```                        |
:::

The generated code performs the base load in the hot basic block, even though the variable is not used in it and could be trivially sunk into the basic block below, where the call to `SlowPath()` is made and the decompressed pointer is actually used.  The compiler conservatively decided not to reorder the non-atomic load with the atomic-relaxed load, even though it would be perfectly legal with respect to the language rules.  We manually moved the decompression below the atomic read to make the assignment with the write-barrier as efficient as possible.


### Improving structure packing in Blink

It is hard to estimate the effect of halving Oilpan’s pointer size.  In essence it should improve memory utilization for “packed” data-structures, such as containers of such pointers. Local measurements showed an improvement of about 16% of Oilpan memory.  However, investigation showed that for some types we have not reduced their actual size but only increased internal padding between fields.

To minimize such padding, we wrote a clang plugin that automatically identified such garbage-collected classes for which reordering of the fields would reduce the overall class size.  Since there have been many of these cases across the Blink codebase, we applied the reordering to the most used ones, see the [design doc](https://docs.google.com/document/d/1bE5gZOCg7ipDUOCylsz4_shz1YMYG5-Ycm0911kBKFA).

### Failed attempt: limiting heap cage size

Not every optimization did work out well though.  In an attempt to optimize compression even further, we limited the heap cage to 2GB.  We made sure that the most significant bit of the lower halfword of the cage base is 1 which allowed us to avoid the shift completely.  Compression would become a simple truncation and decompression would be a simple load and a bitwise and.

Given that Oilpan memory in the Blink renderer takes on average less than 10MB, we assumed it would be safe to proceed with the faster scheme and restrict the cage size.  Unfortunately, after shipping the optimization we started receiving out-of-memory errors on some rare workloads.  We decided to revert this optimization.

## Results and future

Pointer compression in Oilpan was enabled by default in **Chrome 106**.  We have seen great memory improvements across the board:

:::table-wrapper
<!-- markdownlint-disable no-inline-html -->
| Blink memory | P50                                                 | P99                                               |
| -----------: | :-------------------------------------------------: | :-----------------------------------------------: |
| Windows      | **<span style="color:green">-21% (-1.37MB)</span>** | **<span style="color:green">-33% (-59MB)</span>** |
| Android      | **<span style="color:green">-6% (-0.1MB)</span>**   | **<span style="color:green">-8% (-3.9MB)</span>** |
<!-- markdownlint-enable no-inline-html -->
:::

The numbers reported represent the 50th and 99th percentile for Blink memory allocated with Oilpan across the fleet[^2].  The reported data shows the delta between Chrome 105 and 106 stable versions.  The absolute numbers in MB give an indication on the lower bound that users can expect to see.  The real improvements are generally a bit higher due to indirect effects on Chrome’s overall memory consumption.  The larger relative improvement suggests that packing of data is better in such cases which is an indicator that more memory is used in collections (e.g. vectors) that have good packing.  The improved padding of structures landed in Chrome 108 and showed another 4% improvement on Blink memory on average.

Because Oilpan is ubiquitous in Blink, the performance cost can be estimated on [Speedometer2](https://browserbench.org/Speedometer2.1/).  The [initial prototype](https://chromium-review.googlesource.com/c/v8/v8/+/2739979) based on a thread-local version showed a regression of 15%.  With all the aforementioned optimizations we did not observe a notable regression.

### Conservative stack scanning

In Oilpan the stack is conservatively scanned to find pointers to the heap. With compressed pointers this means we have to treat every halfword as a potential pointer. Moreover, during compression the compiler may decide to spill an intermediate value onto the stack, which means that the scanner must consider all possible intermediate values (in our compression scheme the only possible intermediate value is a truncated, but not yet shifted value). Scanning intermediates increased the number of false positives (i.e. halfwords that look like compressed pointers) which reduced the memory improvement by roughly 3% (the estimated memory improvement would otherwise be 24%).

### Other compression

We’ve seen great improvements by applying compression to V8 JavaScript and Oilpan in the past. We think the paradigm can be applied to other smart pointers in Chrome (e.g., `base::scoped_refptr`) that already point into other heap cages.  Initial experiments [showed](https://docs.google.com/document/d/1Rlr7FT3kulR8O-YadgiZkdmAgiSq0OaB8dOFNqf4cD8/edit) promising results.

Investigations also showed that a large portion of memory is actually held via vtables.  In the same spirit, we’ve thus [enabled](https://docs.google.com/document/d/1rt6IOEBevCkiVjiARUy8Ib1c5EAxDtW0wdFoTiijy1U/edit?usp=sharing) the relative-vtable-ABI on Android64, which compacts virtual tables, letting us save more memory and improve the startup at the same time.

[^1]: Interested readers can refer to Blink’s [`ThreadStorage::Current()`](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/heap/thread_state_storage.cc;drc=603337a74bf04efd536b251a7f2b4eb44fe153a9;l=19) to see the result of compiling down TLS access with different modes.
[^2]: The numbers are gathered through Chrome’s User Metrics Analysis framework.
