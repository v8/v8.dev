---
title: 'Getting started with embedding V8'
---
This document introduces some key V8 concepts and provides a `hello world` example to get you started with V8 code.

## Audience

This document is intended for C++ programmers who want to embed the V8 JavaScript engine within a C++ application.

## Hello world

Let's look at a [Hello World example](https://chromium.googlesource.com/v8/v8/+/branch-heads/6.8/samples/hello-world.cc) that takes a JavaScript statement as a string argument, executes it as JavaScript code, and prints the result to standard out.

First, some key concepts you will need:
- An isolate is a VM instance with its own heap.
- A local handle is a pointer to an object. All V8 objects are accessed using handles. They are necessary because of the way the V8 garbage collector works.
- A handle scope can be thought of as a container for any number of handles. When you've finished with your handles, instead of deleting each one individually you can simply delete their scope.
- A context is an execution environment that allows separate, unrelated, JavaScript code to run in a single instance of V8. You must explicitly specify the context in which you want any JavaScript code to be run.

These concepts are discussed in greater detail in the [[Embedder's Guide|Embedder's Guide]].

## Run the example

Follow the steps below to run the example yourself:

1. Download the V8 source code by following [the Git instructions](TODO-using-git).
1. The instructions for this hello world example have last been tested with V8 v7.1.11. You can check out this branch with `git checkout refs/tags/7.1.11 -b sample -t`
1. Create a build configuration using the helper script:

    ```bash
    tools/dev/v8gen.py x64.release.sample
    ```

    You can inspect and manually edit the build configuration by running:

    ```bash
    gn args out.gn/x64.release.sample
    ```

1. Build the static library on a Linux 64 system:

    ```bash
    ninja -C out.gn/x64.release.sample v8_monolith
    ```

1. Compile `hello-world.cc`, linking to the static library created in the build process. For example, on 64bit Linux using the GNU compiler:

    ```bash
    g++ -I. -Iinclude samples/hello-world.cc -o hello_world -lv8_monolith -Lout.gn/x64.release.sample/obj/ -pthread -std=c++0x
    ```

1. For more complex code, V8 fails without an ICU data file. Copy this file to where your binary is stored:

    ```bash
    cp out.gn/x64.release.sample/icudtl.dat .
    ```

1. Run the `hello_world` executable file at the command line. e.g. On Linux, in the V8 directory, run:

    ```bash
    ./hello_world
    ```

1. You will see `Hello, World!`. Yay!

This is a very simple example and you’ll likely want to do more than just execute scripts as strings. For more information see the [[Embedder's Guide|Embedder's Guide]]. If you are looking for an example which is in sync with master simply check out the file [`hello-world.cc`](https://chromium.googlesource.com/v8/v8/+/master/samples/hello-world.cc).
