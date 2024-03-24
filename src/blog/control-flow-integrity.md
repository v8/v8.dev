---
title: 'Control-flow Integrity in V8'
description: 'This blog post discusses the plans to implement control-flow integrity in V8.'
author: 'Stephen Röttger'
date: 2023-10-09
tags:
 - security
---
Control-flow integrity (CFI) is a security feature aiming to prevent exploits from hijacking control-flow. The idea is that even if an attacker manages to corrupt the memory of a process, additional integrity checks can prevent them from executing arbitrary code. In this blog post, we want to discuss our work to enable CFI in V8.

# Background

The popularity of Chrome makes it a valuable target for 0-day attacks and most in-the-wild exploits we’ve seen target V8 to gain initial code execution. V8 exploits typically follow a similar pattern: an initial bug leads to memory corruption but often the initial corruption is limited and the attacker has to find a way to arbitrarily read/write in the whole address space. This allows them to hijack the control-flow and run shellcode that executes the next step of the exploit chain that will try to break out of the Chrome sandbox.


To prevent the attacker from turning memory corruption into shellcode execution, we’re implementing control-flow integrity in V8. This is especially challenging in the presence of a JIT compiler. If you turn data into machine code at runtime, you now need to ensure that corrupted data can’t turn into malicious code. Fortunately, modern hardware features provide us with the building blocks to design a JIT compiler that is robust even while processing corrupted memory.


Following, we’ll look at the problem divided into three separate parts:

- **Forward-Edge CFI** verifies the integrity of indirect control-flow transfers such as function pointer or vtable calls.
- **Backward-Edge CFI** needs to ensure that return addresses read from the stack are valid.
- **JIT Memory Integrity** validates all data that is written to executable memory at runtime.

# Forward-Edge CFI

There are two hardware features that we want to use to protect indirect calls and jumps: landing pads and pointer authentication.


## Landing Pads

