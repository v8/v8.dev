---
title: 'Faster JavaScript calls'
author: '[Victor Gomes](https://twitter.com/VictorBFG), the frame shredder'
avatars:
  - 'victor-gomes'
date: 2021-02-15
tags:
  - internals
description: 'Faster JavaScript calls by removing the arguments adaptor frame'
tweet: '1361337569057865735'
---

JavaScript allows calling a function with a different number of arguments than the expected number of parameters, i.e., one can pass fewer or more arguments than the declared formal parameters. The former case is called under-application and the latter is called over-application.

In the under-application case, the remaining parameters get assigned the undefined value. In the over-application case, the remaining arguments can be accessed by using the rest parameter and the `arguments` property, or they are simply superfluous and they can be ignored. Many Web/Node.js frameworks nowadays use this JS feature to accept optional parameters and create a more flexible API.

Until recently, V8 had a special machinery to deal with arguments size mismatch: the arguments adaptor frame. Unfortunately, argument adaption comes at a performance cost, but is commonly needed in modern front-end and middleware frameworks. It turns out that, with a clever trick, we can remove this extra frame, simplify the V8 codebase and get rid of almost the entire overhead.

We can calculate the performance impact of removing the arguments adaptor frame through a micro-benchmark.

```js
console.time();
function f(x, y, z) {}
for (let i = 0; i <  N; i++) {
  f(1, 2, 3, 4, 5);
}
console.timeEnd();
```

![Performance impact of removing the arguments adaptor frame, as measured through a micro-benchmark.](/_img/v8-release-89/perf.svg)

