---
title: 'V8’s Linux `perf` integration'
---
V8 has built-in support for the Linux `perf` tool. By default, this support is disabled, but by using the `--perf-prof` and `--perf-prof-debug-info` command-line options, V8 writes out performance data during execution into a file that can be used to analyze the performance of V8’s JITted code with the Linux `perf` tool.

## Setup

In order to analyze V8 JIT code with the Linux `perf` tool, you need to:

- Use a very recent Linux kernel that provides high-resolution timing information to the `perf` tool and to V8’s `perf` integration in order to synchronize JIT code performance samples with the standard performance data collected by the Linux `perf` tool.
- Use a recent very recent version of the Linux `perf` tool or apply the patch that supports JIT code to `perf` and build it yourself.

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

## Build

To use V8’s integration with Linux perf you need to build it with the appropriate GN build flag activated. You can set `enable_profiling = true` in an existing GN build configuration.

```bash
echo 'enable_profiling = true' >> out.gn/x64.release/args.gn
ninja -C out.gn/x64.release
```

Alternatively, you create a new clean build configuration with only the single build flag set to enable `perf` support:

```bash
cd <path_to_your_v8_checkout>
tools/dev/v8gen.py x64.release
echo 'enable_profiling = true' >> out.gn/x64.release/args.gn
ninja -C out.gn/x64.release
```

## Running `d8` with perf flags

Once you have the right kernel, perf tool and build of V8, you can add the `--perf-prof` to the V8 command-line to record performance samples in JIT code. Additionally, you need to disable write protection for code memory via `--nowrite-protect-code-memory`. This is necessary because `perf` discards information about code pages when it sees the event corresponding to removing the write bit from the code page. Here’s an example that records samples from a test JavaScript file:

```bash
cd <path_to_your_v8_checkout>
echo '(function f() {
    var s = 0; for (var i = 0; i < 1000000000; i++) { s += i; } return s;
  })();' > test.js
<path_to_kernel_checkout>/tip/tools/perf/perf record -k mono \
    out.gn/x64.release/d8 --perf-prof --nowrite-protect-code-memory \
    test.js
```

## Evaluating perf output

After execution finishes, you must combine the static information gathered from the `perf` tool with the performance samples output by V8 for JIT code:

```bash
<path_to_kernel_checkout>/tip/tools/perf/perf inject -j -i perf.data \
    -o perf.data.jitted
```

Finally you can use the Linux `perf` tool to explore the performance bottlenecks in your JITted code:

```bash
<path_to_kernel_checkout>/tip/tools/perf/perf report -i perf.data.jitted
```