Landing pads are special instructions that can be used to mark valid branch targets. If enabled, indirect branches can only jump to a landing pad instruction, anything else will raise an exception.  
On ARM64 for example, landing pads are available with the Branch Target Identification (BTI) feature introduced in Armv8.5-A. BTI support is [already enabled](https://bugs.chromium.org/p/chromium/issues/detail?id=1145581) in V8.  
On x64, landing pads were introduced with the Indirect Branch Tracking (IBT) part of the Control Flow Enforcement Technology (CET) feature.


However, adding landing pads on all potential targets for indirect branches only provides us with coarse-grained control-flow integrity and still gives attackers lots of freedom. We can further tighten the restrictions by adding function signature checks (the argument and return types at the call site must match the called function) as well as through dynamically removing unneeded landing pad instructions at runtime.
These features are part of the recent [FineIBT proposal](https://arxiv.org/abs/2303.16353) and we hope that it can get OS adoption.

## Pointer Authentication

Armv8.3-A introduced pointer authentication (PAC) which can be used to embed a signature in the upper unused bits of a pointer. Since the signature is verified before the pointer is used, attackers won’t be able to provide arbitrary forged pointers to indirect branches.

# Backward-Edge CFI

To protect return addresses, we also want to make use of two separate hardware features: shadow stacks and PAC.

## Shadow Stacks

With Intel CET’s shadow stacks and the guarded control stack (GCS) in [Armv9.4-A](https://community.arm.com/arm-community-blogs/b/architectures-and-processors-blog/posts/arm-a-profile-architecture-2022), we can have a separate stack just for return addresses that has hardware protections against malicious writes. These features provide some pretty strong protections against return address overwrites, but we will need to deal with cases where we legitimately modify the return stack such as during optimization / deoptimization and exception handling.

## Pointer Authentication (PAC-RET)

Similar to indirect branches, pointer authentication can be used to sign return addresses before they get pushed to the stack. This is [already enabled](https://bugs.chromium.org/p/chromium/issues/detail?id=919548) in V8 on ARM64 CPUs.


A side effect of using hardware support for Forward-edge and Backward-edge CFI is that it will allow us to keep the performance impact to a minimum.

# JIT Memory Integrity

A unique challenge to CFI in JIT compilers is that we need to write machine code to executable memory at runtime. We need to protect the memory in a way that the JIT compiler is allowed to write to it but the attacker’s memory write primitive can’t. A naive approach would be to change the page permissions temporarily to add / remove write access. But this is inherently racy since we need to assume that the attacker can trigger an arbitrary write concurrently from a second thread.


## Per-thread Memory Permissions

On modern CPUs, we can have different views of the memory permissions that only apply to the current thread and can be changed quickly in userland.  
On x64 CPUs, this can be achieved with memory protection keys (pkeys) and ARM announced the [permission overlay extensions](https://community.arm.com/arm-community-blogs/b/architectures-and-processors-blog/posts/arm-a-profile-architecture-2022) in Armv8.9-A.  
This allows us to fine-grained toggle the write access to executable memory, for example by tagging it with a separate pkey.


The JIT pages are now not attacker writable anymore but the JIT compiler still needs to write generated code into it. In V8, the generated code lives in [AssemblerBuffers](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/codegen/assembler.h;l=255;drc=064b9a7903b793734b6c03a86ee53a2dc85f0f80) on the heap which can be corrupted by the attacker instead. We could protect the AssemblerBuffers too in the same fashion, but this just shifts the problem. For example, we’d then also need to protect the memory where the pointer to the AssemblerBuffer lives.  
In fact, any code that enables write access to such protected memory constitutes CFI attack surface and needs to be coded very defensively. E.g. any write to a pointer that comes from unprotected memory is game over, since the attacker can use it to corrupt executable memory. Thus, our design goal is to have as few of these critical sections as possible and keep the code inside short and self-contained.

## Control-Flow Validation

If we don’t want to protect all compiler data, we can assume it to be untrusted from the point of view of CFI instead. Before writing anything to executable memory, we need to validate that it doesn’t lead to arbitrary control-flow. That includes for example that the written code doesn’t perform any syscall instructions or that it doesn’t jump into arbitrary code. Of course, we also need to check that it doesn’t change the pkey permissions of the current thread. Note that we don’t try to prevent the code from corrupting arbitrary memory since if the code is corrupted we can assume the attacker already has this capability.  
To perform such validation safely, we will also need to keep required metadata in protected memory as well as protect local variables on the stack.  
We ran some preliminary tests to assess the impact of such validation on performance. Fortunately, the validation is not occurring in performance-critical code paths, and we did not observe any regressions in the jetstream or speedometer benchmarks.

# Evaluation

Offensive security research is an essential part of any mitigation design and we’re continuously trying to find new ways to bypass our protections. Here are some examples of attacks that we think will be possible and ideas to address them.

## Corrupted Syscall Arguments

As mentioned before, we assume that an attacker can trigger a memory write primitive concurrently to other running threads. If another thread performs a syscall, some of the arguments could then be attacker-controlled if they’re read from memory. Chrome runs with a restrictive syscall filter but there’s still a few syscalls that could be used to bypass the CFI protections.


Sigaction for example is a syscall to register signal handlers. During our research we found that a sigaction call in Chrome is reachable in a CFI-compliant way. Since the arguments are passed in memory, an attacker could trigger this code path and point the signal handler function to arbitrary code. Luckily, we can address this easily: either block the path to the sigaction call or block it with a syscall filter after initialization.


Other interesting examples are the memory management syscalls. For example, if a thread calls munmap on a corrupted pointer, the attacker could unmap read-only pages and a consecutive mmap call can reuse this address, effectively adding write permissions to the page.
Some OSes already provide protections against this attack with memory sealing: Apple platforms provide the [VM\_FLAGS\_PERMANENT](https://github.com/apple-oss-distributions/xnu/blob/1031c584a5e37aff177559b9f69dbd3c8c3fd30a/osfmk/mach/vm_statistics.h#L274) flag and OpenBSD has an [mimmutable](https://man.openbsd.org/mimmutable.2) syscall.

## Signal Frame Corruption

When the kernel executes a signal handler, it will save the current CPU state on the userland stack. A second thread could corrupt the saved state which will then get restored by the kernel.
Protecting against this in user space seems difficult if the signal frame data is untrusted. At that point one would have to always exit or overwrite the signal frame with a known save state to return to.
A more promising approach would be to protect the signal stack using per-thread memory permissions. For example, a pkey-tagged sigaltstack would protect against malicious overwrites, but it would require the kernel to temporarily allow write permissions when saving the CPU state onto it.

# v8CTF

These were just a few examples of potential attacks that we’re working on addressing and we also want to learn more from the security community. If this interests you, try your hand at the recently launched [v8CTF](https://security.googleblog.com/2023/10/expanding-our-exploit-reward-program-to.html)! Exploit V8 and gain a bounty, exploits targeting n-day vulnerabilities are explicitly in scope!