The graph shows that there is no overhead anymore when running on [JIT-less mode](https://v8.dev/blog/jitless) (Ignition) with a 11.2% performance improvement. When using [TurboFan](https://v8.dev/docs/turbofan), we get up to 40% speedup.

This microbenchmark was naturally designed to maximise the impact of the arguments adaptor frame. We have however seen a considerable improvement in many benchmarks, such as in [our internal JSTests/Array benchmark](https://chromium.googlesource.com/v8/v8/+/b7aa85fe00c521a704ca83cc8789354e86482a60/test/js-perf-test/JSTests.json) (7%) and in [Octane2](https://github.com/chromium/octane) (4.6% in Richards and 6.1% in EarleyBoyer).

## TL;DR: Reverse the arguments

The whole point of this project was to remove the arguments adaptor frame, which offers a consistent interface to the callee when accessing its arguments in the stack. In order to do that, we needed to reverse the arguments in the stack and added a new slot in the callee frame containing the actual argument count. The figure below shows the example of a typical frame before and after the change.

![A typical JavaScript stack frame before and after removing the arguments adaptor frame.](/_img/adaptor-frame/frame-diff.svg)

## Making JavaScript calls faster

To appreciate what we have done to make calls faster, let’s see how V8 performs a call and how the arguments adaptor frame works.

What happens inside V8 when we invoke a function call in JS? Let’s suppose the following JS script:

```js
function add42(x) {
  return x + 42;
}
add42(3);
```

![Flow of execution inside V8 during a function call.](/_img/adaptor-frame/flow.svg)

## Ignition

V8 is a multi-tier VM. Its first tier is called [Ignition](https://v8.dev/docs/ignition), it is a bytecode stack machine with an accumulator register. V8 starts by compiling the code to [Ignition bytecodes](https://medium.com/dailyjs/understanding-v8s-bytecode-317d46c94775). The above call is compiled to the following:

```
0d              LdaUndefined              ;; Load undefined into the accumulator
26 f9           Star r2                   ;; Store it in register r2
13 01 00        LdaGlobal [1]             ;; Load global pointed by const 1 (add42)
26 fa           Star r1                   ;; Store it in register r1
0c 03           LdaSmi [3]                ;; Load small integer 3 into the accumulator
26 f8           Star r3                   ;; Store it in register r3
5f fa f9 02     CallNoFeedback r1, r2-r3  ;; Invoke call
```

The first argument of a call is usually referred to as the receiver. The receiver is the `this` object inside a JSFunction, and every JS function call must have one. The bytecode handler of `CallNoFeedback` needs to call the object `r1` with the arguments in the register list `r2-r3`.

Before we dive into the bytecode handler, note how registers are encoded in the bytecode. They are negative single byte integers: `r1` is encoded as `fa`, `r2` as `f9` and `r3` as `f8`. We can refer to any register ri as `fb - i`, actually as we will see, the correct encoding is `- 2 - kFixedFrameHeaderSize - i`. Register lists are encoded using the first register and the size of the list, so `r2-r3` is `f9 02`.

There are many bytecode call handlers in Ignition. You can see a list of them [here](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/interpreter/bytecodes.h;drc=3965dcd5cb1141c90f32706ac7c965dc5c1c55b3;l=184). They vary slightly from each other. There are bytecodes optimized for calls with an `undefined` receiver, for property calls, for calls with a fixed number of parameters or for generic calls. Here we analyze `CallNoFeedback` which is a generic call in which we don’t accumulate feedback from the execution.

The handler of this bytecode is quite simple. It is written in [`CodeStubAssembler`](https://v8.dev/docs/csa-builtins), you can check it out [here](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/interpreter/interpreter-generator.cc;drc=6cdb24a4ce9d4151035c1f133833137d2e2881d1;l=1467). Essentially, it tailcalls to an architecture-dependent built-in [`InterpreterPushArgsThenCall`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/builtins/x64/builtins-x64.cc;drc=8665f09771c6b8220d6020fe9b1ad60a4b0b6591;l=1277).

The built-in essentially pops the return address to a temporary register, pushes all the arguments (including the receiver) and pushes back the return address. At this point, we do not know if the callee is a callable object nor how many arguments the callee is expecting, i.e., its formal parameter count.

![State of the frame after the execution of `InterpreterPushArgsThenCall` built-in.](/_img/adaptor-frame/normal-push.svg)

Eventually the execution tailcalls to the built-in [`Call`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/builtins/x64/builtins-x64.cc;drc=8665f09771c6b8220d6020fe9b1ad60a4b0b6591;l=2256). There, it checks if the target is a proper function, a constructor or any callable object. It also reads the `shared function info` structure to get its formal parameter count.

If the callee is a function object, it tailcalls to the built-in [`CallFunction`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/builtins/x64/builtins-x64.cc;drc=8665f09771c6b8220d6020fe9b1ad60a4b0b6591;l=2038), where a bunch of checks happen, including if we have an `undefined` object as receiver. If we have an `undefined` or `null` object as receiver, we should patch it to refer to the global proxy object, according to the [ECMA specification](https://262.ecma-international.org/11.0/#sec-ordinarycallbindthis).

The execution then tailcalls to the built-in [`InvokeFunctionCode`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/codegen/x64/macro-assembler-x64.cc;drc=a723767935dec385818d1134ea729a4c3a3ddcfb;l=2781), which will in the absence of arguments mismatch just call whatever is being pointed by the field `Code` in the callee object. This could either be an optimized function or the built-in [`InterpreterEntryTrampoline`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/builtins/x64/builtins-x64.cc;drc=8665f09771c6b8220d6020fe9b1ad60a4b0b6591;l=1037).

If we assume we’re calling a function that hasn’t been optimized yet, the Ignition trampoline will set up an `IntepreterFrame`. You can see a brief summary of the frame types in V8 [here](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/execution/frame-constants.h;drc=574ac5d62686c3de8d782dc798337ce1355dc066;l=14).

Without going into too much detail of what happens next, we can see a snapshot of the interpreter frame during the callee execution.

![The `InterpreterFrame` for the call `add42(3)`.](/_img/adaptor-frame/normal-frame.svg)

We see that we have a fixed number of slots in the frame: the return address, the previous frame pointer, the context, the current function object we’re executing, the bytecode array of this function and the offset of the current bytecode we’re executing. Finally, we have a list of registers dedicated to this function (you can think of them as function locals). The `add42` function doesn’t actually have any registers, but the caller has a similar frame with 3 registers.

As expected add42 is a simple function:

```
25 02             Ldar a0          ;; Load the first argument to the accumulator
40 2a 00          AddSmi [42]      ;; Add 42 to it
ab                Return           ;; Return the accumulator
```

Note how we encode the argument in the `Ldar` _(Load Accumulator Register)_ bytecode: argument `1` (`a0`) is encoded with the number `02`. In fact, the encoding of any argument is simply `[ai] = 2 + parameter_count - i - 1` and the receiver `[this] = 2 + parameter_count`, or in this example `[this] = 3`. The parameter count here does not include the receiver.

We’re now able to understand why we encode registers and arguments this way. They simply denote an offset from the frame pointer. We can then treat argument/register load and store in the same way. The offset for the last argument from the frame pointer is `2` (previous frame pointer and the return address). That explains the `2` in the encoding. The fixed part of the interpreter frame is `6` slots (`4` from the frame pointer), so the register zero is located at offset `-5`, i.e. `fb`, register `1` at `fa`. Clever, right?

Note however to be able to access the arguments, the function must know how many arguments are in the stack! The index `2` points to the last argument regardless of how many arguments there are!

The bytecode handler of `Return` will finish by calling the built-in `LeaveInterpreterFrame`. This built-in essentially reads the function object to get the parameter count from the frame, pops the current frame, recovers the frame pointer, saves the return address in a scratch register, pops the arguments according to the parameter count and jumps to the address in the scratch registers.

All this flow is great! But what happens when we call a function with fewer or more arguments than its parameter count? The clever argument/register access will fail and how do we clean up the arguments at the end of the call?

## Arguments adaptor frame

Let’s now call `add42` with fewer and more arguments:

```js
add42();
add42(1, 2, 3);
```

The JS developers between us will know that in the first case, `x` will be assigned `undefined` and the function will return `undefined + 42 = NaN`. In the second case, `x` will be assigned `1` and the function will return `43`, the remaining arguments will be ignored. Note that the caller does not know if that will happen. Even if the caller checks the parameter count, the callee could use the rest parameter or the arguments object to access all the other arguments. Actually, the arguments object can even be accessed outside `add42` in sloppy mode.

If we follow the same steps as before, we will first call the built-in `InterpreterPushArgsThenCall`. It will push the arguments to the stack like so:

![State of the frames after the execution of `InterpreterPushArgsThenCall` built-in.](/_img/adaptor-frame/adaptor-push.svg)

Continuing the same procedure as before, we check if the callee is a function object, get its parameter count and patch the receiver to the global proxy. Eventually we reach `InvokeFunctionCode`.

Here instead of jumping to the `Code` in the callee object. We check that we have a mismatch between argument size and parameter count and jump to `ArgumentsAdaptorTrampoline`.

In this built-in, we build an extra frame, the infamous arguments adaptor frame. Instead of explaining what happens inside the built-in, I will just present you the state of the frame before the built-in calls the callee’s `Code`. Note that this is a proper `x64 call` (not a `jmp`) and after the execution of the callee we will return to the `ArgumentsAdaptorTrampoline`. This is a contrast with `InvokeFunctionCode` that tailcalls.

![Stack frames with arguments adaptation.](/_img/adaptor-frame/adaptor-frames.svg)

You can see that we create another frame that copies all the arguments necessary in order to have precisely the parameter count of arguments on top of the callee frame. It creates an interface to the callee function, so that the latter does not need to know the number of arguments. The callee will always be able to access its parameters with the same calculation as before, that is, `[ai] = 2 + parameter_count - i - 1`.

V8 has special built-ins that understand the adaptor frame whenever it needs to access the remaining arguments through the rest parameter or the arguments object. They will always need to check the adaptor frame type on top of the callee’s frame and then act accordingly.

As you can see, we solve the argument/register access issue, but we create a lot of complexity. Every built-in that needs to access all the arguments will need to understand and check the existence of the adaptor frame. Not only that, we need to be careful to not access stale and old data. Consider the following changes to `add42`:

```js
function add42(x) {
  x += 42;
  return x;
}
```

The bytecode array now is:

```
25 02             Ldar a0       ;; Load the first argument to the accumulator
40 2a 00          AddSmi [42]   ;; Add 42 to it
26 02             Star a0       ;; Store accumulator in the first argument slot
ab                Return        ;; Return the accumulator
```

As you can see, we now modify `a0`. So, in the case of a call `add42(1, 2, 3)` the slot in the arguments adaptor frame will be modified, but the caller frame will still contain the number `1`. We need to be careful that the arguments object is accessing the modified value instead of the stale one.

Returning from the function is simple, albeit slow. Remember what `LeaveInterpreterFrame` does? It basically pops the callee frame and the arguments up to the parameter count number. So when we return to the arguments adaptor stub, the stack looks like so:

![State of the frames after the execution of the callee `add42`.](/_img/adaptor-frame/adaptor-frames-cleanup.svg)

We just need to pop the number of arguments, pop the adaptor frame, pop all the arguments according to the actual arguments count and return to the caller execution.

TL;DR: the arguments adaptor machinery is not only complex, but costly.

## Removing the arguments adaptor frame

Can we do better? Can we remove the adaptor frame? It turns out that we can indeed.

Let’s review our requirements:

1. We need to be able to access the arguments and registers seamlessly like before. No checks can be done when accessing them. That would be too expensive.
2. We need to be able to construct the rest parameter and the arguments object from the stack.
3. We need to be able to easily clean up an unknown number of arguments when returning from a call.
4. And, of course, we want to do that without an extra frame!

If we want to eliminate the extra frame, then we need to decide where to put the arguments: either in the callee frame or in the caller frame.

### Arguments in the callee frame

Let’s suppose we put the arguments in the callee frame. This seems actually a good idea, since whenever we pop the frame, we also pop all the arguments at once!

The arguments would need to be located somewhere between the saved frame pointer and the end of the frame. It entails that the size of the frame will not be statically known. Accessing an argument will still be easy, it is a simple offset from the frame pointer. But accessing a register is now much more complicated, since it varies according to the number of the arguments.

The stack pointer always points to the last register, we could then use it to access the registers without knowing the arguments count. This approach might actually work, but it has a major drawback. That would entail duplicating all the bytecodes that can access registers and arguments. We would need a `LdaArgument` and a `LdaRegister` instead of simply `Ldar`. Of course, we could also check if we are accessing an argument or a register (positive or negative offsets), but that would require a check in every argument and register access. Clearly too expensive!

### Arguments in the caller frame

Okay… what if we stick with the arguments in the caller frame?

Remember how to calculate the offset of the argument `i` in a frame: `[ai] = 2 + parameter_count - i - 1`. If we have all arguments (not only the parameters), the offset will be `[ai] = 2 + argument_count - i - 1`. That is, for every argument access, we would need to load the actual argument count.

But what happens if we reverse the arguments? Now the offset can be simply calculated as `[ai] = 2 + i`. We don’t need to know how many arguments are in the stack, but if we can guarantee that we'll always have at least the parameter count of arguments in the stack, then we can always use this scheme to calculate the offset.

In other words, the number of arguments pushed in the stack will always be the maximum between the number of arguments and the formal parameter count, and it will be padded with undefined objects if needed.

This has yet another bonus! The receiver is always located in the same offset for any JS function, just above the return address: `[this] = 2`.

This is a clean solution for our requirement number `1` and number `4`. What about the other two requirements? How can we construct the rest parameter and the arguments object? And how to clean the arguments in the stack when returning to the caller? For that we are only missing the argument count. We will need to save it somewhere. The choice here is a bit arbitrary, as long as it is easy to access this information. Two basic choices are: to push it just after the receiver in the caller frame or as part of the callee frame in the fixed header part. We implemented the latter, since it coalesces the fixed header part of Interpreter and Optimized frames.

If we run our example in V8 v8.9 we will see the following stack after `InterpreterArgsThenPush` (note that the arguments are now reversed):

![State of the frames after the execution of `InterpreterPushArgsThenCall` built-in.](/_img/adaptor-frame/no-adaptor-push.svg)

All the execution follows a similar path until we reach InvokeFunctionCode. Here we massage the arguments in case of under-application, pushing as many undefined objects as needed. Note that we do not change anything in case of over-application. Finally we pass the number of arguments to callee’s `Code` through a register. In the case of `x64`, we use the register `rax`.

If the callee hasn’t been optimized yet, we reach `InterpreterEntryTrampoline`, which builds the following stack frame.

![Stack frames without arguments adaptors.](/_img/adaptor-frame/no-adaptor-frames.svg)

The callee frame has an extra slot containing the number of arguments that can be used for constructing the rest parameter or the arguments object and to clean the arguments in the stack before returning to the caller.

To return, we modify `LeaveInterpreterFrame` to read the arguments count in the stack and pop out the maximum number between the argument count and the formal parameter count.

## TurboFan

What about optimized code? Let’s change slightly our initial script to force V8 to compile it with TurboFan:

```js
function add42(x) { return x + 42; }
function callAdd42() { add42(3); }
%PrepareFunctionForOptimization(callAdd42);
callAdd42();
%OptimizeFunctionOnNextCall(callAdd42);
callAdd42();
```

Here we use V8 intrinsics to force V8 to optimize the call, otherwise V8 would only optimize our little function if it becomes hot (used very often). We call it once before optimization to gather some type information that can be used to guide the compilation. Read more about TurboFan [here](https://v8.dev/docs/turbofan).

I’ll show you here only the part of the generated code that is relevant to us.

```nasm
movq rdi,0x1a8e082126ad    ;; Load the function object <JSFunction add42>
push 0x6                   ;; Push SMI 3 as argument
movq rcx,0x1a8e082030d1    ;; <JSGlobal Object>
push rcx                   ;; Push receiver (the global proxy object)
movl rax,0x1               ;; Save the arguments count in rax
movl rcx,[rdi+0x17]        ;; Load function object {Code} field in rcx
call rcx                   ;; Finally, call the code object!
```

Although written in assembler, this code snippet should not be difficult to read if you follow my comments. Essentially, when compiling the call, TF needs to do all the work that was done in `InterpreterPushArgsThenCall`, `Call`, `CallFunction` and `InvokeFunctionCall` built-ins. Hopefully it has more static information to do that and emit less computer instructions.

### TurboFan with the arguments adaptor frame

Now, let’s see in the case of mismatching number of arguments and parameter count. Consider the call `add42(1, 2, 3)`. This is compiled to:

```nasm
movq rdi,0x4250820fff1    ;; Load the function object <JSFunction add42>
;; Push receiver and arguments SMIs 1, 2 and 3
movq rcx,0x42508080dd5    ;; <JSGlobal Object>
push rcx
push 0x2
push 0x4
push 0x6
movl rax,0x3              ;; Save the arguments count in rax
movl rbx,0x1              ;; Save the formal parameters count in rbx
movq r10,0x564ed7fdf840   ;; <ArgumentsAdaptorTrampoline>
call r10                  ;; Call the ArgumentsAdaptorTrampoline
```

As you can see, it is not hard to add support to TF for argument and parameter count mismatch. Just call the arguments adaptor trampoline!

This is however expensive. For every optimized call, we now need to enter in the arguments adaptor trampoline and massage the frame as in non-optimized code. That explains why the performance gain of removing the adaptor frame in optimized code is much larger than on Ignition.

The generated code is however very simple. And returning from it is extremely easy (epilogue):

```nasm
movq rsp,rbp   ;; Clean callee frame
pop rbp
ret 0x8        ;; Pops a single argument (the receiver)
```

We pop our frame and emit a return instruction according to the parameter count. If we have a mismatch in the number of arguments and parameter count, the adaptor frame trampoline will deal with it.

### TurboFan without the arguments adaptor frame

The generated code is essentially the same as in a call with a matching number of arguments. Consider the call `add42(1, 2, 3)`. This generates:

```nasm
movq rdi,0x35ac082126ad    ;; Load the function object <JSFunction add42>
;; Push receiver and arguments 1, 2 and 3 (reversed)
push 0x6
push 0x4
push 0x2
movq rcx,0x35ac082030d1    ;; <JSGlobal Object>
push rcx
movl rax,0x3               ;; Save the arguments count in rax
movl rcx,[rdi+0x17]        ;; Load function object {Code} field in rcx
call rcx                   ;; Finally, call the code object!
```

What about the epilogue of the function? We are not going back to the arguments adaptor trampoline anymore, so the epilogue is indeed a bit more complex than before.

```nasm
movq rcx,[rbp-0x18]        ;; Load the argument count (from callee frame) to rcx
movq rsp,rbp               ;; Pop out callee frame
pop rbp
cmpq rcx,0x0               ;; Compare arguments count with formal parameter count
jg 0x35ac000840c6  <+0x86>
;; If arguments count is smaller (or equal) than the formal parameter count:
ret 0x8                    ;; Return as usual (parameter count is statically known)
;; If we have more arguments in the stack than formal parameters:
pop r10                    ;; Save the return address
leaq rsp,[rsp+rcx*8+0x8]   ;; Pop all arguments according to rcx
push r10                   ;; Recover the return address
retl
```

# Conclusion

The arguments adaptor frame was an ad-hoc solution to calls with a mismatch number of arguments and formal parameters. It was a straightforward solution, but it came with high performance cost and added complexity to the codebase. The performance cost is nowadays exacerbated by many Web frameworks using this feature to create a more flexible API. The simple idea of reversing the arguments in the stack allowed a significant reduction in implementation complexity and removed almost the entire overhead for such calls.
