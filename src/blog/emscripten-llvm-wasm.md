---
title: 'Emscripten and the LLVM WebAssembly backend'
author: 'Alon Zakai'
avatars:
  - 'alon-zakai'
date: 2019-07-01 16:45:00
tags:
  - WebAssembly
  - tooling
description: 'Emscripten is switching to the LLVM WebAssembly backend, resulting in much faster link times️ and many other benefits.'
tweet: '1145704863377981445'
---
WebAssembly is normally compiled from a source language, which means that developers need *tools* to use it. Because of that, the V8 team works on relevant open-source projects like [LLVM](http://llvm.org/), [Emscripten](https://emscripten.org/), [Binaryen](https://github.com/WebAssembly/binaryen/), and [WABT](https://github.com/WebAssembly/wabt). This post describes some of the work we’ve been doing on Emscripten and LLVM, which will soon allow Emscripten to switch to the [LLVM WebAssembly backend](https://github.com/llvm/llvm-project/tree/master/llvm/lib/Target/WebAssembly) by default — please test it and report any issues!

The LLVM WebAssembly backend has been an option in Emscripten for some time, as we have been working on the backend in parallel to its integration in Emscripten, and in collaboration with others in the open source WebAssembly tools community. It has now reached the point where the WebAssembly backend beats the old “[fastcomp](https://github.com/emscripten-core/emscripten-fastcomp/)” backend on most metrics, and therefore we would like to switch the default to it. This announcement is happening before that, to get as much testing as we can first.

This is an important upgrade for several exciting reasons:

- **Much faster linking**: the LLVM WebAssembly backend together with [`wasm-ld`](https://lld.llvm.org/WebAssembly.html) has full support for incremental compilation using WebAssembly object files. Fastcomp used LLVM IR in bitcode files, which meant that at link time all the IR would be compiled by LLVM. This was the main reason for slow link times. With WebAssembly object files on the other hand, `.o` files contain already-compiled WebAssembly (in a relocatable form that can be linked, much like native linking). As a result the link step can be much, much faster than with fastcomp — we’ll see a real-world measurement below with a 7× speedup!
- **Faster and smaller code**: We’ve worked hard on the LLVM WebAssembly backend as well as on the Binaryen optimizer which Emscripten runs after it. The result is that the LLVM WebAssembly backend path now beats fastcomp on both speed and size on most benchmarks we track.
- **Support all LLVM IR**: Fastcomp could handle the LLVM IR emitted by `clang`, but because of its architecture it often failed on other sources, specifically on “legalizing” the IR into types that fastcomp could handle. The LLVM WebAssembly backend on the other hand uses the common LLVM backend infrastructure, so it can handle everything.
- **New WebAssembly features**: Fastcomp compiles to asm.js before running `asm2wasm`, which means that it is difficult to handle new WebAssembly features like tail calls, exceptions, SIMD, and so forth. The WebAssembly backend is the natural place to work on those, and we are in fact working on all of the features just mentioned!
- **Faster general updates from upstream**: Related to the last point, using the upstream WebAssembly backend means we can use very latest LLVM upstream at all times, which means we can get new C++ language features in `clang`, new LLVM IR optimizations, etc. as soon as they land.

## Testing

To test the WebAssembly backend, simply use the [latest `emsdk`](https://github.com/emscripten-core/emsdk) and do

```
emsdk install latest-upstream
emsdk activate latest-upstream
```

“Upstream” here refers to the fact that the LLVM WebAssembly backend is in upstream LLVM, unlike fastcomp. In fact, since it’s in upstream, you don’t need to use the `emsdk` if you build plain LLVM+`clang` yourself! (To use such a build with Emscripten, just add the path to it in your `.emscripten` file.)

Currently using `emsdk [install|activate] latest` still uses fastcomp. There is also “latest-fastcomp” which does the same. When we switch the default backend, we will make “latest” do the same as “latest-upstream”, and at that time “latest-fastcomp” will be the only way to get fastcomp. Fastcomp remains an option while it is still useful; see more notes about this at the end.

## History

This will be the **third** backend in Emscripten, and the **second** migration. The first backend was written in JavaScript and parsed LLVM IR in text form. This was useful for experimentation back in 2010, but had obvious downsides, including that LLVM’s text format would change and compilation speed wasn’t as fast as we wanted. In 2013 a new backend was written in a fork of LLVM, nicknamed “fastcomp”. It was designed to emit [asm.js](https://en.wikipedia.org/wiki/Asm.js), which the earlier JS backend had been hacked to do (but didn’t do very well). As a result it was a big improvement in code quality and compile times.

It was also a relatively minor change in Emscripten. While Emscripten is a compiler, the original backend and fastcomp have always been a fairly small part of the project — far more code goes into system libraries, toolchain integration, language bindings, and so forth. So while switching the compiler backend is a dramatic change, it affects just one part of the overall project.

## Benchmarks

### Code size

![Code size measurements (lower is better)](/_img/emscripten-llvm-wasm/size.svg)

(All sizes here are normalized to fastcomp.) As you can see, the WebAssembly backend’s sizes are almost always smaller! The difference is more noticeable on the smaller microbenchmarks on the left (names in lowercase), where new improvements in system libraries matter more. But there is a code size reduction even on most of the macrobenchmarks on the right (names in UPPERCASE), which are real-world codebases. The one regression on the macrobenchmarks is LZMA, where newer LLVM makes a different inlining decision that ends up unlucky.

Overall, the macrobenchmarks shrink by an average of **3.7%**. Not bad for a compiler upgrade! We see similar things on real-world codebases that are not in the test suite, for example, [BananaBread](https://github.com/kripken/BananaBread/), a port of the [Cube 2 game engine](http://cubeengine.com/) to the Web, shrinks by over **6%**, and [Doom 3 shrinks by](http://www.continuation-labs.com/projects/d3wasm/) **15%**!

These size improvements (and the speed improvements we’ll discuss next) are due to several factors:

- LLVM’s backend codegen is smart and can do things that simple backends like fastcomp can’t, like [GVN](https://en.wikipedia.org/wiki/Value_numbering).
- Newer LLVM has better IR optimizations.
- We’ve worked a lot on tuning the Binaryen optimizer on the WebAssembly backend’s output, as mentioned earlier.

### Speed

![Speed measurements (lower is better)](/_img/emscripten-llvm-wasm/speed.svg)

(Measurements are on V8.) Among the microbenchmarks, speed is a mixed picture — which is not that surprising, since most of them are dominated by a single function or even loop, so any change to the code Emscripten emits can lead to a lucky or unlucky optimization choice by the VM. Overall, about an equal number of microbenchmarks stay the same as those that improve or those that regress. Looking at the more realistic macrobenchmarks, once more LZMA is an outlier, again because of an unlucky inlining decision as mentioned earlier, but otherwise every single macrobenchmark improves!

The average change on the macrobenchmarks is a speedup of **3.2%**.

### Build time

![Compile and link time measurements on BananaBread (lower is better)](/_img/emscripten-llvm-wasm/build.svg)

Build time changes will vary by project, but here are some example numbers from BananaBread, which is a complete but compact game engine consisting of 112 files and 95,287 lines of code. On the left we have build times for the compile step, that is, compiling source files to object files, using the project’s default `-O3` (all times are normalized to fastcomp). As you can see, the compile step takes slightly longer with the WebAssembly backend, which makes sense because we are doing more work at this stage — instead of just compiling source to bitcode as fastcomp does, we also compile the bitcode to WebAssembly.

Looking on the right, we have the numbers for the link step (also normalized to fastcomp), that is, producing the final executable, here with `-O0` which is suitable for an incremental build (for a fully-optimized one, you would probably use `-O3` as well, see below). It turns out that the slight increase during the compile step is worth it, because the link is **over 7× faster**! That’s the real advantage of incremental compilation: most of the link step is just a quick concatenation of object files. And if you change just one source file and rebuild then almost all you need is that fast link step, so you can see this speedup all the time during real-world development.

As mentioned above, build time changes will vary by project. In a smaller project than BananaBread the link time speedup may be smaller, while on a bigger project it may be larger. Another factor is optimizations: as mentioned above, the test linked with `-O0`, but for a release build you’ll want `-O3` probably, and in that case Emscripten will invoke the Binaryen optimizer on the final WebAssembly, run [meta-dce](https://hacks.mozilla.org/2018/01/shrinking-webassembly-and-javascript-code-sizes-in-emscripten/), and other useful things for code size and speed. That takes extra time, of course, and it’s worth it for a release build — on BananaBread it shrinks the WebAssembly from 2.65 to 1.84 MB, an improvement of over **30%** — but for a quick incremental build you can skip that with `-O0`.

## Known issues

While the LLVM WebAssembly backend generally wins on both code size and speed, we have seen some exceptions:

- [Fasta](https://github.com/emscripten-core/emscripten/blob/incoming/tests/fasta.cpp) regresses without [nontrapping float to int conversions](https://github.com/WebAssembly/nontrapping-float-to-int-conversions), a new WebAssembly feature that was not in the WebAssembly MVP. The underlying issue is that in the MVP a float to int conversion will trap if it was out of the range of valid integers. The reasoning was that this is undefined behavior in C anyhow, and easy for VMs to implement. However, this turned out to be a poor match for how LLVM compiles float to int conversions, with the result that extra guards are needed, adding code size and overhead. The newer non-trapping operations avoid that, but may not be present in all browsers yet. You can use them by compiling source files with `-mnontrapping-fptoint`.
- The LLVM WebAssembly backend is not just a different backend than fastcomp but also uses a much newer LLVM. Newer LLVM may make different inlining decisions, which (like all inlining decisions in the absence of profile-guided optimization) are heuristic-driven and may end up helping or hurting. A specific example we mentioned earlier is in the LZMA benchmark where newer LLVM ends up inling a function 5 times in a way that ends up just causing harm. If you encounter this in your own projects, you can selectively build certain source files with `-Os` to focus on code size, use `__attribute__((noinline))`, etc.

There may be more issues we are not aware of that should be optimized — please let us know if you find anything!

## Other changes

There are a small number of Emscripten features that are tied to fastcomp and/or to asm.js, which means that they can’t work out of the box with the WebAssembly backend, and so we have been working on alternatives.

### JavaScript output

An option for non-WebAssembly output is still important in some cases — although all major browsers have had WebAssembly support for some time, there is still a long tail of old machines, old phones, etc. that don’t have WebAssembly support. Also, as WebAssembly adds new features some form of this issue will stay relevant. Compiling to JS is a way to guarantee you can reach everyone, even if the build isn’t as small or fast as WebAssembly would be. With fastcomp we simply used the asm.js output for this directly, but with the WebAssembly backend obviously something else is needed. We are using Binaryen’s [`wasm2js`](https://github.com/WebAssembly/binaryen#wasm2js) for that purpose, which as the name suggests compiles WebAssembly to JS.

This probably warrants a full blog post, but in brief, a key design decision here is that there is no point to supporting asm.js anymore. asm.js can run much faster than general JS, but it turns out that practically all browsers that support asm.js AOT optimizations also support WebAssembly anyhow (in fact, Chrome optimizes asm.js by converting it to WebAssembly internally!). So when we talk about a JS fallback option, it may as well not use asm.js; in fact it’s simpler, allows us to support more features in WebAssembly, and also results in significantly smaller JS as well! Therefore `wasm2js` does not target asm.js.

However, a side effect of that design is that if you test an asm.js build from fastcomp compared to a JS build with the WebAssembly backend then the asm.js may be much faster — if you test in a modern browser with asm.js AOT optimizations. That is probably the case for your own browser, but not the browsers that would actually need the non-WebAssembly option! For a proper comparison, you should use a browser without asm.js optimizations or with them disabled. If the `wasm2js` output is still slower, please let us know!

`wasm2js` is missing some less-used features like dynamic linking and pthreads, but most code should work already, and it’s been carefully fuzzed. To test the JS output, simply build with `-s WASM=0` to disable WebAssembly. `emcc` then runs `wasm2js` for you, and if this is an optimized build it runs various useful optimizations as well.

### Other things you may notice

- The [Asyncify](https://github.com/emscripten-core/emscripten/wiki/Asyncify) and [Emterpreter](https://github.com/emscripten-core/emscripten/wiki/Emterpreter) options only work in fastcomp. A replacement [is](https://github.com/WebAssembly/binaryen/pull/2172) [being](https://github.com/WebAssembly/binaryen/pull/2173) [worked](https://github.com/emscripten-core/emscripten/pull/8808) [on](https://github.com/emscripten-core/emscripten/issues/8561). We expect this to eventually be an improvement on the previous options.
- Pre-built libraries must be rebuilt: if you have some `library.bc` that was built with fastcomp, then you’ll need to rebuild it from source using newer Emscripten. This has always been the case when fastcomp upgraded LLVM to a new version which changed the bitcode format, and the change now (to WebAssembly object files instead of bitcode) has the same effect.

## Conclusion

Our main goal right now is to fix any bugs related to this change. Please test and file issues!

After things are stable, we’ll switch the default compiler backend to the upstream WebAssembly backend. Fastcomp will remain an option, as mentioned earlier.

We would like to eventually remove fastcomp entirely. Doing so would remove a significant maintenance burden, allow us to focus more on new features in the WebAssembly backend, accelerate general improvements in Emscripten, and other good things. Please let us know how testing goes on your codebases so we can start to plan a timeline for fastcomp’s removal.

### Thank you

Thanks to everyone involved in the development of the LLVM WebAssembly backend, `wasm-ld`, Binaryen, Emscripten, and the other things mentioned in this post! A partial list of those awesome people is: aardappel, aheejin, alexcrichton, dschuff, jfbastien, jgravelle, nwilson, sbc100, sunfish, tlively, yurydelendik.
