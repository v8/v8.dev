---
title: 'A year with Spectre: a V8 perspective'
author: 'Ben L. Titzer and Jaroslav Sevcik'
avatars:
  - 'ben-titzer'
  - 'jaroslav-sevcik'
date: 2019-04-18 16:45:31
tags:
  - security
---
On January 3, 2018, Google Project Zero and others [disclosed](https://googleprojectzero.blogspot.com/2018/01/reading-privileged-memory-with-side.html) the first three of a new class of vulnerabilities that affect CPUs that perform speculative execution, dubbed [Spectre](https://spectreattack.com/spectre.pdf) and [Meltdown](https://meltdownattack.com/meltdown.pdf). Using the [speculative execution](https://en.wikipedia.org/wiki/Speculative_execution) mechanisms of CPUs, an attacker could temporarily bypass both implicit and explicit safety checks in code that prevent programs from reading unauthorized data in memory. While processor speculation was designed to be a microarchitectural detail, invisible at the architectural level, carefully crafted programs could read unauthorized information in speculation and disclose it through side channels such as the execution time of a program fragment.

When it was shown that JavaScript could be used to mount Spectre attacks, the V8 team became involved in tackling the problem. We formed an emergency response team and worked closely with other teams at Google, our partners at other browser vendors, and our hardware partners. In concert with them, we proactively engaged in both offensive research (constructing proof-of-concept gadgets) and defensive research (mitigations for potential attacks).

A Spectre attack consists of two parts:

1. _Leak of otherwise-inaccessible data into hidden CPU state._ All known Spectre attacks use speculation to leak bits of inaccessible data into CPU caches.
1. _Extract the hidden state_ to recover the inaccessible data. For this, the attacker needs a clock of sufficient precision. (Surprisingly low-resolution clocks can be sufficient, especially with techniques such as edge thresholding.)

In theory, it would be sufficient to defeat either of the two components of an attack. Since we do not know of any way to defeat any of the parts perfectly, we designed and deployed mitigations that greatly reduce the amount of information that is leaked into CPU caches _and_ mitigations that make it hard to recover the hidden state.

## High-precision timers

The tiny state changes that can survive speculative execution give rise to correspondingly tiny, almost impossibly tiny, timing differences — on the order of a billionth of a second. To directly detect individual such differences, an attacker program needs a high precision timer. CPUs offer such timers, but the Web Platform does not expose them. The Web Platform’s most precise timer, `performance.now()`, had a resolution of single-digit micro-seconds, which was originally thought unusable for this purpose. Yet two years ago, an academic research team specializing in micro-architectural attacks published [a paper](https://gruss.cc/files/fantastictimers.pdf) that studied the availability of timers in the web platform. They concluded that concurrent mutable shared memory and various resolution-recovery techniques could allow the construction of even higher resolution timers, down to nanosecond resolution. Such timers are precise enough to detect individual L1 cache hits and misses, which is usually how Spectre gadgets leak information.

## Timer mitigations

To disrupt the ability to detect small timing differences, browser vendors took a multi-pronged approach. On all browsers, the resolution of `performance.now()` was reduced (in Chrome, from 5 microseconds to 100), and random uniform jitter was introduced to prevent resolution recovery. After consultation among all the vendors, together we decided to take the unprecedented step of immediately and retroactively disabling the `SharedArrayBuffer` API across all browsers in order to prevent the construction of a nanosecond timer that could be used for Spectre attacks.

## Amplification

It became clear early on in our offensive research that timer mitigations alone would not be sufficient. One reason why is that an attacker may simply repeatedly execute their gadget so that the cumulative time difference is much larger than a single cache hit or miss. We were able to engineer reliable gadgets that use many cache lines at a time, up to the cache capacity, yielding timing differences as large as 600 microseconds. We later discovered arbitrary amplification techniques that are not limited by the cache capacity. Such amplification techniques rely on multiple attempts to read the secret data.

## JIT mitigations

To read inaccessible data using Spectre, the attacker tricks the CPU into speculatively executing code that reads normally inaccessible data and encodes it into the cache. The attack can be broken in two ways:

1. Prevent speculative execution of code.
1. Prevent speculative execution from reading inaccessible data.

We have experimented with (1) by inserting the recommended speculation barrier instructions, such as Intel’s `LFENCE`, on every critical conditional branch, and by using [retpolines](https://support.google.com/faqs/answer/7625886) for indirect branches. Unfortunately, such heavy-handed mitigations greatly reduce performance (2–3× slowdown on the Octane benchmark). Instead, we chose approach (2), inserting mitigation sequences that prevent reading secret data due to mis-speculation. Let us illustrate the technique on the following code snippet:

```js
if (condition) {
  return a[i];
}
```

For simplicity, let us assume condition is `0` or `1`. The code above is vulnerable if the CPU speculatively reads from `a[i]` when `i` is out-of-bounds, accessing normalling inaccessible data. The important observation is that in such case, the speculation tries to read `a[i]` when `condition` is `0`. Our mitigation rewrites this program so that it behaves exactly like the original program but does not leak any speculatively loaded data.

We reserve one CPU register which we call the poison to track whether code is executing in a mispredicted branch. The poison register is maintained across all branches and calls in generated code, so that any mispredicted branch causes the poison register to become `0`. Then we instrument all memory accesses so that they unconditionally mask the result of all loads with the current value of the poison register. This does not prevent the processor from predicting (or mispredicting) branches, but destroys the information of (potentially out-of-bounds) loaded values due to mispredicted branches. The instrumented code is shown below (assuming that `a` is a number array).

```js/0,3,4
let poison = 1;
// …
if (condition) {
  poison *= condition;
  return a[i] * poison;
}
```

The additional code does not have any effect on the normal (architecturally-defined) behavior of the program. It only affects micro-architectural state when running on speculating CPUs. If the program was instrumented at source level, advanced optimizations in modern compilers might remove such instrumentation. In V8, we prevent our compiler from removing the mitigations by inserting them in a very late phase of compilation.

We also use the poisoning technique to prevent leaks from misspeculated indirect branches in the interpreter’s bytecode dispatch loop and in the JavaScript function call sequence. In the interpreter, we set the poison to 0 if the bytecode handler (i.e. the machine code sequence that interprets a single bytecode) does not match the current bytecode. For JavaScript calls, we pass the target function as a parameter (in a register) and we set the poison to `0` at the beginning of each function if the incoming target function does not match the current function. With the poisoning mitigations in place, we see less than 20% slowdown on the Octane benchmark.

The mitigations for WebAssembly are simpler, since the main safety check is to ensure memory accesses are within bounds. For 32-bit platforms, in addition to the normal bounds checks, we pad all memories to the next power of two and unconditionally mask off any upper bits of a user-supplied memory index. 64-bit platforms need no such mitigation, since the implementation uses virtual memory protection for bounds checks. We experimented with compiling switch/case statements to binary search code rather than using a potentially vulnerable indirect branch, but this is too expensive on some workloads. Indirect calls are protected with retpolines.

## Software mitigations are an unsustainable path

Fortunately or unfortunately, our offensive research advanced much faster than our defensive research, and we quickly discovered that software mitigation of all possible leaks due to Spectre was infeasible. This was due to a variety of reasons. First, the engineering effort diverted to combating Spectre was disproportionate to its threat level. In V8 we face many other security threats that are much worse, from direct out-of-bound reads due to regular bugs (faster and more direct than Spectre), out-of-bound writes (impossible with Spectre, and worse) and potential remote code execution (impossible with Spectre and much, much worse). Second, the increasingly complicated mitigations that we designed and implemented carried significant complexity, which is technical debt and might actually increase the attack surface, and performance overheads. Third, testing and maintaining mitigations for microarchitectural leaks is even trickier than designing gadgets themselves, since it’s hard to be sure the mitigations continue working as designed. At least once, important mitigations were effectively undone by later compiler optimizations. Fourth, we found that effective mitigation of some variants of Spectre, particularly variant 4, to be simply infeasible in software, even after a heroic effort by our partners at Apple to combat the problem in their JIT compiler.

## Site isolation

Our research reached the conclusion that, in principle, untrusted code can read a process’s entire address space using Spectre and side channels. Software mitigations reduce the effectiveness of many potential gadgets, but are not efficient or comprehensive. The only effective mitigation is to move sensitive data out of the process’s address space. Thankfully, Chrome already had an effort underway for many years to separate sites into different processes to reduce the attack surface due to conventional vulnerabilities. This investment paid off, and we productionized and deployed [site isolation](https://developers.google.com/web/updates/2018/07/site-isolation) for as many platforms as possible by May 2018. Thus Chrome’s security model no longer assumes language-enforced confidentiality within a renderer process.

Spectre has been a long journey and has highlighted the best in collaboration across vendors in the industry and academia. So far, white hats appear to be ahead of black hats. We still know of no attacks in the wild, outside of the curious tinkerers and professional researchers developing proof of concept gadgets. New variants of these vulnerabilities continue to trickle out, and may continue to do so for some time. We continue to track these threats and take them seriously.

Like many with a background in programming languages and their implementations, the idea that safe languages enforce a proper abstraction boundary, not allowing well-typed programs to read arbitrary memory, has been a guarantee upon which our mental models have been built. It is a depressing conclusion that our models were wrong — this guarantee is not true on today’s hardware. Of course, we still believe that safe languages have great engineering benefits and will continue to be the basis for the future, but… on today’s hardware they leak a little.

Interested readers can dig into more details in [our whitepaper](https://arxiv.org/pdf/1902.05178.pdf).
