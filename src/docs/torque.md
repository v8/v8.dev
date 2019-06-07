---
title: 'V8 Torque user manual'
---
V8 Torque is a language that allows developers contributing to the V8 project to express changes in the VM by focusing on the _intent_ of their changes to the VM, rather than preoccupying themselves with unrelated implementation details. The language was designed to be simple enough to make it easy to directly translate the [ECMAScript specification](https://tc39.es/ecma262/) into an implementation in V8, but powerful enough to express the low-level V8 optimization tricks in a robust way, like creating fast-paths based on tests for specific object-shapes.

Torque will be familiar to V8 engineers and JavaScript developers, combining a TypeScript-like syntax that eases both writing and understanding V8 code with syntax and types that reflects concepts that are already common in the [`CodeStubAssembler`](/blog/csa). With a strong type system and structured control flow, Torque ensures correctness by construction. Torque’s expressiveness is sufficient to express almost all of the functionality that is [currently found in V8’s builtins](/docs/builtin-functions). It also is very interoperable with `CodeStubAssembler` builtins and `macro`s written in C++, allowing Torque code to use hand-written CSA functionality and vice-versa.

Torque provides language constructs to represent high-level, semantically-rich tidbits of V8 implementation, and the Torque compiler converts these morsels into efficient assembly code using the `CodeStubAssembler`. Both Torque’s language structure and the Torque compiler’s error checking ensure correctness in ways that were previously laborious and error-prone with direct usage of the `CodeStubAssembler`. Traditionally, writing optimal code with the `CodeStubAssembler` required V8 engineers to carry a lot of specialized knowledge in their heads — much of which was never formally captured in any written documentation — to avoid subtle pitfalls in their implementation. Without that knowledge, the learning curve for writing efficient builtins was steep. Even armed with the necessary knowledge, non-obvious and non-policed gotchas often led to correctness or [security](https://bugs.chromium.org/p/chromium/issues/detail?id=775888) [bugs](https://bugs.chromium.org/p/chromium/issues/detail?id=785804). With Torque, many of these pitfalls can be avoided and recognized automatically by the Torque compiler.

## Getting started

Most source written in Torque is checked into the V8 repository under [the `src/builtins` directory](https://github.com/v8/v8/tree/master/src/builtins), with the file extension `.tq`. (The actual Torque compiler can be found under [`src/torque`](https://github.com/v8/v8/tree/master/src/torque).). Tests for Torque functionality are checked in under [`test/torque`](https://github.com/v8/v8/tree/master/test/torque).

To give you a taste of the language, let’s write a V8 builtin that prints “Hello World!”. To do this, we’ll add a Torque `macro` in a test case and call it from the `cctest` test framework.

Begin by opening up the `test/torque/test-torque.tq` file and add the following code at the end (but before the last closing `}`):

```torque
macro PrintHelloWorld() {
  Print('Hello world!');
}
```

Next, open up `test/cctest/torque/test-torque.cc` and add the following test case that uses the new Torque code to build a code stub:

```cpp
TEST(HelloWorld) {
  Isolate* isolate(CcTest::InitIsolateOnce());
  CodeAssemblerTester asm_tester(isolate, 0);
  TestBuiltinsFromDSLAssembler m(asm_tester.state());
  {
    m.PrintHelloWorld();
    m.Return(m.UndefinedConstant());
  }
  FunctionTester ft(asm_tester.GenerateCode(), 0);
  ft.Call();
}
```

Then [build the `cctest` executable](/docs/test), and finally execute the `cctest` test to print ‘Hello world’:

```bash
$ out/x64.debug/cctest test-torque/HelloWorld
Hello world!
```

## How Torque generates code

The Torque compiler doesn’t create machine code directly, but rather generates C++ code that calls V8’s existing `CodeStubAssembler` interface. The `CodeStubAssembler` uses the [TurboFan compiler’s](https://v8.dev/docs/turbofan) backend to generate efficient code. Torque compilation therefore requires multiple steps:

1. The `gn` build first runs the Torque compiler. It processes all `*.tq` files, outputting corresponding `*-gen.cc` files (one `.cc` file per Torque namespace). The `.cc` files that are generated use TurboFan’s `CodeStubAssembler` interface for generating code.
1. The `gn` build then compiles the generated `.cc` files from step 1 into the `mksnapshot` executable.
1. When `mksnapshot` runs, all of V8’s builtins are generated and packaged in to the snapshot file, including those that are defined in Torque and any other builtins that use Torque-defined functionality.
1. The rest of V8 is built. All of Torque-authored builtins are made accessible via the snapshot file which is linked into V8. They can be called like any other builtin. In the final packaging, no direct traces of Torque remain (except for debug information): neither the Torque source code (`.tq` files) nor Torque-generated `.cc` files are included in the `d8` or `chrome` executable.

Graphically, the build process looks like this:

<figure>
  <img src="/_img/docs/torque/build-process.svg" intrinsicsize="800x480" alt="">
</figure>

## Torque tooling { #tooling }

Basic tooling and development environment support is available for Torque.

- There is a Visual Studio code syntax highlighting plugin available for Torque: `tools/torque/vscode-torque`
- There is also a formatting tool that should be used after changing `.tq` files: `tools/torque/format-torque.py -i <filename>`

## Troubleshooting builds involving Torque { #troubleshooting }

Why do you need to know this? Understanding how Torque files get converted into machine code is important because different problems (and bugs) can potentially arise in the different stages of translating Torque into the binary bits embedded in the snapshot:

- If you have a syntax or semantic error in Torque code (i.e. a `.tq` file), the Torque compiler fails. The V8 build aborts during this stage, and you will not see other errors that may be uncovered by later parts of the build.
- Once your Torque code is syntactically correct and passes the Torque compiler’s (more or less) rigorous semantic checks, the build of `mksnapshot` can still fail. This most frequently happens with inconsistencies in external definitions provided in `.tq` files. Definitions marked with the `extern` keyword in Torque code signal to the Torque compiler that the definition of required functionality is found in C++. Currently, the coupling between `extern` definitions from `.tq` files and the C++ code to which those `extern` definitions refer is loose, and there is no verification at Torque-compile time of that coupling. When `extern` definitions don’t match (or in the most subtle cases mask) the functionality that they access in the `code-stub-assembler.h` header file or other V8 headers, the C++ build of `mksnapshot` fails, usually in `*-gen.cc` files.
- Even once `mksnapshot` successfully builds, it can fail during execution if a Torque-provided builtin has a bug. Many builtins run as part of snapshot creation, including Torque-generated ones. For example, `Array.prototype.splice`, a Torque-authored builtin, is called as part of the JavaScript snapshot initialization process to setup the default JavaScript environment. If there is a bug in the implementation, `mksnapshot` crashes during execution. When `mksnapshot` crashes, it’s sometimes useful to call `mksnapshot` passing the `--gdb-jit-full` flag, which generates extra debug information that provides useful context, e.g. names for Torque-generated builtins in `gdb` stack crawls.
- Of course, even if Torque-authored code makes it through `mksnapshot`, it still may be buggy or crash. Adding test cases to `torque-test.tq` and `torque-test.cc` is a good way to ensure that your Torque code does what you actually expect. If your Torque code does end up crashing in `d8` or `chrome`, the `--gdb-jit-full` flag is again very useful.

## `constexpr`: compile-time vs. run-time { #constexpr }

Understanding the Torque build process is also important to understanding a core feature in the Torque language: `constexpr`.

Torque allows evaluation of expressions in Torque code at runtime (i.e. when V8 builtins are executed as part of executing JavaScript). However, it also allows expressions to be executed at compile time (i.e. as part of the Torque build process and before the V8 library and `d8` executable have even been created).

Torque uses the `constexpr` keyword to indicate that an expression must be evaluated at build-time. Its usage is somewhat analogous to [C++’s `constexpr`](https://en.cppreference.com/w/cpp/language/constexpr): in addition to borrowing the `constexpr` keyword and some of its syntax from C++, Torque similarly uses `constexpr` to indicate the distinction between evaluation at compile-time and runtime.

However, there are some subtle differences in Torque’s `constexpr` semantics. In C++, `constexpr` expressions can be evaluated completely by the C++ compiler. In Torque `constexpr` expressions cannot fully be evaluated by the Torque compiler, but instead map to C++ types, variables and expressions that can be (and must be) fully evaluated when running `mksnapshot`. From the Torque-writer’s perspective, `constexpr` expressions do not generate code executed at runtime, so in that sense they are compile-time, even though they are technically evaluated by C++ code external to Torque that `mksnapshot` runs. So, in Torque, `constexpr` essentially means “`mksnapshot`-time”, not “compile time”.

In combination with generics, `constexpr` is a powerful Torque tool that can be used to automate the generation of multiple very efficient specialized builtins that differ from each other in a small number of specific details that can be anticipated by V8 developers in advance.

## Files

Torque code is packaged in individual source files. Each source file consists of a series of declarations, which themselves can optionally wrapped in a namespace declaration to separate the namespaces of declarations. The grammar for a `.tq` file is as follows:

<pre><code class="language-grammar">Declaration :
  AbstractTypeDeclaration
  ClassDeclaration
  TypeAliasDeclaration
  CallableDeclaration
  ConstDeclaration
  GenericSpecialization

NamespaceDeclaration :
  <b>namespace</b> IdentifierName <b>{</b> Declaration* <b>}</b>

FileDeclaration :
  NamespaceDeclaration
  Declaration</code></pre>

## Namespaces

Torque namespaces allow declarations to be independent namespaces. They are similar to C++ namespaces. They allow you to create declarations that are not automatically visible in other namespaces. They can be nested, and declarations inside a nested namespace can access the declarations in the namespace that contains them without qualification. Declarations that are not explicitly in a namespace declaration are put in a shared global default namespace that is visible to all namespaces. Namespaces can be reopened, allowing them to be defined over multiple files.

For example:

```torque
macro IsJSObject(o: Object): bool { … }  // In default namespace

namespace array {
  macro IsJSArray(o: Object): bool { … }  // In array namespace
};

namespace string {
  // …
  macro TestVisibility() {
    IsJsObject(o); // OK, global namespace visible here
    IsJSArray(o);  // ERROR, not visible in this namespace
  }
  // …
};

namespace array {
  // OK, namespace has been re-opened.
  macro EnsureWriteableFastElements(array: JSArray){ … }
};
```

Conceptually, a Torque namespace maps to a specific subclass of `CodeStubAssembler`, and most Torque namespace declarations map to C++ declarations in that subclass. When the Torque compiler process all of the `.tq` files in V8, all of the declarations in a namespace are collected and written out together into a predictably-named `CodeStubAssembler` subclass that’s generated at compile-time.

For example, the following namespace declaration specifies two Torque `macro`s in the `foo` namespace. (`macro`s are a Torque primitive that specifies how to generate a bunch of CSA code and they are discussed in more detail below, but for this example it suffices to know that they produce CSA-generating C++ code that would have been hand-written in a method of a `CodeStubAssembler` class in a pre-Torque world.)

```torque
namespace foo {
  extern macro Bar();
  macro Baz() {}
};
```

This namespace declaration would result in two generated files in the build directory called `builtins-foo-gen-from-idl.h` and `builtins-foo-gen-from-idl.cc`. These files contain the declaration and definition of a `CodeStubAssembler`-derivative class containing the C++ that implements the Torque code in the `foo` namespace.

In this example, `builtins-foo-gen-from-idl.h` declares `FooBuiltinsFromDSLAssembler`, a subclass of a similarly-named `FooBuiltinsAssembler`. Both class names are mechanically generated by converting the namespace name to a CamelCase identifier:

```cpp
class FooBuiltinsFromDSLAssembler: public FooBuiltinsAssembler {
  public:
    // …
    void Baz();
};
```

`FooBuiltinsFromDSLAssembler` contains all of the Torque-implemented declarations for the `foo` namespace. In this case it only contains the method `Baz`, a C++ method that uses the CSA interface to generate code for `Baz`’s Torque implementation.

Note that namespace classes do not directly derive from the class of their parent namespace, but rather provide a level of indirection between themselves and their parent namespace’s superclass that allows direct CSA-based functionality to be added to the namespace. In this case, `FooBuiltinsFromDSLAssembler` subclasses `FooBuiltinsAssembler`, which must be provided as a pure-CSA implementation. It provides an intermediary place to put non-Torque implemented (i.e. hand-written CSA) functionality that also belongs to the namespace. In this example, `FooBuiltinsAssembler` must implement `Bar`, since it is declared in a Torque as an `external macro`, i.e. it is not implemented in Torque code but provided through a hand-written CSA implementation in C++.

New namespaces must be added to the `BUILD.gn` file in the `torque_namespaces` variable.

## Declarations

### Types

Torque is strongly typed. Its type system is the basis for many of the security and correctness guarantees it provides.

However, with a few notable exceptions discussed later, Torque doesn’t actually inherently know very much about the core types that are used to write most Torque code. In order to enable better interoperability between Torque and hand-written `CodeStubAssembler` code, Torque’s type system rigorously specifies the relationship between Torque types, but it is much less rigorous in specifying how the types themselves actually work. Instead, it is loosely coupled with `CodeStubAssembler` and C++ types through explicit type mappings, and it relies on the C++ compiler to enforce the rigor of that mapping.

In Torque, there are three different kinds of types: Abstract, Function and Union.

#### Abstract types

Torque’s abstract types map directly to C++ compile-time and CodeStubAssembler runtime values. Their declarations specify a name and a relationship to C++ types:

<pre><code class="language-grammar">AbstractTypeDeclaration :
  <b>type</b> IdentifierName ExtendsDeclaration<sub>opt</sub> GeneratesDeclaration<sub>opt</sub> ConstexprDeclaration<sub>opt</sub>

ExtendsDeclaration :
  <b>extends</b> IdentifierName <b>;</b>

GeneratesDeclaration :
  <b>generates</b> StringLiteral <b>;</b>

ConstexprDeclaration :
  <b>constexpr</b> StringLiteral <b>;</b></code></pre>

`IdentifierName` specifies the name of the abstract type, and `ExtendsDeclaration` optionally specifies the type from which the declared type derives. `GeneratesDeclaration` optionally specifies a string literal which corresponds to the C++ `TNode` type used in `CodeStubAssembler` code to contain a runtime value of its type. `ConstexprDeclaration` is a string literal specifying the C++ type corresponding to the `constexpr` version of the Torque type for build-time (`mksnapshot`-time) evaluation.

Here’s an example from `base.tq` for Torque’s 31- and 32-bit signed integer types:

```torque
type int32 generates 'TNode<Int32T>' constexpr 'int32_t';
type int31 extends int32 generates 'TNode<Int32T>' constexpr 'int31_t';
```

#### Class types

Class types make it possible to define, allocate and manipulate structured objects on the V8 GC heap from Torque code. Each Torque class type must correspond to a subclass of HeapObject in C++ code. In order to minimize the expense of maintaining boilerplate object-accessing code between V8’s C++ and Torque implementation, the Torque class definitions are used to generate the required C++ object-accesing code whenever possible (and appropriate) to reduce the hassle of keeping C++ and Torque synchronized by hand.

<pre><code class="language-grammar">ClassDeclaration :
  ClassAnnotation<b>*</b> <b>extern<sub>opt</sub></b> <b>class</b> IdentifierName ExtendsDeclaration<sub>opt</sub> GeneratesDeclaration<sub>opt</sub> <b>{</b>
    ClassMethodDeclaration<b>*</b>
    ClassFieldDeclaration<b>*</b>
  <b>}</b>

ClassAnnotation :
  <b>@abstract</b>
  <b>@dirtyInstantiatedAbstractClass</b>
  <b>@hasSameInstanceTypeAsParent</b>
  <b>@generatePrint</b>
  <b>@noVerifier</b>
  <b>@generateCppClass</b>

ClassMethodDeclaration :
  <b>transitioning<sub>opt</sub></b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitParameters ReturnType<sub>opt</sub> LabelsDeclaration<sub>opt</sub> StatementBlock

ClassFieldDeclaration :
  ConditionalAnnotation<sub>opt</sub> <b>@noVerifier<sub>opt</sub></b> <b>weak</b><sub>opt</sub> FieldDeclaration;

ConditionalAnnotation :
  ConditionalAnnotationTag <b>(</b> Identifier <b>)</b>

ConditionalAnnotationTag :
  <b>@if</b>
  <b>@ifnot</b>

FieldDeclaration :
  Identifier <b>:</b> Type <b>;</b>
</code></pre>

An example class:

```torque
extern class JSFunction extends JSObject {
  shared_function_info: SharedFunctionInfo;
  context: Context;
  feedback_cell: FeedbackCell;
  weak code: Code;
  @noVerifier weak prototype_or_initial_map: JSReceiver | Map;
}
```

`extern` signifies that this class is defined in C++, rather than existing only for Torque-internal use.

On the Torque side, the field declarations in classes implicitly generate field getters and setters, e.g.:

```torque
operator '.shared_function_info' macro LoadJSFunctionSharedFunctionInfo(JSFunction): SharedFunctionInfo;
operator '.shared_function_info=' macro StoreJSFunctionSharedFunctionInfo(JSFunction, SharedFunctionInfo);
```

As described above, the fields definied in Torque classes generate C++ code that removes the need for duplicate boilerplate accessor and heap visitor code, e.g. the JSFunction class definition above generates the following C++-accessible field offsets in `js-objects.h`:

```cpp
#define TORQUE_GENERATED_JSFUNCTION_FIELDS(V) \
V(kStartOfStrongFieldsOffset, 0) \
V(kSharedFunctionInfoOffset, kTaggedSize) \
V(kContextOffset, kTaggedSize) \
V(kFeedbackCellOffset, kTaggedSize) \
V(kEndOfStrongFieldsOffset, 0) \
V(kStartOfWeakFieldsOffset, 0) \
V(kCodeOffset, kTaggedSize) \
V(kPrototypeOrInitialMapOffset, kTaggedSize) \
V(kEndOfWeakFieldsOffset, 0) \
V(kSize, 0) \
```

Note that markers for the strong and weak fields sections are automatically inserted. Torque enforces that each of those sections is unique and continuous, while scalar values can occur anywhere outside of these two sections.

If the `@generatePrint` annotation is added, then the generator will implement a C++ function that prints the field values as defined by the Torque layout. Using the JSFunction example, the signature would be `void JSFunction::JSFunctionPrint(std::ostream& os)`.

`@generateCppClass` instructs the Torque compiler to generate a C++ class template with most of the usual boilerplate that is required for a class definition, such as constructors, cast functions, and field getter/setter functions. The runtime class can inherit from this template. For example, `Tuple2` inherits from `TorqueGeneratedTuple2<Tuple2, Struct>`.

The Torque compiler also generates verification code for all `extern` classes, unless the class opts out with the `@noVerifier` annotation. For example, the JSFunction class definition above will generate a C++ method `void TorqueGeneratedClassVerifiers::JSFunctionVerify(JSFunction o, Isolate* isolate)` which verifies that its fields are valid according to the Torque type definition. This generated function can be called from the corresponding verifier function in `src/objects-debug.cc`. (To run those verifiers before and after every GC, build with `v8_enable_verify_heap = true` and run with `--verify-heap`.) One subtle behavior to note: verifiers must often accept partially-intialized objects, so the generated verifier will accept `undefined` in any field on any class deriving from `JSObject`.

`@if` and `@ifnot` mark fields that should be included in some build configurations but not others. They accept values from the list in `BuildFlags`, in `src/torque/torque-parser.cc`.

`@abstract` indicates that the class itself is not instantiated, and does not have its own instance type: the instance types that logically belong to the class are the instance types of the derived classes.

`@dirtyInstantiatedAbstractClass` indicates that a class is used as both an abstract base class and a concrete class.

`@hasSameInstanceTypeAsParent` indicates classes that have the same instance types as their parent class, but rename some fields, or possibly have a different map. In such cases, the parent class is not abstract.

#### Union types

Union types express that a value belongs to one of several possible types. We only allow union types for tagged values, because they can be distinguished at runtime using the map pointer. For example, JavaScript numbers are either Smi values or allocated `HeapNumber` objects.

```torque
type Number = Smi | HeapNumber;
```

Union types satisfy the following equalities:

- `A | B = B | A`
- `A | (B | C) = (A | B) | C`
- `A | B = A` if `B` is a subtype of `A`

It is only allowed to form union types from tagged types because untagged types cannot be distinguished at runtime.

When mapping union types to CSA, the most specific common supertype of all the types of the union type is selected, with the exception of `Number` and `Numeric`, which are mapped to the corresponding CSA union types.

#### Function pointer types

Function pointers can only point to builtins defined in Torque, since this guarantees the default ABI. They are especially useful to reduce binary code size.

While function pointer types are anonymous (like in C), they can be bound to a type alias (like a `typedef` in C).

```torque
type CompareBuiltinFn = builtin(implicit context: Context)(Object, Object, Object) => Number;
```

#### Special types

There are two special types indicated by the keywords `void` and `never`. `void` is used as the return type for callables that do not return a value, and `never` is used as the return type for callables that never actually return (i.e. only exit through exceptional paths).

#### Transient types

In V8, heap objects can change layout at runtime. To express object layouts that are subject to change or other temporary assumptions in the type system, Torque supports the concept of a “transient type”. When declaring an abstract type, adding the keyword `transient` marks it as a transient type.

```torque
// A HeapObject with a JSArray map, and either fast packed elements, or fast
// holey elements when the global NoElementsProtector is not invalidated.
transient type FastJSArray extends JSArray
    generates 'TNode<JSArray>';
```

For example, in the case of `FastJSArray`, the transient type is invalidated if the array changes to dictionary elements or if the global `NoElementsProtector` is invalidated. To express this in Torque, annotate all callables that could potentially do that as `transitioning`. For example, calling a JavaScript function can execute arbitrary JavaScript, so it is `transitioning`.

```torque
extern transitioning macro Call(implicit context: Context)
                               (Callable, Object): Object;
```

The way this is policed in the type system is that it is illegal to access a value of a transient type across a transitioning operation.

```torque
const fastArray : FastJSArray = Cast<FastJSArray>(array) otherwise Bailout;
Call(f, Undefined);
return fastArray; // Type error: fastArray is invalid here.
```

### Callables

Callables are conceptually like functions in JavaScript or C++, but they have some additional semantics that allow them to interact in useful ways with CSA code and with the V8 runtime. Torque provides several different types of callables: `macro`s, `builtin`s, `runtime`s and `intrinsic`s.

<pre><code class="language-grammar">CallableDeclaration :
  MacroDeclaration
  BuiltinDeclaration
  RuntimeDeclaration
  IntrinsicDeclaration</code></pre>

#### `macro` callables

Macros are a callable that correspond to a chunk of generated CSA-producing C++. `macro`s can either be fully defined in Torque, in which case the CSA code is generated by Torque, or marked `extern`, in which case the implementation must be provided as hand-written CSA code in a CodeStubAssembler class. Conceptually, it’s useful to think of `macro`s of chunks of inlinable CSA code that are inlined at callsites.

`macro` declarations in Torque take the following form:

<pre><code class="language-grammar">MacroDeclaration :
   <b>transitioning<sub>opt</sub></b> <b>macro</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitParameters ReturnType<sub>opt</sub> LabelsDeclaration<sub>opt</sub> StatementBlock
  <b>extern</b> <b>transitioning<sub>opt</sub></b> <b>macro</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitTypes ReturnType<sub>opt</sub> LabelsDeclaration<sub>opt</sub> <b>;</b>
</code></pre>

Every non-`extern` Torque `macro` uses the `StatementBlock` body of the `macro` to create a CSA-generating function in its namespace’s generated `Assembler` class. This code looks just like other code that you might find in `code-stub-assembler.cc`, albeit a bit less readable because it’s machine-generated. `macro`s that are marked `extern` have no body written in Torque and simply provide the interface to hand-written C++ CSA code so that it’s usable from Torque.

`macro` definitions specify implicit and explict parameters, an optional return type and optional labels. Parameters and return types will be discussed in more detail below, but for now it suffices to know that they work somewhat like TypeScript parameters, which as discussed in the Function Types section of the TypeScript documentation [here](https://www.typescriptlang.org/docs/handbook/functions.html).

Labels are a mechanism for exceptional exit from a `macro`. They map 1:1 to CSA labels and are added as `CodeStubAssemblerLabels*`-typed parameters to the C++ method generated for the `macro`. Their exact semantics are discussed below, but for the purpose of a `macro` declartion, the comma-separated list of a `macro`’s labels is optionally provided with the `labels` keywords and positioned after the `macro`’s parameter lists and return type.

Here’s an example from `base.tq` of external and Torque-defined `macro`s:

```torque
extern macro BranchIfFastJSArrayForCopy(Object, Context): never
    labels Taken, NotTaken;
macro BranchIfNotFastJSArrayForCopy(implicit context: Context)(o: Object):
    never
    labels Taken, NotTaken {
  BranchIfFastJSArrayForCopy(o, context) otherwise NotTaken, Taken;
}
```

#### `builtin` callables

`builtin`s are similar to `macro`s in that they can either be fully defined in Torque or marked `extern`. In the Torque-based builtin case, the body for the builtin is used to generate a V8 builtin that can be called just like any other V8 builtin, including automatically adding the relevant information in `builtin-definitions.h`. Like `macro`s, Torque `builtin`s that are marked `extern` have no Torque-based body and simply provide an interface to existing V8 `builtin`s so that they can be used from Torque code.

`builtin` declarations in Torque have the following form:

<pre><code class="language-grammar">MacroDeclaration :
  <b>transitioning<sub>opt</sub></b> <b>javascript<sub>opt</sub></b> <b>builtin</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitParametersOrVarArgs ReturnType<sub>opt</sub> StatementBlock
  <b>extern <b>transitioning<sub>opt</sub></b> javascript<sub>opt</sub> builtin</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitTypesOrVarArgs ReturnType<sub>opt</sub> <b>;</b>
</code></pre>

There is only one copy of the code for a Torque builtin, and that is in the generated builtin code object. Unlike `macro`s, when `builtin`s are called from Torque code, the CSA code is not inlined at the callsite, but instead a call is generated to the builtin.

`builtin`s cannot have labels.

If you are coding the implementation of a `builtin`, you can craft a [tailcall](https://en.wikipedia.org/wiki/Tail_call) to a builtin or a runtime function iff (if and only if) it's the final call in the builtin. The compiler may be able to avoid creating a new stack frame in this case. Simply add `tail` before the call, as in `tail MyBuiltin(foo, bar);`.

#### `runtime` callables

`runtime`s are similar to `builtin`s in that they can expose an interface to external functionality to Torque. However, instead of being implemented in CSA, the functionality provided by a `runtime` must always be implemented in the V8 as a standard runtime callback.

`runtime` declarations in Torque have the following form:

<pre><code class="language-grammar">MacroDeclaration :
  <b>extern <b>transitioning<sub>opt</sub></b> runtime</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitTypesOrVarArgs ReturnType<sub>opt</sub> <b>;</b>
</code></pre>

The `extern runtime` specified with name <i>IdentifierName</i> corresponds to the runtime function specified by <code>Runtime::k<i>IdentifierName</i></code>.

Like `builtin`s, `runtime`s cannot have labels.

You can also call a `runtime` function as a tailcall when appropriate. Simply include the `tail` keyword before the call.

#### `intrinsic` callables

`intrinsic`s are builtin Torque callables that provide access to internal funtionality that can’t be otherwise implemented in Torque. They are declared in Torque, but not defined, since the implementation is provided by the Torque compiler. `intrinsic` declarations use the following grammar:

<pre><code class="language-grammar">IntrinsicDeclaration :
  <b>intrinsic</b> <b>%</b> IdentifierName ImplicitParameters<sub>opt</sub> ExplicitParameters ReturnType<sub>opt</sub> <b>;</b>
</code></pre>

For the most part, “user” Torque code should rarely have to use `intrinsic`s directly. The currently supported intrinsics are:

```torque
// %RawObjectCast downcasts from Object to a subtype of Object without
// rigorous testing if the object is actually the destination type.
// RawObjectCasts should *never* (well, almost never) be used anywhere in
// Torque code except for in Torque-based UnsafeCast operators preceeded by an
// appropriate type assert()
intrinsic %RawObjectCast<A: type>(o: Object): A;

// %RawPointerCast downcasts from RawPtr to a subtype of RawPtr without
// rigorous testing if the object is actually the destination type.
intrinsic %RawPointerCast<A: type>(p: RawPtr): A;

// %RawConstexprCast converts one compile-time constant value to another.
// Both the source and destination types should be 'constexpr'.
// %RawConstexprCast translate to static_casts in the generated C++ code.
intrinsic %RawConstexprCast<To: type, From: type>(f: From): To;

// %FromConstexpr converts a constexpr value into into a non-constexpr
// value. Currently, only conversion to the following non-constexpr types
// are supported: Smi, Number, String, uintptr, intptr, and int32
intrinsic %FromConstexpr<To: type, From: type>(b: From): To;

// %Allocate allocates an unitialized object of size 'size' from V8's
// GC heap and "reinterpret casts" the resulting object pointer to the
// specified Torque class, allowing constructors to subsequently use
// standard field access operators to initialize the object.
// This intrinsic should never be called from Torque code. It's used
// internally when desugaring the 'new' operator.
intrinsic %Allocate<Class: type>(size: intptr): Class;
```

Like `builtin`s and `runtime`s, `intrinsic`s cannot have labels.

### Explicit parameters

Declarations of Torque-defined Callables, e.g. Torque `macro`s and `builtin`s, have explicit parameter lists. They are a list of identifier and type pairs using a syntax reminiscent of typed TypeScript function parameter lists, with the exception that Torque doesn’t support optional parameters or default parameters. Moreover, Torque-implement `builtin`s can optonally support rest parameters if the builtin uses V8’s internal JavaScript calling convention (e.g. is marked with the `javascript` keyword).

<pre><code class="language-grammar">ExplicitParameters :
  <b>(</b> ( IdentifierName <b>:</b> TypeIdentifierName )<sub>list*</sub> <b>)</b>
  <b>(</b> ( IdentifierName <b>:</b> TypeIdentifierName )<sub>list+</sub> (<b>, ...</b> IdentifierName )<sub>opt</sub> <b>)</b>
</code></pre>

As an example:

```torque
javascript builtin ArraySlice(
    (implicit context: Context)(receiver: Object, ...arguments): Object {
  // …
}
```

### Implicit parameters

Torque callables can specify implicit parameters using something similar to [Scala’s implicit parameters](https://docs.scala-lang.org/tour/implicit-parameters.html):

<pre><code class="language-grammar">ImplicitParameters :
  <b>( implicit</b> ( IdentifierName <b>:</b> TypeIdentifierName )<sub>list*</sub> <b>)</b>
</code></pre>

Concretely: A `macro` can declare implicit parameters in addition to explicit ones:

```torque
macro Foo(implicit context: Context)(x: Smi, y: Smi)
```

When mapping to CSA, implicit parameters and explicit parameters are treated the same and form a joint parameter list.

Implicit parameters are not mentioned at the callsite, but instead are passed implicitly: `Foo(4, 5)`. For this to work, `Foo(4, 5)` must be called in a context that provides a value named `context`. Example:

```torque
macro Bar(implicit context: Context)() {
  Foo(4, 5);
}
```

In contrast to Scala, we forbid this if the names of the implicit parameters are not identical.
For overload resolution not to cause fragile and confusing behavior, we want that the implicit parameters do not influence overload resolution at all. That is: when comparing candidates of an overload set, we do not consider the available implicit bindings at the call-site. Only after we found a single best overload, we check if implicit bindings for the implicit parameters are available.

Having the implicit parameters left of the explicit parameters is different from Scala, but maps better to the existing convention in CSA to have the `context` parameter first.

### Overload resolution

Torque `macro`s and operators (which are just aliases for `macro`s) allow for argument-type overloading. The overloading rules are inspired by the ones of C++: an overload is selected if it is strictly better than all alternatives. This means that it has to be strictly better in at least one parameter, and better or equally good in all others.

When comparing a pair of corresponding parameters of two overloads…

- …they are considered equally good if:
    - they are equal;
    - both require some implicit conversion.
- …one is considered better if:
    - it is a strict subtype of the other;
    - it doesn’t require an implicit conversion, while the other does.

If no overload is strictly better than all alternatives, this results in a compile error.

### Deferred blocks

A statement block can optionally be marked as `deferred`, which is a signal to the compiler that it's entered less often. The compiler may choose to locate these blocks at the end of the function, thus improving cache locality for the non-deferred regions of code. For example, in this code from the `Array.prototype.forEach` implementation, we expect to remain on the "fast" path, and only rarely take the bailout case:

```torque
  let k: Number = 0;
  try {
    return FastArrayForEach(o, len, callbackfn, thisArg)
        otherwise Bailout;
  }
  label Bailout(kValue: Smi) deferred {
    k = kValue;
  }
```

Here is another example, where the dictionary elements case is marked as deferred to improve code generation for the more likely cases (from the `Array.prototype.join` implementation):

```torque
  if (IsElementsKindLessThanOrEqual(kind, HOLEY_ELEMENTS)) {
    loadFn = LoadJoinElement<FastSmiOrObjectElements>;
  } else if (IsElementsKindLessThanOrEqual(kind, HOLEY_DOUBLE_ELEMENTS)) {
    loadFn = LoadJoinElement<FastDoubleElements>;
  } else if (kind == DICTIONARY_ELEMENTS)
    deferred {
      const dict: NumberDictionary =
          UnsafeCast<NumberDictionary>(array.elements);
      const nofElements: Smi = GetNumberDictionaryNumberOfElements(dict);
      // <etc>...
```

## Porting CSA code to Torque

[The patch that ported `Array.of`](https://chromium-review.googlesource.com/c/v8/v8/+/1296464) serves as a minimal example of porting CSA code to Torque.
