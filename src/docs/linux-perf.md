---
title: 'V8’s Linux `perf` integration'
description: 'This document explains how to analyze the performance of V8’s JITted code with the Linux `perf` tool.'
---
V8 has built-in support for the Linux `perf` tool. It is enable by the `--perf-prof` command-line options.
V8 writes out performance data during execution into a file that can be used to analyze the performance of V8’s JITted code (including JS-function names) with the Linux `perf` tool.

## Requirements

- `linux-perf` version 5 or higher (previous version don't have jit support). (See instructions at the [end](#build-perf))
- Build V8/Chrome with `enable_profiling=true` for better symbolized stacks


## Build V8

To use V8’s integration with Linux perf you need to build it with the `enable_profiling = true` gn flag:

```bash
echo 'enable_profiling = true' >> out/x64.release/args.gn
ninja -C out/x64.release
```

## Profiling `d8` with perf flags

After building `d8`, you can start using linux perf:

```bash
cd <path_to_your_v8_checkout>
echo '(function f() {
    var s = 0; for (var i = 0; i < 1000000000; i++) { s += i; } return s;
  })();' > test.js
perf record -g -k mono out/x64.release/d8 \
    --perf-prof --no-write-protect-code-memory \
    --interpreted-frames-native-stack \
    test.js
```

## V8 linux-perf Flags

[`--perf-prof`](https://source.chromium.org/search?q=FLAG_perf_prof) is used to the V8 command-line to record performance samples in JIT code.

[`--nowrite-protect-code-memory`](https://source.chromium.org/search?q=FLAG_nowrite_protect_code_memory) is requried to disable write protection for code memory. This is necessary because `perf` discards information about code pages when it sees the event corresponding to removing the write bit from the code page. Here’s an example that records samples from a test JavaScript file:

[`--interpreted-frames-native-stack`](https://source.chromium.org/search?q=FLAG_interpreted_frames_native_stack) is used to create different entry points (copied versions of InterpreterEntryTrampoline) for interpreted functions so they can be distinguished by `perf` based on the address alone.


## Profiling chrome with the [linux-perf.py](https://source.chromium.org/search?q=linux-perf.py) script

1. You can use the same V8 flags to profile chrome itself. Follow the instructions above for the correct V8 flags and add the [required chrome gn flags](https://chromium.googlesource.com/chromium/src/+/master/docs/profiling.md#General-checkout-setup) to your chrome build.

1. Once your build is ready, you can profile a website with both, full symbols for C++ and JS code.

    ```bash
    mkdir perf_results;
    tools/chrome/linux-perf.py out/x64.release/chrome --perf-data-dir=perf_results --timeout=30
    ```

2. Navigate to your website and then close the browser (or wait for the `--timeout` to complete)
3. After quitting the browser `linux-perf.py` will post-process the files and show a list with a result file for each renderer process:
  
   ```
   chrome_renderer_1583105_3.perf.data.jitted      19.79MiB
   chrome_renderer_1583105_2.perf.data.jitted       8.59MiB
   chrome_renderer_1583105_4.perf.data.jitted       0.18MiB
   chrome_renderer_1583105_1.perf.data.jitted       0.16MiB
   ```

## Explore linux-perf results

Finally you can use the Linux `perf` tool to explore the profile of a d8 or chrome renderer process:

```bash
perf report -i perf.data.jitted
```

You can also use [pprof](https://github.com/google/pprof) to generate more visualizations:

```bash
pprof -flame perf.data.jitted;
```


## Using linux-perf with chrome directly

1. You can use the same V8 flags to profile chrome itself. Follow the instructions above for the correct V8 flags and add the [required chrome gn flags](https://chromium.googlesource.com/chromium/src/+/master/docs/profiling.md#General-checkout-setup) to your chrome build.

1. Once your build is ready, you can profile a website with both, full symbols for C++ and JS code.

    ```bash
    out/x64.release/chrome \
        --user-data-dir=`mktemp -d` \
        --no-sandbox --incognito --enable-benchmarking \
        --js-flags='--perf-prof --no-write-protect-code-memory --interpreted-frames-native-stack'
    ```

1. After starting up chrome, find the renderer process id using the Task Manager and use it to start profiling:

    ```bash
    perf record -g -k mono -p $RENDERER_PID -o perf.data
    ```

1. Navigate to your website and then continue with the next section on how to evaluate the perf output.

2. After execution finishes, combine the static information gathered from the `perf` tool with the performance samples output by V8 for JIT code:

   ```bash
   perf inject -j -i perf.data -o perf.data.jitted
   ```

3 Finally you can use the Linux `perf` [tool to explore](#Explore-linux-perf-results) 



## Build `perf`

If you have an outdated linux kernel you can build linux-perf with jit support locally.

- Install a new Linux kernel, and then reboot your machine:
  ```bash
   sudo apt-get install linux-generic-lts-wily;
  ```

- Install dependencies:
  ```bash
  sudo apt-get install libdw-dev libunwind8-dev systemtap-sdt-dev libaudit-dev \
     libslang2-dev binutils-dev liblzma-dev;
  ```

- Download kernel sources that include the latest `perf` tool source:

  ```bash
  cd some/directory;
  git clone --depth 1 git://git.kernel.org/pub/scm/linux/kernel/git/tip/tip.git;
  cd tip/tools/perf;
  make
  ```

In the following steps, invoke `perf` as `some/director/tip/tools/perf/perf`.
