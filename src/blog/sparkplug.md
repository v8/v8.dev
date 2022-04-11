---
title: 'Sparkplug — a non-optimizing JavaScript compiler'
author: '[Leszek Swirski](https://twitter.com/leszekswirski) — maybe not the brightest spark, but at least the fastest one'
avatars:
  - leszek-swirski
date: 2021-05-27
tags:
  - JavaScript
extra_links:
  - href: https://fonts.googleapis.com/css?family=Gloria+Hallelujah&display=swap
    rel: stylesheet
description: 'In V8 v9.1 we’re improving V8 performance by 5–15% with Sparkplug: a new, non-optimizing JavaScript compiler.'
tweet: '1397945205198835719'
---

<!-- markdownlint-capture -->
<!-- markdownlint-disable no-inline-html -->
<style>
  svg {
    --other-frame-bg: rgb(200 200 200 / 20%);
    --machine-frame-bg: rgb(200 200 200 / 50%);
    --js-frame-bg: rgb(212 205 100 / 60%);
    --interpreter-frame-bg: rgb(215 137 218 / 50%);
    --sparkplug-frame-bg: rgb(235 163 104 / 50%);
  }
  svg text {
    font-family: Gloria Hallelujah, cursive;
  }
  .flipped .frame {
    transform: scale(1, -1);
  }
  .flipped .frame text {
    transform:scale(1, -1);
  }
</style>
<!-- markdownlint-restore -->

Writing a high-performance JavaScript engine takes more than just having a highly optimising compiler like TurboFan. Particularly for short-lived sessions, like loading websites or command line tools, there’s a lot of work that happens before the optimising compiler even has a chance to start optimising, let alone having time to generate the optimised code.

This is the reason why, since 2016, we’ve moved away from tracking synthetic benchmarks (like Octane) to measuring [real-world performance](/blog/real-world-performance), and why since then we’ve worked hard on the performance of JavaScript outside of the optimising compiler. This has meant work on the parser, on streaming, on our object model, on concurrency in the garbage collector, on caching compiled code… let’s just say we were never bored.

As we turn to improving the performance of the actual initial JavaScript execution, however, we start to hit limitations when optimising our interpreter. V8’s interpreter is highly optimised and very fast, but interpreters have inherent overheads that we can’t get rid of; things like bytecode decoding overheads or dispatch overheads that are an intrinsic part of an interpreter’s functionality.

With our current two-compiler model, we can’t tier up to optimised code much faster; we can (and are) working on making the optimisation faster, but at some point you can only get faster by removing optimisation passes, which reduces peak performance. Even worse, we can’t really start optimising earlier, because we won’t have stable object shape feedback yet.

Enter Sparkplug: our new non-optimising JavaScript compiler we’re releasing with V8 v9.1, which nestles between the Ignition interpreter and the TurboFan optimising compiler.

![The new compiler pipeline](/_svg/sparkplug/pipeline.svg)

## A fast compiler

Sparkplug is designed to compile fast. Very fast. So fast, that we can pretty much compile whenever we want, allowing us to tier up to Sparkplug code much more aggressively than we can to TurboFan code.

There are a couple of tricks that make the Sparkplug compiler fast. First of all, it cheats; the functions it compiles have already been compiled to bytecode, and the bytecode compiler has already done most of the hard work like variable resolution, figuring out if parentheses are actually arrow functions, desugaring destructuring statements, and so on. Sparkplug compiles from bytecode rather than from JavaScript source, and so doesn’t have to worry about any of that.

The second trick is that Sparkplug doesn’t generate any intermediate representation (IR) like most compilers do. Instead, Sparkplug compiles directly to machine code in a single linear pass over the bytecode, emitting code that matches the execution of that bytecode. In fact, the entire compiler is a [`switch` statement](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/baseline/baseline-compiler.cc;l=465;drc=55cbb2ce3be503d9096688b72d5af0e40a9e598b) inside a [`for` loop](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/baseline/baseline-compiler.cc;l=290;drc=9013bf7765d7febaa58224542782307fa952ac14), dispatching to fixed per-bytecode machine code generation functions.

