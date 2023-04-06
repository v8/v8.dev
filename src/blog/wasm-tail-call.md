---
title: 'WebAssembly tail calls'
description: 'This document explains the WebAssembly tail calls proposal and demonstrates it with some examples.'
author: 'Thibaud Michaud, Thomas Lively'
date: 2023-04-06
tags:
  - WebAssembly
---
We are shipping WebAssembly tail calls in V8 v11.2! In this post we give a brief overview of this proposal, demonstrate an interesting use case for C++ coroutines with Emscripten, and show how V8 handles tail calls internally.

## What is Tail Call Optimization?

A call is said to be in tail position if it is the last instruction executed before returning from the current function. Compilers can optimize such calls by discarding the caller frame and replacing the call with a jump.

This is especially useful for recursive functions. For instance, take this C function that sums the elements of a linked list:

```c
int sum(List* list, int acc) {
  if (list == nullptr) return acc;
  return sum(list->next, acc + list->val);
}
```

With a regular call, this consumes 𝒪(n) stack space: each element of the list adds a new frame on the call stack. With a long enough list, this could very quickly overflow the stack. By replacing the call with a jump, tail call optimization effectively turns this recursive function into a loop which uses 𝒪(1) stack space:

```c
int sum(List* list, int acc) {
  while (list != nullptr) {
    acc = acc + list->val;
    list = list->next;
  }
  return acc;
}
```

This optimization is particularly important for functional languages. They rely heavily on recursive functions, and pure ones like Haskell don’t even provide loop control structures. Any kind of custom iteration typically uses recursion one way or another. Without tail call optimization, this would very quickly run into a stack overflow for any non-trivial program.

### The WebAssembly tail call proposal

There are two ways to call a function in Wasm MVP: `call` and `call_indirect`.  The WebAssembly tail call proposal adds their tail call counterparts: `return_call` and `return_call_indirect`. This means that it is the responsibility of the toolchain to actually perform tail call optimization and emit the appropriate call kind, which gives it more control over performance and stack space usage.

Let’s look at a recursive Fibonacci function. The Wasm bytecode is included here in the text format for completeness, but you can find it in C++ in the next section:

```wasm/4
(func $fib_rec (param $n i32) (param $a i32) (param $b i32) (result i32)
  (if (i32.eqz (local.get $n))
    (then (return (local.get $a)))
    (else
      (return_call $fib_rec
        (i32.sub (local.get $n) (i32.const 1))
        (local.get $b)
        (i32.add (local.get $a) (local.get $b))
      )
    )
  )
)

(func $fib (param $n i32) (result i32)
  (call $fib_rec (local.get $n) (i32.const 0) (i32.const 1))
)
```

At any given time there is only one `fib_rec` frame, which unwinds itself before performing the next recursive call. When we reach the base case, `fib_rec` returns the result `a` directly to `fib`.

One observable consequence of tail calls is (besides a reduced risk of stack overflow) that tail callers do not appear in stack traces. Neither do they appear in the stack property of a caught exception, nor in the DevTools stack trace. By the time an exception is thrown, or execution pauses, the tail caller frames are gone and there is no way for V8 to recover them.

## Using tail calls with Emscripten

Functional languages often depend on tail calls, but it’s possible to use them as a C or C++ programmer as well. Emscripten (and Clang, which Emscripten uses) supports the musttail attribute that tells the compiler that a call must be compiled into a tail call. As an example, consider this recursive implementation of a Fibonacci function that calculates the `n`th Fibonacci number mod 2^32 (because the integers overflow for large `n`):

```c
#include <stdio.h>

unsigned fib_rec(unsigned n, unsigned a, unsigned b) {
  if (n == 0) {
    return a;
  }
  return fib_rec(n - 1, b, a + b);
}

unsigned fib(unsigned n) {
  return fib_rec(n, 0, 1);
}

int main() {
  for (unsigned i = 0; i < 10; i++) {
    printf("fib(%d): %d\n", i, fib(i));
  }

  printf("fib(1000000): %d\n", fib(1000000));
}
```

After compiling with `emcc test.c -o test.js`, running this program in Node.js gives a stack overflow error. We can fix this by adding `__attribute__((__musttail__))` to the return in `fib_rec` and adding `-mtail-call` to the compilation arguments. Now the produced Wasm modules contains the new tail call instructions, so we have to pass `--experimental-wasm-return_call` to Node.js, but the stack no longer overflows.

Here’s an example using mutual recursion as well:

