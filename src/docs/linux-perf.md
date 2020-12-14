---
title: 'V8’s Linux `perf` integration'
description: 'This document explains how to analyze the performance of V8’s JITted code with the Linux `perf` tool.'
---
V8 has built-in support for the Linux `perf` tool. By default, this support is disabled, but by using the `--perf-prof` and `--perf-prof-debug-info` command-line options, V8 writes out performance data during execution into a file that can be used to analyze the performance of V8’s JITted code with the Linux `perf` tool.

## Optional: Get recent kernel and `perf`

In order to analyze V8 JIT code with the Linux `perf` tool, you need to:

- Use a recent Linux kernel that provides high-resolution timing information to the `perf` tool and to V8’s `perf` integration in order to synchronize JIT code performance samples with the standard performance data collected by the Linux `perf` tool.
- Use a recent version of the Linux `perf` tool or apply the patch that supports JIT code to `perf` and build it yourself.

Install a new Linux kernel, and then reboot your machine:

```bash
sudo apt-get install linux-generic-lts-wily
```

Install dependencies:

```bash
sudo apt-get install libdw-dev libunwind8-dev systemtap-sdt-dev libaudit-dev \
    libslang2-dev binutils-dev liblzma-dev
```

Download kernel sources that include the latest `perf` tool source:

```bash
cd <path_to_kernel_checkout>
git clone --depth 1 git://git.kernel.org/pub/scm/linux/kernel/git/tip/tip.git
cd tip/tools/perf
make
```

In the following steps, invoke `perf` as `<path_to_kernel_checkout>/tip/tools/perf/perf`.

## Build V8

To use V8’s integration with Linux perf you need to build it with the appropriate GN build flag activated. You can set `enable_profiling = true` in an existing GN build configuration.

```bash
echo 'enable_profiling = true' >> out/x64.release/args.gn
ninja -C out/x64.release
```

Alternatively, you create a new clean build configuration with only the single build flag set to enable `perf` support:

```bash
cd <path_to_your_v8_checkout>
gn gen out/x64.release \
    --args='is_debug=false target_cpu="x64" enable_profiling=true'
ninja -C out/x64.release
```

## Running `d8` with perf flags

Once you have the right kernel, perf tool and build of V8, you can start using linux perf:

```bash
cd <path_to_your_v8_checkout>
echo '(function f() {
    var s = 0; for (var i = 0; i < 1000000000; i++) { s += i; } return s;
  })();' > test.js
perf record --call-graph -k mono out/x64.release/d8 \
    --perf-prof --no-write-protect-code-memory test.js
```

### Flags description

[`--perf-prof`](https://source.chromium.org/search?q=FLAG_perf_prof) is used to the V8 command-line to record performance samples in JIT code.

[`--nowrite-protect-code-memory`](https://source.chromium.org/search?q=FLAG_nowrite_protect_code_memory) is requried to disable write protection for code memory. This is necessary because `perf` discards information about code pages when it sees the event corresponding to removing the write bit from the code page. Here’s an example that records samples from a test JavaScript file:

[`--interpreted-frames-native-stack`](https://source.chromium.org/search?q=FLAG_interpreted_frames_native_stack) is used to create different entry points (copied versions of InterpreterEntryTrampoline) for interpreted functions so they can be distinguished by `perf` based on the address alone.

## Running `chrome` with perf flags

1. You can use the same V8 flags to profile chrome itself. Follow the instructions above for the correct V8 flags and add the [required chrome gn flags](https://chromium.googlesource.com/chromium/src/+/master/docs/profiling.md#preparing-your-checkout) to your chrome build.

1. Once your build is ready, you can profile a website with both, full symbols for C++ and JS code.

    ```
    out/x64.release/chrome --user-data-dir=`mktemp -d` --no-sandbox --incognito \
        --js-flags='--perf-prof --no-write-protect-code-memory --interpreted-frames-native-stack'
    ```

1. After starting up chrome, find the renderer process id using the Task Manager and use it to start profiling:

    ```
    perf record --call-graph -p $RENDERER_PID -k 1 -o perf.data
    ```

1. Navigate to your website and then continue with the next section on how to evaluate the perf output.

## Evaluating perf output

After execution finishes, you must combine the static information gathered from the `perf` tool with the performance samples output by V8 for JIT code:

```bash
perf inject -j -i perf.data -o perf.data.jitted
```

Finally you can use the Linux `perf` tool to explore the performance bottlenecks in your JITted code:

```bash
perf report -i perf.data.jitted
```

You can also convert `perf.data.jitted` file with [perf_to_profile](https://github.com/google/perf_data_converter) to work with [pprof](https://github.com/google/pprof) to generate more visualizations:

```
~/Documents/perf_data_converter/bazel-bin/src/perf_to_profile -j -i perf.data.jitted -o out.prof;
pprof -http out.prof;
```