```cpp
// The Sparkplug compiler (abridged).
for (; !iterator.done(); iterator.Advance()) {
  VisitSingleBytecode();
}
```

The lack of IR means that the compiler has limited optimisation opportunity, beyond very local peephole optimisations. It also means that we have to port the entire implementation separately to each architecture we support, since there’s no intermediate architecture-independent stage. But, it turns out that neither of these is a problem: a fast compiler is a simple compiler, so the code is pretty easy to port; and Sparkplug doesn’t need to do heavy optimisation, since we have a great optimising compiler later on in the pipeline anyway.

::: note
Technically, we currently do two passes over the bytecode — one to discover loops, and a second one to generate the actual code. We’re planning on getting rid of the first one eventually though.
:::

## Interpreter-compatible frames

Adding a new compiler to an existing mature JavaScript VM is a daunting task. There’s all sorts of things you have to support beyond just standard execution; V8 has a debugger, a stack-walking CPU profiler, there’s stack traces for exceptions, integration into the tier-up, on-stack replacement to optimized code for hot loops… it’s a lot.

Sparkplug does a neat sleight-of-hand that simplifies most of these problems away, which is that it maintains “interpreter-compatible stack frames”.

Let’s rewind a bit. Stack frames are how code execution stores function state; whenever you call a new function, it creates a new stack frame for that function’s local variables. A stack frame is defined by a frame pointer (marking its start) and a stack pointer (marking its end):

![A stack frame, with stack and frame pointers](/_svg/sparkplug/basic-frame.svg)

::: note
<!-- markdownlint-capture -->
<!-- markdownlint-disable no-inline-html -->
At this point, roughly half of you will be screaming, saying “this diagram doesn’t make sense, stacks obviously grow in the opposite direction!”. Fear not, I made a button for you: <button id="flipStacksButton">I think stacks grow upwards</button>
<script>
  const flipStacksButton = document.getElementById('flipStacksButton');
  let stacksAreFlipped = Math.random() < 0.5;
  function updateStacks() {
    if (stacksAreFlipped) {
      document.body.classList.add('flipped');
      flipStacksButton.textContent = 'I think stacks grow downwards';
    } else {
      document.body.classList.remove('flipped');
      flipStacksButton.textContent = 'I think stacks grow upwards';
    }
  }
  updateStacks();
  flipStacksButton.onclick = () => {
    stacksAreFlipped = !stacksAreFlipped;
    updateStacks();
  };
</script>
<!-- markdownlint-restore -->
:::

When a function is called, the return address is pushed to the stack; this is popped off by the function when it returns, to know where to return to. Then, when that function creates a new frame, it saves the old frame pointer on the stack, and sets the new frame pointer to the start of its own stack frame. Thus, the stack has a chain of frame pointers, each marking the start of a frame which points to the previous one:

![Stack frames for multiple calls](/_svg/sparkplug/machine-frame.svg)

::: note
Strictly speaking, this is just a convention followed by the generated code, not a requirement. It’s a pretty universal one though; the only time it’s really broken is when stack frames are elided entirely, or when debugging side-tables can be used to walk stack frames instead.
:::

This is the general stack layout for all types of function; there are then conventions on how arguments are passed, and how the function stores values in its frame. In V8, we have the convention for JavaScript frames that arguments (including the receiver) are pushed [in reverse order](/blog/adaptor-frame) on the stack before the function is called, and that the first few slots on the stack are: the current function being called; the context it is being called with; and the number of arguments that were passed. This is our “standard” JS frame layout:

![A V8 JavaScript stack frame](/_svg/sparkplug/js-frame.svg)