```c
#include <stdio.h>
#include <stdbool.h>

bool is_odd(unsigned n);
bool is_even(unsigned n);

bool is_odd(unsigned n) {
  if (n == 0) {
    return false;
  }
  __attribute__((__musttail__))
  return is_even(n - 1);
}

bool is_even(unsigned n) {
  if (n == 0) {
    return true;
  }
  __attribute__((__musttail__))
  return is_odd(n - 1);
}

int main() {
  printf("is_even(1000000): %d\n", is_even(1000000));
}
```

Note that both of these examples are simple enough that if we compile with `-O2`, the compiler can precompute the answer and avoid exhausting the stack even without tail calls, but this wouldn’t be the case with more complex code. In real-world code, the musttail attribute can be helpful for writing high-performance interpreter loops as described in [this blog post](https://blog.reverberate.org/2021/04/21/musttail-efficient-interpreters.html) by Josh Haberman.

Besides the `musttail` attribute, C++ depends on tail calls for one other feature: C++20 coroutines. The relationship between tail calls and C++20 coroutines is covered in extreme depth in [this blog post](https://lewissbaker.github.io/2020/05/11/understanding_symmetric_transfer) by Lewis Baker, but to summarize, it is possible to use coroutines in a pattern that would subtly cause stack overflow even though the source code doesn’t make it look like there is a problem. To fix this problem, the C++ committee added a requirement that compilers implement “symmetric transfer” to avoid the stack overflow, which in practice means using tail calls under the covers.

When WebAssembly tail calls are enabled, Clang implements symmetric transfer as described in that blog post, but when tail calls are not enabled, Clang silently compiles the code without symmetric transfer, which could lead to stack overflows and is technically not a correct implementation of C++20!

To see the difference in action, use Emscripten to compile the last example from the blog post linked above and observe that it only avoids overflowing the stack if tail calls are enabled. Note that due to a recently-fixed bug, this only works correctly in Emscripten 3.1.35 or later.

## Tail calls in V8

As we saw earlier, it is not the engine’s responsibility to detect calls in tail position. This should be done upstream by the toolchain. So the only thing left to do for TurboFan (V8’s optimizing compiler) is to emit an appropriate sequence of instructions based on the call kind and the target function signature.  For our fibonacci example from earlier, the stack would look like this:

![Simple tail call in TurboFan](/_img/wasm-tail-calls/tail-calls.svg)

On the left we are inside `fib_rec` (green), called by `fib` (blue) and about to recursively tail call `fib_rec`. First we unwind the current frame by resetting the frame and stack pointer. The frame pointer just restores its previous value by reading it from the “Caller FP” slot. The stack pointer moves to the top of the parent frame, plus enough space for any potential stack parameters and stack return values for the callee (0 in this case, everything is passed by registers). Parameters are moved into their expected registers according to `fib_rec`’s linkage (not shown in the diagram). And finally we start running `fib_rec`, which starts by creating a new frame.

`fib_rec` unwinds and rewinds itself like this until `n == 0`, at which point it returns `a` by register to `fib`.

This is a simple case where all parameters and return values fit into registers, and the callee has the same signature as the caller. In the general case, we might need to do complex stack manipulations:

- Read outgoing parameters from the old frame
- Move parameters into the new frame
- Adjust the frame size by moving the return address up or down, depending on the number of stack parameters in the callee

All these reads and writes can conflict with each other, because we are reusing the same stack space. This is a crucial difference with a non-tail call, which would simply push all the stack parameters and the return address on top of the stack.

![Complex tail call in TurboFan](/_img/wasm-tail-calls/tail-calls-complex.svg)

TurboFan handles these stack and register manipulations with the “gap resolver”, a component which takes a list of moves that should semantically be executed in parallel, and generates the appropriate sequence of moves to resolve potential interferences between the move’s sources and destinations. If the conflicts are acyclic, this is just a matter of reordering the moves such that all sources are read before they are overwritten. For cyclic conflicts (e.g. if we swap two stack parameters), this can involve moving one of the sources to a temporary register or a temporary stack slot to break the cycle.

Tail calls are also supported in Liftoff, our baseline compiler. In fact, they must be supported, or the baseline code might run out of stack space. However they are not optimized in this tier: Liftoff pushes the parameters, return address, and frame pointer to complete the frame as if this was a regular call, and then shifts everything downwards to discard the caller frame:

![Tail calls in Liftoff](/_img/wasm-tail-calls/tail-calls-liftoff.svg)

Before jumping to the target function, we also pop the caller FP into the FP register to restore its previous value, and to let the target function push it again in the prologue.

This strategy doesn’t require that we analyze and resolve move conflicts, which makes compilation faster. The generated code is slower, but eventually [tiers up](/blog/wasm-dynamic-tiering) to TurboFan if the function is hot enough.
