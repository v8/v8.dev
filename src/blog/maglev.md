---
title: 'Maglev - V8’s Fastest Optimizing JIT'
author: '[Toon Verwaest](https://twitter.com/tverwaes), [Leszek Swirski](https://twitter.com/leszekswirski), [Victor Gomes](https://twitter.com/VictorBFG), Olivier Flückiger, Darius Mercadier, and Camillo Bruni — not enough cooks to spoil the broth'
avatars:
  - toon-verwaest
  - leszek-swirski
  - victor-gomes
  - olivier-flueckiger
  - darius-mercadier
  - camillo-bruni
date: 2023-12-05
tags:
  - JavaScript
description: "V8's newest compiler, Maglev, improves performance while reducing power consumption"
tweet: ''
---

In Chrome M117 we introduced a new optimizing compiler: Maglev. Maglev sits between our existing Sparkplug and TurboFan compilers, and fills the role of a fast optimizing compiler that generates good enough code, fast enough.


# Background

Until 2021 V8 had two main execution tiers: Ignition, the interpreter; and [TurboFan](/docs/turbofan), V8’s optimizing compiler focused on peak performance. All JavaScript code is first compiled to ignition bytecode, and executed by interpreting it. During execution V8 tracks how the program behaves, including tracking object shapes and types. Both the runtime execution metadata and bytecode are fed into the optimizing compiler to generate high-performance, often speculative, machine code that runs significantly faster than the interpreter can.