This JS calling convention is shared between optimized and interpreted frames, and it’s what allows us to, for example, walk the stack with minimal overhead when profiling code in the performance panel of the debugger.

In the case of the Ignition interpreter, the convention gets more explicit. Ignition is a register-based interpreter, which means that there are virtual registers (not to be confused with machine registers!) which store the current state of the interpreter — this includes JavaScript function locals (var/let/const declarations), and temporary values. These registers are stored on the interpreter’s stack frame, along with a pointer to the bytecode array being executed, and the offset of the current bytecode within that array:

![A V8 interpreter stack frame](/_svg/sparkplug/interpreter-frame.svg)

Sparkplug intentionally creates and maintains a frame layout which matches the interpreter’s frame; whenever the interpreter would have stored a register value, Sparkplug stores one too. It does this for several reasons:

1. It simplifies Sparkplug compilation; Sparkplug can just mirror the interpreter’s behaviour without having to keep some sort of mapping from interpreter registers to Sparkplug state.
1. It also speeds up compilation, since the bytecode compiler has done the hard work of register allocation.
1. It makes the integration with the rest of the system almost trivial; the debugger, the profiler, exception stack unwinding, stack trace printing, all these operations do stack walks to discover what the current stack of executing functions is, and all these operations continue working with Sparkplug almost unchanged, because as far as they’re concerned, all they have is an interpreter frame.
1. It makes on-stack replacement (OSR) trivial. OSR is when the currently executing function is replaced while executing; currently this happens when an interpreted function is inside a hot loop (where it tiers-up to optimized code for that loop), and when the optimized code deoptimises (where it tiers-down and continues the function’s execution in the interpreter). With Sparkplug frames mirroring interpreter frames, any OSR logic that works for the interpreter will work for Sparkplug; even better, we can swap between the interpreter and Sparkplug code with almost zero frame translation overhead.

There is one small change we make to the interpreter stack frame, which is that we don’t keep the bytecode offset up-to-date during Sparkplug code execution. Instead, we store a two-way mapping from Sparkplug code address range to corresponding bytecode offset; a relatively simple mapping to encode, since the Sparkplug code is emitted directly from a linear walk over the bytecode. Whenever a stack frame access wants to know the “bytecode offset” for a Sparkplug frame, we look up the currently executing instruction in this mapping and return the corresponding bytecode offset. Similarly, whenever we want to OSR from the interpreter to Sparkplug, we can look up the current bytecode offset in the mapping, and jump to the corresponding Sparkplug instruction.

You may notice that we now have an unused slot on the stack frame, where the bytecode offset would be; one that we can’t get rid of since we want to keep the rest of the stack unchanged. We re-purpose this stack slot to instead cache the “feedback vector” for the currently executing function; this is the vector that stores object shape data, and needs to be loaded for most operations. All we have to do is be a bit careful around OSR to make sure that we swap in either the correct bytecode offset, or the correct feedback vector for this slot.

Thus the Sparkplug stack frame is:

![A V8 Sparkplug stack frame](/_svg/sparkplug/sparkplug-frame.svg)

## Defer to builtins

Sparkplug actually generates very little of its own code. JavaScript semantics are complex, and it would take a lot of code to perform even the simplest operations. Forcing Sparkplug to regenerate this code inline on each compilation would be bad for multiple reasons:

  1. It would increase compile times noticeably from the sheer amount of code that needs to be generated,
  2. It would increase the memory consumption of Sparkplug code, and
  3. We’d have to re-implement the code-gen for a bunch of JavaScript functionality for Sparkplug, which would likely mean more bugs and a bigger security surface.

So instead of all this, most Sparkplug code just calls into “builtins”, small snippets of machine code embedded in the binary, to do the actual dirty work. These builtins are either the same one that the interpreter uses, or at least share the majority of their code with the interpreter’s bytecode handlers.

In fact, Sparkplug code is basically just builtin calls and control flow:

You might now be thinking, “Well, what’s the point of all this then? Isn’t Sparkplug just doing the same work as the interpreter?” — and you wouldn’t be entirely wrong. In many ways, Sparkplug is “just” a serialization of interpreter execution, calling the same builtins and maintaining the same stack frame. Nevertheless, even just this is worth it, because it removes (or more precisely, pre-compiles) those unremovable interpreter overheads, like operand decoding and next-bytecode dispatch.

It turns out, interpreters defeat a lot of CPU optimisations: static operands are dynamically read from memory by the interpreter, forcing the CPU to either stall or speculate on what the values could be; dispatching to the next bytecode requires successful branch prediction to stay performant, and even if the speculations and predictions are correct, you’ve still had to execute all that decoding and dispatching code, and you’ve still used up valuable space in your various buffers and caches. A CPU is effectively an interpreter itself, albeit one for machine code; seen this way, Sparkplug is a “transpiler” from Ignition bytecode to CPU bytecode, moving your functions from running in an “emulator” to running “native”.

## Performance

So, how well does Sparkplug work in real life? We ran Chrome 91 with a couple of benchmarks, on a couple of our performance bots, with and without Sparkplug, to see its impact.

Spoiler alert: we’re pretty pleased.

::: note
The below benchmarks list various bots running various operating systems. Although the operating system is prominent in the bot’s name, we don’t think it actually has much of an impact on the results. Rather, the different machines also have different CPU and memory configurations, which we believe are the majority source of differences.
:::

# Speedometer

[Speedometer](https://browserbench.org/Speedometer2.0/) is a benchmark that tries to emulate real-world website framework usage, by building a TODO-list-tracking webapp using a couple of popular frameworks, and stress-testing that app’s performance when adding and deleting TODOs. We’ve found it to be a great reflection of real-world loading and interaction behaviours, and we’ve repeatedly found that improvements to Speedometer are reflected in our real-world metrics.

With Sparkplug, the Speedometer score improves by 5-10%, depending on which bot we’re looking at.

![Median improvement in Speedometer score with Sparkplug, across several performance bots. Error bars indicate inter-quartile range.](/_img/sparkplug/benchmark-speedometer.svg)

# Browsing benchmarks

Speedometer is a great benchmark, but it only tells part of the story. We additionally have a set of “browsing benchmarks”, which are recordings of a set of real websites that we can replay, script a bit of interaction, and get a more realistic view of how our various metrics behave in the real world.

On these benchmarks, we chose to look at our “V8 main-thread time” metric, which measures the total amount of time spent in V8 (including compilation and execution) on the main thread (i.e. excluding streaming parsing or background optimized compilation). This is out best way of seeing how well Sparkplug pays for itself while excluding other sources of benchmark noise.

The results are varied, and very machine and website dependent, but on the whole they look great: we see improvements on the order of around 5–15%.

::: figure Median improvement in V8 main-thread time on our browsing benchmarks with 10 repeats. Error bars indicate inter-quartile range.
![Result for linux-perf bot](/_img/sparkplug/benchmark-browsing-linux-perf.svg) ![Result for win-10-perf bot](/_img/sparkplug/benchmark-browsing-win-10-perf.svg) ![Result for benchmark-browsing-mac-10_13_laptop_high_end-perf bot](/_img/sparkplug/benchmark-browsing-mac-10_13_laptop_high_end-perf.svg) ![Result for mac-10_12_laptop_low_end-perf bot](/_img/sparkplug/benchmark-browsing-mac-10_12_laptop_low_end-perf.svg) ![Result for mac-m1_mini_2020 bot](/_img/sparkplug/benchmark-browsing-mac-m1_mini_2020-perf.svg)
:::

In conclusion: V8 has a new super-fast non-optimising compiler, which improves V8 performance on real-world benchmarks by 5–15%. It’s already available in V8 v9.1 behind the `--sparkplug` flag, and we’ll be rolling it out in Chrome 91.
