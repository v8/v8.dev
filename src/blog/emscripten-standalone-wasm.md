---
title: 'Outside the web: standalone WebAssembly binaries using Emscripten'
author: 'Alon Zakai'
avatars:
  - 'alon-zakai'
date: 2019-11-21
tags:
  - WebAssembly
  - tooling
description: 'Emscripten now supports standalone Wasm files, which do not need JavaScript.'
tweet: '1197547645729988608'
---
Emscripten has always focused first and foremost on compiling to the Web and other JavaScript environments like Node.js. But as WebAssembly starts to be used *without* JavaScript, new use cases are appearing, and so we've been working on support for emitting [**standalone Wasm**](https://github.com/emscripten-core/emscripten/wiki/WebAssembly-Standalone) files from Emscripten, that do not depend on the Emscripten JS runtime! This post explains why that's interesting.

## Using standalone mode in Emscripten

First, let's see what you can do with this new feature! Similar to [this post](https://hacks.mozilla.org/2018/01/shrinking-webassembly-and-javascript-code-sizes-in-emscripten/) let's start with a "hello world" type program that exports a single function that adds two numbers:

```c
// add.c
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
int add(int x, int y) {
  return x + y;
}
```

We'd normally build this with something like `emcc -O3 add.c -o add.js` which would emit `add.js` and `add.wasm`. Instead, let's ask `emcc` to only emit Wasm:

```
emcc -O3 add.c -o add.wasm
```

When `emcc` sees we only want Wasm then it makes it "standalone" - a Wasm file that can run by itself as much as possible, without any JavaScript runtime code from Emscripten.

Disassembling it, it's very minimal - just 87 bytes! It contains the obvious `add` function

```lisp
(func $add (param $0 i32) (param $1 i32) (result i32)
 (i32.add
  (local.get $0)
  (local.get $1)
 )
)
```

and one more function, `_start`,

```lisp
(func $_start
 (nop)
)
```