These improvements are clearly visible on benchmarks like [JetStream](https://browserbench.org/JetStream2.1/), a collection of traditional pure JavaScript benchmarks measuring startup, latency, and peak performance. TurboFan helps V8 run the suite 4.35x as fast! JetStream has a reduced emphasis on steady state performance compared to past benchmarks (like the [retired Octane benchmark](/blog/retiring-octane)), but due to the simplicity of many line items, the optimized code is still where most time is spent.

[Speedometer](https://browserbench.org/Speedometer2.1/) is a different kind of benchmark suite than JetStream. It’s designed to measure a web app’s responsiveness by timing simulated user interactions. Instead of smaller static standalone JavaScript apps, the suite consists of full web pages, most of which are built using popular frameworks. Like during most web page loads, Speedometer line items spend much less time running tight JavaScript loops and much more executing a lot of code that interacts with the rest of the browser.

TurboFan still has a lot of impact on Speedometer: it runs over 1.5x as fast! But the impact is clearly much more muted than on JetStream. Part of this difference results from the fact that full pages [just spend less time in pure JavaScript](/blog/real-world-performance#making-a-real-difference). But in part it’s due to the benchmark spending a lot of time in functions that don’t get hot enough to be optimized by TurboFan.

![Web performance benchmarks comparing unoptimized and optimized execution](/_img/maglev/I-IT.svg)

::: note
All the benchmark scores in this post were measured with Chrome 117.0.5897.3 on a 13” M2 Macbook Air.
:::

Since the difference in execution speed and compile time between Ignition and TurboFan is so large, in 2021 we introduced a new baseline JIT called [Sparkplug](/blog/sparkplug). It’s designed to compile bytecode to equivalent machine code almost instantaneously. 

On JetStream, Sparkplug improves performance quite a bit compared to Ignition (+45%). Even when TurboFan is also in the picture we still see a solid improvement in performance (+8%). On Speedometer we see a 41% improvement over Ignition, bringing it close to TurboFan performance, and a 22% improvement over Ignition + TurboFan! Since Sparkplug is so fast, we can easily deploy it very broadly and get a consistent speedup. If code doesn’t rely solely on easily optimized, long-running, tight JavaScript loops, it’s a great addition.

![Web performance benchmarks with added Sparkplug](/_img/maglev/I-IS-IT-IST.svg)

The simplicity of Sparkplug imposes a relatively low upper limit on the speedup it can provide though. This is clearly demonstrated by the large gap between Ignition + Sparkplug and Ignition + TurboFan.

This is where Maglev comes in, our new optimizing JIT that generates code that’s much faster than Sparkplug code, but is generated much faster than TurboFan can.


# Maglev: A Simple SSA-Based JIT compiler

When we started this project we saw two paths forward to cover the gap between Sparkplug and TurboFan: either try to generate better code using the single-pass approach taken by Sparkplug, or build a JIT with an intermediate representation (IR). Since we felt that not having an IR at all during compilation would likely severely restrict the compiler, we decided to go with a somewhat traditional static single-assignment (SSA) based approach, using a CFG (control flow graph) rather than TurboFan's more flexible but cache unfriendly sea-of-nodes representation.

The compiler itself is designed to be fast and easy to work on. It has a minimal set of passes and a simple, single IR that encodes specialized JavaScript semantics.


## Prepass

First Maglev does a prepass over the bytecode to find branch targets, including loops, and assignments to variables in loop. This pass also collects liveness information, encoding which values in which variables are still needed across which expressions. This information can reduce the amount of state that needs to be tracked by the compiler later.


## SSA

![A printout of the Maglev SSA graph on the command line](/_img/maglev/graph.svg)

Maglev does an abstract interpretation of the frame state, creating SSA nodes representing the results of expression evaluation. Variable assignments are emulated by storing those SSA nodes in the respective abstract interpreter register. In the case of branches and switches, all paths are evaluated.

When multiple paths merge, values in abstract interpreter registers are merged by inserting so-called Phi nodes: value nodes that know which value to pick depending on which path was taken at runtime.

Loops can merge variable values “back in time”, with the data flowing backwards from the loop end to the loop header, in the case when variables are assigned in the loop body. That’s where the data from the prepass comes in handy: since we already know which variables are assigned inside loops, we can pre-create loop phis before we even start processing the loop body. At the end of the loop we can populate the phi input with the correct SSA node. This allows the SSA graph generation to be a single forward pass, without needing to "fix up" loop variables, while also minimizing the amount of Phi nodes that need to be allocated.


## Known Node Information

To be as fast as possible, Maglev does as much as possible at once. Instead of building a generic JavaScript graph and then lowering that during later optimization phases, which is a theoretically clean but computationally expensive approach, Maglev does as much as possible immediately during graph building.

During graph building Maglev will look at runtime feedback metadata collected during unoptimized execution, and generate specialized SSA nodes for the types observed. If Maglev sees `o.x` and knows from the runtime feedback that `o` always has one specific shape, it will generate an SSA node to check at runtime that `o` still has the expected shape, followed by a cheap `LoadField` node which does a simple access by offset.

Additionally, Maglev will make a side node that it now knows the shape of `o`, making it unnecessary to check the shape again later. If Maglev later encounters an operation on `o` that doesn't have feedback for some reason, this kind of information learned during compilation can be used as a second source of feedback.

Runtime information can come in various forms. Some information needs to be checked at runtime, like the shape check previously described. Other information can be used without runtime checks by registering dependencies to the runtime. Globals that are de-facto constant (not changed between initialization and when their value is seen by Maglev) fall into this category: Maglev does not need to generate code to dynamically load and check their identity. Maglev can load the value at compile time and embed it directly into the machine code; if the runtime ever mutates that global, it'll also take care to invalidate and deoptimize that machine code.

Some forms of information are “unstable”. Such information can only be used to the extent that the compiler knows for sure that it can’t change. For example, if we just allocated an object, we know it’s a new object and we can skip expensive write barriers entirely. Once there has been another potential allocation, the garbage collector could have moved the object, and we now need to emit such checks. Others are "stable": if we have never seen any object transition away from having a certain shape, then we can register a dependency on this event (any object transitioning away from that particular shape) and don’t need to recheck the shape of the object, even after a call to an unknown function with unknown side effects.


## Deoptimization

Given that Maglev can use speculative information that it checks at runtime, Maglev code needs to be able to deoptimize. To make this work, Maglev attaches abstract interpreter frame state to nodes that can deoptimize. This state maps interpreter registers to SSA values. This state turns into metadata during code generation, providing a mapping from optimized state to unoptimized state. The deoptimizer interprets this data, reading values from the interpreter frame and machine registers and putting them into the required places for interpretation. This builds on the same deoptimization mechanism as used by TurboFan, allowing us to share most of the logic and take advantage of the testing of the existing system.


## Representation Selection

JavaScript numbers represent, according to [the spec](https://tc39.es/ecma262/#sec-ecmascript-language-types-number-type), a 64-bit floating point value. This doesn't mean that the engine has to always store them as 64-bit floats though, especially since In practice many numbers are small integers (e.g. array indices). V8 tries to encode numbers as 31-bit tagged integers (internally called “Small Integers” or "Smi"), both to save memory (32bit due to [pointer compression](/blog/pointer-compression)), and for performance (integer operations are faster than float operations).

To make numerics-heavy JavaScript code fast, it’s important that optimal representations are chosen for value nodes. Unlike the interpreter and Sparkplug, the optimizing compiler can unbox values once it knows their type, operating on raw numbers rather than JavaScript values representing numbers, and rebox values only if strictly necessary. Floats can directly be passed in floating point registers instead of allocating a heap object that contains the float.

Maglev learns about the representation of SSA nodes mainly by looking at runtime feedback of e.g., binary operations, and propagating that information forwards through the Known Node Info mechanism. When SSA values with specific representations flow into Phis, a correct representation that supports all the inputs needs to be chosen. Loop phis are again tricky, since inputs from within the loop are seen after a representation should be chosen for the phi — the same "back in time" problem as for graph building. This is why Maglev has a separate phase after graph building to do representation selection on loop phis.


## Register Allocation

After graph building and representation selection, Maglev mostly knows what kind of code it wants to generate, and is "done" from a classical optimization point of view. To be able to generate code though, we need to choose where SSA values actually live when executing machine code; when they're in machine registers, and when they're saved on the stack. This is done through register allocation.

Each Maglev node has input and output requirements, including requirements on temporaries needed. The register allocator does a single forward walk over the graph, maintaining an abstract machine register state not too dissimilar from the abstract interpretation state maintained during graph building, and will satisfy those requirements, replacing the requirements on the node with actual locations. Those locations can then be used by code generation.

First, a prepass runs over the graph to find linear live ranges of nodes, so that we can free up registers once an SSA node isn’t needed anymore. This prepass also keeps track of the chain of uses. Knowing how far in the future a value is needed can be useful to decide which values to prioritize, and which to drop, when we run out of registers.

After the prepass, the register allocation runs. Register assignment follows some simple, local rules: If a value is already in a register, that register is used if possible. Nodes keep track of what registers they are stored into during the graph walk. If the node doesn’t yet have a register, but a register is free, it’s picked. The node gets updated to indicate it’s in the register, and the abstract register state is updated to know it contains the node. If there’s no free register, but a register is required, another value is pushed out of the register. Ideally, we have a node that’s already in a different register, and can drop this "for free"; otherwise we pick a value that won’t be needed for a long time, and spill it onto the stack.

On branch merges, the abstract register states from the incoming branches are merged. We try to keep as many values in registers as possible. This can mean we need to introduce register-to-register moves, or may need to unspill values from the stack, using moves called “gap moves”. If a branch merge has a phi node, register allocation will assign output registers to the phis. Maglev prefers to output phis to the same registers as its inputs, to minimize moves.

If more SSA values are live than we have registers, we’ll need to spill some values on the stack, and unspill them later. In the spirit of Maglev, we keep it simple: if a value needs to be spilled, it is retroactively told to immediately spill on definition (right after the value is created), and code generation will handle emitting the spill code. The definition is guaranteed to ‘dominate’ all uses of the value (to reach the use we must have passed through the definition and therefore the spill code). This also means that a spilled value will have exactly one spill slot for the entire duration of the code; values with overlapping lifetimes will thus have non-overlapping assigned spill slots.

Due to representation selection, some values in the Maglev frame will be tagged pointers, pointers that V8’s GC understands and needs to consider; and some will be untagged, values that the GC should not look at. TurboFan handles this by precisely keeping track of which stack slots contain tagged values, and which contain untagged values, which changes during execution as slots are reused for different values. For Maglev we decided to keep things simpler, to reduce the memory required for tracking this: we split the stack frame into a tagged and an untagged region, and only store this split point.


## Code Generation

Once we know what expressions we want to generate code for, and where we want to put their outputs and inputs, Maglev is ready to generate code.

Maglev nodes directly know how to generate assembly code using a “macro assembler”. For example, a `CheckMap` node knows how to emit assembler instructions that compare the shape (internally called the “map”) of an input object with a known value, and to deoptimize the code if the object had a wrong shape.

One slightly tricky bit of code handles gap moves: The requested moves created by the register allocator know that a value lives somewhere and needs to go elsewhere. If there’s a sequence of such moves though, a preceding move could clobber the input needed by a subsequent move. The Parallel Move Resolver computes how to safely perform the moves so that all values end up in the right place.


# Results

So the compiler we just presented is both clearly much more complex than Sparkplug, and much simpler than TurboFan. How does it fare?

In terms of compilation speed we’ve managed to build a JIT that’s roughly 10x slower than Sparkplug, and 10x faster than TurboFan.

![Compile time comparison of the compilation tiers, for all functions compiled in JetStream](/_img/maglev/compile-time.svg)

This allows us to deploy Maglev much earlier than we’d want to deploy TurboFan. If the feedback it relied upon ended up not being very stable yet, there’s no huge cost to deoptimizing and recompiling later. It also allows us to use TurboFan a little later: we’re running much faster than we’d run with Sparkplug.

Slotting in Maglev between Sparkplug and TurboFan results in noticeable benchmark improvements:

![Web performance benchmarks with Maglev](/_img/maglev/I-IS-IT-IST-ISTM.svg)

We have also validated Maglev on real-world data, and see good improvements on [Core Web Vitals](https://web.dev/vitals/).

Since Maglev compiles much faster, and since we can now afford to wait longer before we compile functions with TurboFan, this results in a secondary benefit that’s not as visible on the surface. The benchmarks focus on main-thread latency, but Maglev also significantly reduces V8’s overall resource consumption by using less off-thread CPU time. The energy consumption of a process can be measured easily on an M1- or M2-based Macbook using `taskinfo`.

:::table-wrapper
| Benchmark   | Energy Consumption |
| :---------: | :----------------: |
| JetStream   | -3.5%              |
| Speedometer | -10%               |
:::

Maglev isn’t complete by any means. We've still got plenty more work to do, more ideas to try out, and more low-hanging fruit to pick — as Maglev gets more complete, we’ll expect to see higher scores, and more reduction in energy consumption.

Maglev is now available for desktop Chrome now, and will be rolled out to mobile devices soon.
