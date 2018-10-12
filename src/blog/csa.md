---
title: 'Taming architecture complexity in V8 — the CodeStubAssembler'
author: '[Daniel Clifford](https://twitter.com/expatdanno), CodeStubAssembler assembler'
date: 2017-11-16 13:33:37
tags:
  - internals
tweet: '931184976481177600'
---
In this post we’d like to introduce the CodeStubAssembler (CSA), a component in V8 that has been a very useful tool in achieving some [big](/blog/optimizing-proxies) [performance](https://twitter.com/v8js/status/918119002437750784) [wins](https://twitter.com/_gsathya/status/900188695721984000) over the last several V8 releases. The CSA also significantly improved the V8 team’s ability to quickly optimize JavaScript features at a low-level with a high degree of reliability, which improved the team’s development velocity.

## A brief history of builtins and hand-written assembly in V8

To understand the CSA’s role in V8, it’s important to understand a little bit of the context and history that led to its development.

V8 squeezes performance out of JavaScript using a combination of techniques. For JavaScript code that runs a long time, V8’s [TurboFan](/docs/turbofan) optimizing compiler does a great job of speeding up the entire spectrum of ES2015+ functionality for peak performance. However, V8 also needs to execute short-running JavaScript efficiently for good baseline performance. This is especially the case for the so-called **builtin functions** on the pre-defined objects that are available to all JavaScript programs as defined by the [ECMAScript specification](https://tc39.github.io/ecma262/).

Historically, many of these builtin functions were [self-hosted](https://en.wikipedia.org/wiki/Self-hosting), that is, they were authored by a V8 developer in JavaScript—albeit a special V8-internal dialect. To achieve good performance, these self-hosted builtins rely on the same mechanisms V8 uses to optimize user-supplied JavaScript. As with user-supplied code, the self-hosted builtins require a warm-up phase in which type feedback is gathered and they need to be compiled by the optimizing compiler.

Although this technique provides good builtin performance in some situations, it’s possible to do better. The exact semantics of the pre-defined functions on the `Array.prototype` are [specified in exquisite detail](https://tc39.github.io/ecma262/#sec-properties-of-the-array-prototype-object) in the spec. For important and common special cases, V8’s implementers know in advance exactly how these builtin functions should work by understanding the specification, and they use this knowledge to carefully craft custom, hand-tuned versions up front. These _optimized builtins_ handle common cases without warm-up or the need to invoke the optimizing compiler, since by construction baseline performance is already optimal upon first invocation.

To squeeze the best performance out of hand-written built-in JavaScript functions (and from other fast-path V8 code that are also somewhat confusingly called builtins), V8 developers traditionally wrote optimized builtins in assembly language. By using assembly, the hand-written builtin functions were especially fast by, among other things, avoiding expensive calls to V8’s C++ code via trampolines and by taking advantage of V8’s custom register-based [ABI](https://en.wikipedia.org/wiki/Application_binary_interface) that it uses internally to call JavaScript functions.

Because of the advantages of hand-written assembly, V8 accumulated literally tens of thousands of lines of hand-written assembly code for builtins over the years… _per platform_. All of these hand-written assembly builtins were great for improving performance, but new language features are always being standardized, and maintaining and extending this hand-written assembly was laborious and error-prone.

## Enter the CodeStubAssembler

V8 developers wrestled with a dilemma for many years: is it possible to create builtins that have the advantage of hand-written assembly without also being fragile and difficult to maintain?

With the advent of TurboFan the answer to this question is finally “yes”. TurboFan’s backend uses a cross-platform [intermediate representation](https://en.wikipedia.org/wiki/Intermediate_representation) (IR) for low-level machine operations. This low-level machine IR is input to an instruction selector, register allocator, instruction scheduler and code generator that produce very good code on all platforms. The backend also knows about many of the tricks that are used in V8’s hand-written assembly builtins—e.g. how to use and call a custom register-based ABI, how to support machine-level tail calls, and how to elide the construction of stack frames in leaf functions. That knowledge makes the TurboFan backend especially well-suited for generating fast code that integrates well with the rest of V8.

This combination of functionality made a robust and maintainable alternative to hand-written assembly builtins feasible for the first time. The team built a new V8 component—dubbed the CodeStubAssembler or CSA—that defines a portable assembly language built on top of TurboFan’s backend. The CSA adds an API to generate TurboFan machine-level IR directly without having to write and parse JavaScript or apply TurboFan’s JavaScript-specific optimizations. Although this fast-path to code generation is something that only V8 developers can use to speed up the V8 engine internally, this efficient path for generating optimized assembly code in a cross-platform way directly benefits all developers’ JavaScript code in the builtins constructed with the CSA, including the performance-critical bytecode handlers for V8’s interpreter, [Ignition](/docs/ignition).

<figure>
  <img src="/_img/csa/csa.png" alt="">
  <figcaption>The CSA and JavaScript compilation pipelines</figcaption>
</figure>

The CSA interface includes operations that are very low-level and familiar to anybody who has ever written assembly code. For example, it includes functionality like “load this object pointer from a given address” and “multiply these two 32-bit numbers”. The CSA has type verification at the IR level to catch many correctness bugs at compile time rather than runtime. For example, it can ensure that a V8 developer doesn’t accidentally use an object pointer that is loaded from memory as the input for a 32-bit multiplication. This kind of type verification is simply not possible with hand-written assembly stubs.

## A CSA test-drive

To get a better idea of what the CSA offers, let’s go through a quick example. We’ll add a new internal builtin to V8 that returns the string length from an object if it is a String. If the input object is not a String, the builtin will return `undefined`.

First, we add a line to the `BUILTIN_LIST_BASE` macro in V8’s [`builtin-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/builtins/builtins-definitions.h) file that declares the new builtin called `GetStringLength` and specifies that it has a single input parameter that is identified with the constant `kInputObject`:

```cpp
TFS(GetStringLength, kInputObject)
```

The `TFS` macro declares the builtin as a **T**urbo**F**an builtin using standard Code**S**tub linkage, which simply means that it uses the CSA to generate its code and expects parameters to be passed via registers.

We can then define the contents of the builtin in [`builtins-string-gen.cc`](https://cs.chromium.org/chromium/src/v8/src/builtins/builtins-string-gen.cc):

```cpp
TF_BUILTIN(GetStringLength, CodeStubAssembler) {
  Label not_string(this);

  // Fetch the incoming object using the constant we defined for
  // the first parameter.
  Node* const maybe_string = Parameter(Descriptor::kInputObject);

  // Check to see if input is a Smi (a special representation
  // of small numbers). This needs to be done before the IsString
  // check below, since IsString assumes its argument is an
  // object pointer and not a Smi. If the argument is indeed a
  // Smi, jump to the label |not_string|.
  GotoIf(TaggedIsSmi(maybe_string), &not_string);

  // Check to see if the input object is a string. If not, jump to
  // the label |not_string|.
  GotoIfNot(IsString(maybe_string), &not_string);

  // Load the length of the string (having ended up in this code
  // path because we verified it was string above) and return it
  // using a CSA "macro" LoadStringLength.
  Return(LoadStringLength(maybe_string));

  // Define the location of label that is the target of the failed
  // IsString check above.
  BIND(&not_string);

  // Input object isn't a string. Return the JavaScript undefined
  // constant.
  Return(UndefinedConstant());
}
```

Note that in the example above, there are two types of instructions used. There are _primitive_ CSA instructions that translate directly into one or two assembly instructions like `GotoIf` and `Return`. There are a fixed set of pre-defined CSA primitive instructions roughly corresponding to the most commonly used assembly instructions you would find on one of V8’s supported chip architectures. Others instructions in the example are _macro_ instructions, like `LoadStringLength`, `TaggedIsSmi`, and `IsString`, that are convenience functions to output one or more primitive or macro instructions inline. Macro instructions are used to encapsulate commonly used V8 implementation idioms for easy reuse. They can be arbitrarily long and new macro instructions can be easily defined by V8 developers whenever needed.

After compiling V8 with the above changes, we can run `mksnapshot`, the tool that compiles builtins to prepare them for V8’s snapshot, with the `--print-code` command-line option. This options prints the generated assembly code for each builtin. If we `grep` for `GetStringLength` in the output, we get the following result on x64 (the code output is cleaned up a bit to make it more readable):

```asm
  test al,0x1
  jz not_string
  movq rbx,[rax-0x1]
  cmpb [rbx+0xb],0x80
  jnc not_string
  movq rax,[rax+0xf]
  retl
not_string:
  movq rax,[r13-0x60]
  retl
```

On 32-bit ARM platforms, the following code is generated by `mksnapshot`:

```asm
  tst r0, #1
  beq +28 -> not_string
  ldr r1, [r0, #-1]
  ldrb r1, [r1, #+7]
  cmp r1, #128
  bge +12 -> not_string
  ldr r0, [r0, #+7]
  bx lr
not_string:
  ldr r0, [r10, #+16]
  bx lr
```

Even though our new builtin uses a non-standard (at least non-C++) calling convention, it’s possible to write test cases for it. The following code can be added to [`test-run-stubs.cc`](https://cs.chromium.org/chromium/src/v8/test/cctest/compiler/test-run-stubs.cc) to test the builtin on all platforms:

```cpp
TEST(GetStringLength) {
  HandleAndZoneScope scope;
  Isolate* isolate = scope.main_isolate();
  Heap* heap = isolate->heap();
  Zone* zone = scope.main_zone();

  // Test the case where input is a string
  StubTester tester(isolate, zone, Builtins::kGetStringLength);
  Handle<String> input_string(
      isolate->factory()->
        NewStringFromAsciiChecked("Oktoberfest"));
  Handle<Object> result1 = tester.Call(input_string);
  CHECK_EQ(11, Handle<Smi>::cast(result1)->value());

  // Test the case where input is not a string (e.g. undefined)
  Handle<Object> result2 =
      tester.Call(factory->undefined_value());
  CHECK(result2->IsUndefined(isolate));
}
```

For more details about using the CSA for different kinds of builtins and for further examples, see [this wiki page](/docs/csa-builtins).

## A V8 developer velocity multiplier

The CSA is more than just an universal assembly language that targets multiple platforms. It enables much quicker turnaround when implementing new features compared to hand-writing code for each architecture as we used to do. It does this by providing all of the benefits of hand-written assembly while protecting developers against its most treacherous pitfalls:

- With the CSA, developers can write builtin code with a cross-platform set of low-level primitives that translate directly to assembly instructions. The CSA’s instruction selector ensures that this code is optimal on all of the platforms that V8 targets without requiring V8 developers to be experts in each of those platform’s assembly languages.
- The CSA’s interface has optional types to ensure that the values manipulated by the low-level generated assembly are of the type that the code author expects.
- Register allocation between assembly instructions is done by the CSA automatically rather than explicitly by hand, including building stack frames and spilling values to the stack if a builtin uses more registers than available or makes call. This eliminates a whole class of subtle, hard-to-find bugs that plagued hand-written assembly builtins. By making the generated code less fragile the CSA drastically reduces the time required to write correct low-level builtins.
- The CSA understands ABI calling conventions—both standard C++ and internal V8 register-based ones—making it possible to easily interoperate between CSA-generated code and other parts of V8.
- Since CSA code is C++, it’s easy to encapsulate common code generation patterns in macros that can be easily reused in many builtins.
- Because V8 uses the CSA to generate the bytecode handlers for Ignition, it is very easy to inline the functionality of CSA-based builtins directly into the handlers to improve the interpreter’s performance.
- V8’s testing framework supports testing CSA functionality and CSA-generated builtins from C++ without having to write assembly adapters.

All in all, the CSA has been a game changer for V8 development. It has significantly improved the team’s ability to optimize V8. That means we are able to optimize more of the JavaScript language faster for V8’s embedders.
