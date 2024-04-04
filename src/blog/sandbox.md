---
title: 'The V8 Sandbox'
description: 'V8 features a lightweight, in-process sandbox to limit the impact of memory corruption bugs'
author: 'Samuel Groß'
avatars:
  - samuel-gross
date: 2024-04-04
tags:
 - security
---

After almost three years since the [initial design document](https://docs.google.com/document/d/1FM4fQmIhEqPG8uGp5o9A-mnPB5BOeScZYpkHjo0KKA8/edit?usp=sharing) and [hundreds of CLs](https://github.com/search?q=repo%3Av8%2Fv8+%5Bsandbox%5D&type=commits&s=committer-date&o=desc) in the meantime, the V8 Sandbox — a lightweight, in-process sandbox for V8 — has now progressed to the point where it is no longer considered an experimental security feature. Starting today, the [V8 Sandbox is included in Chrome's Vulnerability Reward Program](https://g.co/chrome/vrp/#v8-sandbox-bypass-rewards) (VRP). While there are still a number of issues to resolve before it becomes a strong security boundary, the VRP inclusion is an important step in that direction. Chrome 123 could therefore be considered to be a sort of "beta" release for the sandbox. This blog post uses this opportunity to discuss the motivation behind the sandbox, show how it prevents memory corruption in V8 from spreading within the host process, and ultimately explain why it is a necessary step towards memory safety.


# Motivation

Memory safety remains a relevant problem: all Chrome exploits [caught in the wild in the last three years](https://docs.google.com/spreadsheets/d/1lkNJ0uQwbeC1ZTRrxdtuPLCIl7mlUreoKfSIgajnSyY/edit?usp=sharing) (2021 – 2023) started out with a memory corruption vulnerability in a Chrome renderer process that was exploited for remote code execution (RCE). Of these, 60% were vulnerabilities in V8. However, there is a catch: V8 vulnerabilities are rarely "classic" memory corruption bugs (use-after-frees, out-of-bounds accesses, etc.) but instead subtle logic issues which can in turn be exploited to corrupt memory. As such, existing memory safety solutions are, for the most part, not applicable to V8. In particular, neither [switching to a memory safe language](https://www.cisa.gov/resources-tools/resources/case-memory-safe-roadmaps), such as Rust, nor using current or future hardware memory safety features, such as [memory tagging](https://newsroom.arm.com/memory-safety-arm-memory-tagging-extension), can help with the security challenges faced by V8 today.

To understand why, consider a highly simplified, hypothetical JavaScript engine vulnerability: the implementation of `JSArray::fizzbuzz()`, which replaces values in the array that are divisible by 3 with "fizz", divisible by 5 with "buzz", and divisible by both 3 and 5 with "fizzbuzz". Below is an implementation of that function in C++. `JSArray::buffer_` can be thought of as a `JSValue*`, that is, a pointer to an array of JavaScript values, and `JSArray::length_` contains the current size of that buffer.

```cpp
 1. for (int index = 0; index < length_; index++) {
 2.     JSValue js_value = buffer_[index];
 3.     int value = ToNumber(js_value).int_value();
 4.     if (value % 15 == 0)
 5.         buffer_[index] = JSString("fizzbuzz");
 6.     else if (value % 5 == 0)
 7.         buffer_[index] = JSString("buzz");
 8.     else if (value % 3 == 0)
 9.         buffer_[index] = JSString("fizz");
10. }
```

Seems simple enough? However, there's a somewhat subtle bug here: the `ToNumber` conversion in line 3 can have side effects as it may invoke user-defined JavaScript callbacks. Such a callback could then shrink the array, thereby causing an out-of-bounds write afterwards. The following JavaScript code would likely cause memory corruption:

```js
let array = new Array(100);
let evil = { [Symbol.toPrimitive]() { array.length = 1; return 15; } };
array.push(evil);
// At index 100, the @@toPrimitive callback of |evil| is invoked in
// line 3 above, shrinking the array to length 1 and reallocating its
// backing buffer. The subsequent write (line 5) goes out-of-bounds.
array.fizzbuzz();
```

Note that this vulnerability could occur both in hand-written runtime code (as in the example above) or in machine code generated at runtime by an optimizing just-in-time (JIT) compiler (if the function was implemented in JavaScript instead). In the former case, the programmer would conclude that an explicit bounds-check for the store operations is not necessary as that index has just been accessed. In the latter case, it would be the compiler drawing the same incorrect conclusion during one of its optimization passes (for example [redundancy elimination](https://en.wikipedia.org/wiki/Partial-redundancy_elimination) or [bounds-check elimination)](https://en.wikipedia.org/wiki/Bounds-checking_elimination) because it doesn't model the side effects of `ToNumber()` correctly.

While this is an artificially simple bug (this specific bug pattern has become mostly extinct by now due to improvements in fuzzers, developer awareness, and researcher attention), it is still useful to understand why vulnerabilities in modern JavaScript engines are difficult to mitigate in a generic way. Consider the approach of using a memory safe language such as Rust, where it is the compiler's responsibility to guarantee memory safety. In the above example, a memory safe language would likely prevent this bug in the hand-written runtime code used by the interpreter. However, it would *not* prevent the bug in any just-in-time compiler as the bug there would be a logic issue, not a "classic" memory corruption vulnerability. Only the code generated by the compiler would actually cause any memory corruption. Fundamentally, the issue is that *memory safety cannot be guaranteed by the compiler if a compiler is directly part of the attack surface*.

Similarly, disabling the JIT compilers would also only be a partial solution: historically, roughly half of the bugs discovered and exploited in V8 affected one of its compilers while the rest were in other components such as runtime functions, the interpreter, the garbage collector, or the parser. Using a memory-safe language for these components and removing JIT compilers could work, but would significantly reduce the engine's performance (ranging, depending on the type of workload, from 1.5–10× or more for computationally intensive tasks).

Now consider instead popular hardware security mechanisms, in particular [memory tagging](https://googleprojectzero.blogspot.com/2023/08/mte-as-implemented-part-1.html). There are a number of reasons why memory tagging would similarly not be an effective solution. For example, CPU side channels, which can [easily be exploited from JavaScript](https://security.googleblog.com/2021/03/a-spectre-proof-of-concept-for-spectre.html), could be abused to leak tag values, thereby allowing an attacker to bypass the mitigation. Furthermore, due to [pointer compression](https://v8.dev/blog/pointer-compression), there is currently no space for the tag bits in V8's pointers. As such, the entire heap region would have to be tagged with the same tag, making it impossible to detect inter-object corruption. As such, while memory tagging [can be very effective on certain attack surfaces](https://googleprojectzero.blogspot.com/2023/08/mte-as-implemented-part-2-mitigation.html), it is unlikely to represent much of a hurdle for attackers in the case of JavaScript engines.

In summary, modern JavaScript engines tend to contain complex, 2nd-order logic bugs which provide powerful exploitation primitives. These cannot be effectively protected by the same techniques used for typical memory-corruption vulnerabilities. However, nearly all vulnerabilities found and exploited in V8 today have one thing in common: the eventual memory corruption necessarily happens inside the V8 heap because the compiler and runtime (almost) exclusively operate on V8 `HeapObject` instances. This is where the sandbox comes into play.


# The V8 (Heap) Sandbox

The basic idea behind the sandbox is to isolate V8's (heap) memory such that any memory corruption there cannot "spread" to other parts of the process' memory.

As a motivating example for the sandbox design, consider the [separation of user- and kernel space](https://en.wikipedia.org/wiki/User_space_and_kernel_space) in modern operating systems. Historically, all applications and the operating system's kernel would share the same (physical) memory address space. As such, any memory error in a user application could bring down the whole system by, for example, corrupting kernel memory. On the other hand, in a modern operating system, each userland application has its own dedicated (virtual) address space. As such, any memory error is limited to the application itself, and the rest of the system is protected. In other words, a faulty application can crash itself but not affect the rest of the system. Similarly, the V8 Sandbox attempts to isolate the untrusted JavaScript/WebAssembly code executed by V8 such that a bug in V8 does not affect the rest of the hosting process.

In principle, [the sandbox could be implemented with hardware support](https://docs.google.com/document/d/12MsaG6BYRB-jQWNkZiuM3bY8X2B2cAsCMLLdgErvK4c/edit?usp=sharing): similar to the userland-kernel split, V8 would execute some mode-switching instruction when entering or leaving sandboxed code, which would cause the CPU to be unable to access out-of-sandbox memory. In practice, no suitable hardware feature is available today, and the current sandbox is therefore implemented purely in software.

The basic idea behind the [software-based sandbox](https://docs.google.com/document/d/1FM4fQmIhEqPG8uGp5o9A-mnPB5BOeScZYpkHjo0KKA8/edit?usp=sharing) is to replace all data types that can access out-of-sandbox memory with "sandbox-compatible" alternatives. In particular, all pointers (both to objects on the V8 heap or elsewhere in memory) and 64-bit sizes must be removed as an attacker could corrupt them to subsequently access other memory in the process. This implies that memory regions such as the stack cannot be inside the sandbox as they must contain pointers (for example return addresses) due to hardware and OS constraints. As such, with the software-based sandbox, only the V8 heap is inside the sandbox, and the overall construction is therefore not unlike the [sandboxing model used by WebAssembly](https://webassembly.org/docs/security/).

To understand how this works in practice, it is useful to look at the steps an exploit has to perform after corrupting memory. The goal of an RCE exploit would typically be to perform a privilege escalation attack, for example by executing shellcode or performing a return-oriented programming (ROP)-style attack. For either of these, the exploit will first want the ability to read and write arbitrary memory in the process, for example to then corrupt a function pointer or place a ROP-payload somewhere in memory and pivot to it. Given a bug that corrupts memory on the V8 heap, an attacker would therefore look for an object such as the following:

```cpp
class JSArrayBuffer: public JSObject {
  private:
    byte* buffer_;
    size_t size_;
};
```

Given this, the attacker would then either corrupt the buffer pointer or the size value to construct an arbitrary read/write primitive. This is the step that the sandbox aims to prevent. In particular, with the sandbox enabled, and assuming that the referenced buffer is located inside the sandbox, the above object would now become:

```cpp
class JSArrayBuffer: public JSObject {
  private:
    sandbox_ptr_t buffer_;
    sandbox_size_t size_;
};
```

Where `sandbox_ptr_t` is a 40-bit offset (in the case of a 1TB sandbox) from the base of the sandbox. Similarly, `sandbox_size_t` is a "sandbox-compatible" size, [currently limited to 32GB](https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-internal.h;l=231;drc=5bdda7d5edcac16b698026b78c0eec6d179d3573).
Alternatively, if the referenced buffer was located outside of the sandbox, the object would instead become:

```cpp
class JSArrayBuffer: public JSObject {
  private:
    external_ptr_t buffer_;
};
```

Here, an `external_ptr_t` references the buffer (and its size) through a pointer table indirection (not unlike the [file descriptor table of a unix kernel](https://en.wikipedia.org/wiki/File_descriptor) or a [WebAssembly.Table](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Table)) which provides memory safety guarantees.

In both cases, an attacker would find themselves unable to "reach out" of the sandbox into other parts of the address space. Instead, they would first need an additional vulnerability: a V8 Sandbox bypass. The following image summarizes the high-level design, and the interested reader can find more technical details about the sandbox in the design documents linked from [`src/sandbox/README.md`](https://chromium.googlesource.com/v8/v8.git/+/refs/heads/main/src/sandbox/README.md).

![A high-level diagram of the sandbox design](/_img/sandbox/sandbox.svg)

Solely converting pointers and sizes to a different representation is not quite sufficient in an application as complex as V8 and there are [a number of other issues](https://issues.chromium.org/hotlists/4802478) that need to be fixed. For example, with the introduction of the sandbox, code such as the following suddenly becomes problematic:

```cpp
std::vector<std::string> JSObject::GetPropertyNames() {
    int num_properties = TotalNumberOfProperties();
    std::vector<std::string> properties(num_properties);

    for (int i = 0; i < NumberOfInObjectProperties(); i++) {
        properties[i] = GetNameOfInObjectProperty(i);
    }

    // Deal with the other types of properties
    // ...
```

This code makes the (reasonable) assumption that the number of properties stored directly in a JSObject must be less than the total number of properties of that object. However, assuming these numbers are simply stored as integers somewhere in the JSObject, an attacker could corrupt one of them to break this invariant. Subsequently, the access into the (out-of-sandbox) `std::vector` would go out of bounds. Adding an explicit bounds check, for example with an [`SBXCHECK`](https://chromium.googlesource.com/v8/v8.git/+/0deeaf5f593b98d6a6a2bb64e3f71d39314c727c), would fix this.

Encouragingly, nearly all "sandbox violations" discovered so far are like this: trivial (1st order) memory corruption bugs such as use-after-frees or out-of-bounds accesses due to lack of a bounds check. Contrary to the 2nd order vulnerabilities typically found in V8, these sandbox bugs could actually be prevented or mitigated by the approaches discussed earlier. In fact, the particular bug above would already be mitigated today due to [Chrome's libc++ hardening](http://issues.chromium.org/issues/40228527). As such, the hope is that in the long run, the sandbox becomes a **more defensible security boundary** than V8 itself. While the currently available data set of sandbox bugs is very limited, the VRP integration launching today will hopefully help produce a clearer picture of the type of vulnerabilities encountered on the sandbox attack surface.

## Performance

One major advantage of this approach is that it is fundamentally cheap: the overhead caused by the sandbox comes mostly from the pointer table indirection for external objects (costing roughly one additional memory load) and to a lesser extent from the use of offsets instead of raw pointers (costing mostly just a shift+add operation, which is very cheap). The current overhead of the sandbox is therefore only around 1% or less on typical workloads (measured using the [Speedometer](https://browserbench.org/Speedometer3.0/) and [JetStream](https://browserbench.org/JetStream/) benchmark suites). This allows the V8 Sandbox to be enabled by default on compatible platforms.

## Testing

A desirable feature for any security boundary is testability: the ability to manually and automatically test that the promised security guarantees actually hold in practice. This requires a clear attacker model, a way to "emulate" an attacker, and ideally a way of automatically determining when the security boundary has failed. The V8 Sandbox fulfills all of these requirements:

1. **A clear attacker model:** it is assumed that an attacker can read and write arbitrarily inside the V8 Sandbox. The goal is to prevent memory corruption outside of the sandbox.
2. **A way to emulate an attacker:** V8 provides a "memory corruption API" when built with the `v8_enable_memory_corruption_api = true` flag. This emulates the primitives obtained from typical V8 vulnerabilities and in particular provides full read- and write access inside the sandbox.
3. **A way to detect "sandbox violations":** V8 provides a "sandbox testing" mode (enabled via either `--sandbox-testing` or `--sandbox-fuzzing`) which installs a [signal handler](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/sandbox/testing.cc;l=425;drc=97b7d0066254778f766214d247b65d01f8a81ebb) that determines if a signal such as `SIGSEGV` represents a violation of the sandbox's security guarantees.

Ultimately, this allows the sandbox to be integrated into Chrome's VRP program and be fuzzed by specialized fuzzers.

## Usage

The V8 Sandbox must be enabled/disabled at build time using the `v8_enable_sandbox` build flag. It is (for technical reasons) not possible to enable/disable the sandbox at runtime. The V8 Sandbox requires a 64-bit system as it needs to reserve a large amount of virtual address space, currently one terabyte.

The V8 Sandbox has already been enabled by default on 64-bit (specifically x64 and arm64) versions of Chrome on Android, ChromeOS, Linux, macOS, and Windows for roughly the last two years. Even though the sandbox was (and still is) not feature complete, this was mainly done to ensure that it does not cause stability issues and to collect real-world performance statistics. Consequently, recent V8 exploits already had to work their way past the sandbox, providing helpful early feedback on its security properties.


# Conclusion

The V8 Sandbox is a new security mechanism designed to prevent memory corruption in V8 from impacting other memory in the process. The sandbox is motivated by the fact that current memory safety technologies are largely inapplicable to optimizing JavaScript engines. While these technologies fail to prevent memory corruption in V8 itself, they can in fact protect the V8 Sandbox attack surface. The sandbox is therefore a necessary step towards memory safety.