`_start` is part of the [WASI](https://github.com/WebAssembly/WASI) spec, and Emscripten's standalone mode emits it so that we can run in WASI runtimes. (Normally `_start` would do global initialization, but here we just don't need any so it's empty.)

### Write your own JavaScript loader

One nice thing about a standalone Wasm file like this is that you can write custom JavaScript to load and run it, which can be very minimal depending on your use case. For example, we can do this in Node.js:

```js
// load-add.js
const binary = require('fs').readFileSync('add.wasm');

WebAssembly.instantiate(binary).then(({ instance }) => {
  console.log(instance.exports.add(40, 2));
});
```

Just 4 lines! Running that prints `42` as expected. Note that while this example is very simplistic, there are cases where you simply don't need much JavaScript, and may be able to do better than Emscripten's default JavaScript runtime (which supports a bunch of environments and options). A real-world example of that is in [zeux's meshoptimizer](https://github.com/zeux/meshoptimizer/blob/bdc3006532dd29b03d83dc819e5fa7683815b88e/js/meshopt_decoder.js) - just 57 lines, including memory management, growth, etc.!

### Running in Wasm runtimes

Another nice thing about standalone Wasm files is that you can run them in Wasm runtimes like [wasmer](https://wasmer.io), [wasmtime](https://github.com/bytecodealliance/wasmtime), or [WAVM](https://github.com/WAVM/WAVM). For example, consider this hello world:

```cpp
// hello.cpp
#include <stdio.h>

int main() {
  printf("hello, world!\n");
  return 0;
}
```

We can build and run that in any of those runtimes:

```bash
$ emcc hello.cpp -O3 -o hello.wasm
$ wasmer run hello.wasm
hello, world!
$ wasmtime hello.wasm
hello, world!
$ wavm run hello.wasm
hello, world!
```

Emscripten uses WASI APIs as much as possible, so programs like this end up using 100% WASI and can run in WASI-supporting runtimes (see notes later on what programs require more than WASI).

### Building Wasm plugins

Aside from the Web and the server, an exciting area for Wasm is **plugins**. For example, an image editor might have Wasm plugins that can perform filters and other operations on the image. For that type of use case you want a standalone Wasm binary, just like in the examples so far, but where it also has a proper API for the embedding application.

Plugins are sometimes related to dynamic libraries, as dynamic libraries are one way to implement them. Emscripten has support for dynamic libraries with the [SIDE_MODULE](https://github.com/emscripten-core/emscripten/wiki/Linking#general-dynamic-linking) option, and this has been a way to build Wasm plugins. The new standalone Wasm option described here is an improvement on that in several ways: First, a dynamic library has relocatable memory, which adds overhead if you don’t need it (and you don’t if you aren’t linking the Wasm with another Wasm after loading it). Second, standalone output is designed to run in Wasm runtimes as well, as mentioned earlier.

Okay, so far so good: Emscripten can either emit JavaScript + WebAssembly as it always did, and now it can also emit just WebAssembly by itself, which lets you run it in places that don't have JavaScript like Wasm runtimes, or you can write your own custom JavaScript loader code, etc. Now let's talk about the background and the technical details!

## WebAssembly's two standard APIs

WebAssembly can only access the APIs it receives as imports - the core Wasm spec has no concrete API details. Given the current trajectory of Wasm, it looks like there will be 3 main categories of APIs that people import and use:

- **Web APIs**: This is what Wasm programs use on the Web, which are the existing standardized APIs that JavaScript can use too. Currently these are called indirectly, through JS glue code, but in the future with [interface types](https://github.com/WebAssembly/interface-types/blob/master/proposals/interface-types/Explainer.md) they will be called directly.
- **WASI APIs**: WASI focuses on standardizing APIs for Wasm on the server.
- **Other APIs**: Various custom embeddings will define their own application-specific APIs. For example, we gave the example earlier of an image editor with Wasm plugins that implement an API to do visual effects. Note that a plugin might also have access to “system” APIs, like a native dynamic library would, or it might be very sandboxed and have no imports at all (if the embedding just calls its methods).

WebAssembly is in the interesting position of having [two standardized sets of APIs](https://www.goodreads.com/quotes/589703-the-good-thing-about-standards-is-that-there-are-so). This does makes sense in that one is for the Web and one for the server, and those environments do have different requirements; for similar reasons Node.js does not have identical APIs to JavaScript on the Web.

However, there is more than the Web and the server, in particular there are also Wasm plugins. For one thing, plugins can run inside an application that may be on the Web (just like [JS plugins](https://www.figma.com/blog/an-update-on-plugin-security/#a-technology-change)) or off the Web; for another, regardless of where the embedding application is, a plugin environment is not a Web nor a server environment. So it's not immediately obvious which sets of APIs will be used - it may depend on the code being ported, the Wasm runtime being embedded, etc.

## Let's unify as much as possible

One concrete way Emscripten hopes to help here is that by using WASI APIs as much as possible we can avoid **unnecessary** API differences. As mentioned earlier, on the Web Emscripten code accesses Web APIs indirectly, through JavaScript, so where that JavaScript API could look like WASI, we'd be removing an unnecessary API difference, and that same binary can also run on the server. In other words, if Wasm wants to log some info, it needs to call into JS, something like this:

```js
wasm   =>   function musl_writev(..) { .. console.log(..) .. }
```

`musl_writev` is an implementation of the Linux syscall interface that [musl libc](https://www.musl-libc.org) uses to write data to a file descriptor, and that ends up calling `console.log` with the proper data. The Wasm module imports and calls that `musl_writev`, which defines an ABI between the JS and the Wasm. That ABI is arbitrary (and in fact Emscripten has changed its ABI over time to optimize it). If we replace that with an ABI that matches WASI, we can get this:

```js
wasm   =>   function __wasi_fd_write(..) { .. console.log(..) .. }
```

This isn't a big change, just requiring some refactoring of the ABI, and when running in a JS environment it doesn't matter much. But now the Wasm can run without the JS since that WASI API is recognized by WASI runtimes! That’s how the standalone Wasm examples from before work, just by refactoring Emscripten to use WASI APIs.

Another advantage of Emscripten using WASI APIs is that we can help the WASI spec by finding real-world issues. For example, we found that [changing the WASI "whence" constants](https://github.com/WebAssembly/WASI/pull/106) would be useful, and we've started some discussions around [code size](https://github.com/WebAssembly/WASI/issues/109) and [POSIX compatibility](https://github.com/WebAssembly/WASI/issues/122).

Emscripten using WASI as much as possible is also useful in that it lets users use a single SDK to target Web, server, and plugin environments. Emscripten isn't the only SDK allowing that, as the WASI SDK's output can be run on the Web using the [WASI Web Polyfill](https://wasi.dev/polyfill/) or Wasmer's [wasmer-js](https://github.com/wasmerio/wasmer-js), but Emscripten’s Web output is more compact, so it lets a single SDK be used without compromising Web performance.

Speaking of which, you can emit a standalone Wasm file from Emscripten with optional JS in a single command:

```
emcc -O3 add.c -o add.js -s STANDALONE_WASM
```

That emits `add.js` and `add.wasm`. The Wasm file is standalone just like earlier when we only emitted a Wasm file by itself (`STANDALONE_WASM` was set automatically when we said `-o add.wasm`), but now in addition there is a JS file that can load and run it. The JS is useful for running it on the Web if you don't want to write your own JS for that.

## Do we need *non*-standalone Wasm?

Why does the `STANDALONE_WASM` flag exist? In theory Emscripten could always set `STANDALONE_WASM`, which would be simpler. But standalone Wasm files can't depend on JS, and that has some downsides:

- We can't minify the Wasm import and export names, as the minification only works if both sides agree, the Wasm and what loads it.
- Normally we create the Wasm Memory in JS so that JS can start to use it during startup, which lets us do work in parallel. But in standalone Wasm we have to create the Memory in the Wasm.
- Some APIs are just easy to do in JS. For example [`__assert_fail`](https://github.com/emscripten-core/emscripten/pull/9558), which is called when a C assertion fails, is normally [implemented in JS](https://github.com/emscripten-core/emscripten/blob/2b42a35f61f9a16600c78023391d8033740a019f/src/library.js#L1235). It takes just a single line, and even if you include the JS functions it calls, the total code size is quite small. On the other hand, in a standalone build we can't depend on JS, so we use [musl's `assert.c`](https://github.com/emscripten-core/emscripten/blob/b8896d18f2163dbf2fa173694eeac71f6c90b68c/system/lib/libc/musl/src/exit/assert.c#L4). That uses `fprintf`, which means it ends up pulling in a bunch of C `stdio` support, including things with indirect calls that make it hard to remove unused functions. Overall, there are many such details that end up making a difference in total code size.

If you want to run both on the Web and elsewhere, and you want 100% optimal code size and startup times, you should make two separate builds, one with `-s STANDALONE` and one without. That's very easy as it's just flipping one flag!

## Necessary API differences

We saw that Emscripten uses WASI APIs as much as possible to avoid **unnecessary** API differences. Are there any **necessary** ones? Sadly, yes - some WASI APIs require tradeoffs. For example:

- WASI does not support various POSIX features, like [user/group/world file permissions](https://github.com/WebAssembly/WASI/issues/122), as a result of which you can't fully implement a (Linux) system `ls` for example (see details in that link). Emscripten's existing filesystem layer does support some of those things, so if we switched to WASI APIs for all filesystem operations then we'd be [losing some POSIX support](https://github.com/emscripten-core/emscripten/issues/9479#issuecomment-542815711).
- WASI's `path_open` [has a cost in code size](https://github.com/WebAssembly/WASI/issues/109) because it forces extra permissions handling in the Wasm itself. That code is unnecessary on the Web.
- WASI doesn't provide a [notification API for memory growth](https://github.com/WebAssembly/WASI/issues/82), and as a result, JS runtimes must constantly check if memory grew and if so update their views, on every import and export. To avoid that overhead, Emscripten provides a notification API, `emscripten_notify_memory_growth`, which [you can see implemented in a single line](https://github.com/zeux/meshoptimizer/blob/bdc3006532dd29b03d83dc819e5fa7683815b88e/js/meshopt_decoder.js#L10) in zeux's meshoptimizer that we mentioned earlier.

In time WASI may add more POSIX support, a memory growth notification, etc. - WASI is still highly experimental and expected to change significantly. For now, to avoid regressions in Emscripten we do not emit 100% WASI binaries if you use certain features. In particular, opening files uses a POSIX method instead of WASI, which means that if you call `fopen` then the resulting Wasm file will not be 100% WASI - however, if all you do is use `printf`, which operates on the already-open `stdout`, then it will be 100% WASI, as in the "hello world" example we saw near the beginning, where Emscripten's output does run in WASI runtimes.

If it would be useful for users we can add a `PURE_WASI` option which would sacrifice code size in return for strict WASI compliance, but if that's not urgent (and most plugin use cases we’ve seen so far don’t need full file I/O) then maybe we can wait for WASI to improve to where Emscripten can remove these non-WASI APIs. That would be the best outcome, and we’re working towards that as you can see in the links above.

However, even if WASI does improve, there is no avoiding the fact that Wasm has two standardized APIs as mentioned earlier. In the future I expect Emscripten will call Web APIs directly using interface types, because that will be more compact than calling a WASI-looking JS API that then calls a Web API (as in the `musl_writev` example from before). We could have a polyfill or a translation layer of some sort to help here, but we wouldn't want to use it unnecessarily, so we will need separate builds for Web and WASI environments. (This is somewhat unfortunate; in theory this could have been avoided if WASI were a superset of Web APIs, but obviously that would have meant compromises on the server side.)

## Current status

Quite a lot works already! The main limitations are:

- **WebAssembly limitations**: Various features, like C++ exceptions, setjmp, and pthreads, depend on JavaScript due to Wasm limitations, and there is no good non-JS replacement yet. (Emscripten may start to support some of them [using Asyncify](https://www.youtube.com/watch?v=qQOP6jqZqf8&list=PLqh1Mztq_-N2OnEXkdtF5yymcihwqG57y&index=2&t=0s), or maybe we'll just wait for [native Wasm features](https://github.com/WebAssembly/exception-handling/blob/master/proposals/Exceptions.md) to arrive to VMs.)
- **WASI limitations**: Libraries and APIs like OpenGL and SDL don't have corresponding WASI APIs yet.

You **can** still use all those in Emscripten's standalone mode, but the output will contain calls to JS runtime support code. As a result, it will not be 100% WASI (for similar reasons those features also do not work in the WASI SDK). Those Wasm files won't run in WASI runtimes, but you can use them on the Web and you can write your own JS runtime for them. You can also use them as plugins; for example, a game engine could have plugins that render using OpenGL, and the developer would compile them in standalone mode and then implement the OpenGL imports in the engine's Wasm runtime. Standalone Wasm mode still helps here because it makes the output as standalone as Emscripten can make it.

You may also find APIs that **do** have a non-JS replacement that we haven’t converted yet, as work is still ongoing. Please [file bugs](https://github.com/emscripten-core/emscripten/issues), and as always help is welcome!
