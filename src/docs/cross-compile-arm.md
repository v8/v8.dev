---
title: 'Cross-compiling and debugging for ARM/Android'
description: 'This document explains how to cross-compile V8 for ARM/Android, and how to debug it.'
---
First, make sure you can [build with GN](/docs/build-gn).

Then, add `android` to your `.gclient` configuration file to get the neceasseray android dependencies checked out:

```python
solutions = [
  ...
]
target_os = ['android', 'unix']
```

Run `gclient sync`, and you’ll get a large checkout under `./third_party/android_tools`.

Enable developer mode on your phone or tablet, and turn on USB debugging, via instructions [here](https://developer.android.com/studio/run/device.html). Also, get the handy [`adb`](https://developer.android.com/studio/command-line/adb.html) tool on your path. It’s in your checkout at `./third_party/android_sdk/public/platform-tools`.

## Using `gm`

Use [the `tools/dev/gm.py` script](/docs/build-gn#gm) to automatically build V8 tests and run them on the device.

```bash
alias gm=/path/to/v8/tools/dev/gm.py
# Just build d8:
gm android_arm64.release.d8
# Build tests and run them on a connected android device:
gm android_arm64.release.check
```

## Manually running d8 on an Android device

Use `adb` to copy the binary and snapshot files to the phone:

```bash
adb shell rm -vrf /data/local/tmp/v8/bin && \
adb shell mkdir --parents /data/local/tmp/v8/bin && \
adb push out/android_arm64.release/* /data/local/tmp/v8/bin && \
```

```bash
rebuffat:~/src/v8$ adb shell
bullhead:/ $ /data/local/tmp/v8/bin/d8
V8 version 11.3.0 (candidate)
d8> 2**12
4096
d8> 
```

## Debugging

### d8

Remote debugging `d8` on an Android device is relatively simple. First start `gdbserver` on the Android device:

```bash
bullhead:/data/local/tmp/v8/bin $ gdbserver :5039 $D8 <arguments>
```

Then connect to the server on your host device.

```bash
adb forward tcp:5039 tcp:5039
gdb $D8
gdb> target remote :5039
```

`gdb` and `gdbserver` need to be compatible with each other, if in doubt use the binaries from the [Android NDK](https://developer.android.com/ndk). Note that by default the `d8` binary is stripped (debugging info removed), `$OUT_DIR/exe.unstripped/d8` contains the unstripped binary though.

### Logging

By default, some of `d8`’s debugging output ends up in the Android system log, which can be dumped using [`logcat`](https://developer.android.com/studio/command-line/logcat). Unfortunately, sometimes part of a particular debugging output is split between system log and `adb`, and sometimes some part seems to be completely missing. To avoid these issues, it is recommended to add the following setting to the `gn args`:

```python
v8_android_log_stdout = true
```

### Floating-point issues

The `gn args` setting `arm_float_abi = "hard"`, which is used by the V8 Arm GC Stress bot, can result in completely nonsensical program behavior on hardware different from the one the GC stress bot is using (e.g. on Nexus 7).

## Using Sourcery G++ Lite

The Sourcery G++ Lite cross compiler suite is a free version of Sourcery G++ from [CodeSourcery](http://www.codesourcery.com/). There is a page for the [GNU Toolchain for ARM Processors](http://www.codesourcery.com/sgpp/lite/arm). Determine the version you need for your host/target combination.

The following instructions use [2009q1-203 for ARM GNU/Linux](http://www.codesourcery.com/sgpp/lite/arm/portal/release858), and if using a different version please change the URLs and `TOOL_PREFIX` below accordingly.

### Installing on host and target

The simplest way of setting this up is to install the full Sourcery G++ Lite package on both the host and target at the same location. This will ensure that all the libraries required are available on both sides. If you want to use the default libraries on the host there is no need the install anything on the target.

The following script installs in `/opt/codesourcery`:

```bash
#!/bin/sh

sudo mkdir /opt/codesourcery
cd /opt/codesourcery
sudo chown "$USERNAME" .
chmod g+ws .
umask 2
wget http://www.codesourcery.com/sgpp/lite/arm/portal/package4571/public/arm-none-linux-gnueabi/arm-2009q1-203-arm-none-linux-gnueabi-i686-pc-linux-gnu.tar.bz2
tar -xvf arm-2009q1-203-arm-none-linux-gnueabi-i686-pc-linux-gnu.tar.bz2
```

## Profile

- Compile a binary, push it to the device, keep a copy of it on the host:

    ```bash
    adb shell cp /data/local/tmp/v8/bin/d8 /data/local/tmp/v8/bin/d8-version.under.test
    cp out.gn/arm.release/d8 ./d8-version.under.test
    ```

- Get a profiling log and copy it to the host:

    ```bash
    adb push benchmarks /data/local/tmp
    adb shell cd /data/local/tmp/benchmarks; ../v8/bin/d8-version.under.test run.js --prof
    adb shell /data/local/tmp/v8/bin/d8-version.under.test benchmark.js --prof
    adb pull /data/local/tmp/benchmarks/v8.log ./
    ```

- Open `v8.log` in your favorite editor and edit the first line to match the full path of the `d8-version.under.test` binary on your workstation (instead of the `/data/local/tmp/v8/bin/` path it had on the device)

- Run the tick processor with the host’s `d8` and an appropriate `nm` binary:

    ```bash
    cp out/x64.release/d8 .  # only required once
    cp out/x64.release/natives_blob.bin .  # only required once
    cp out/x64.release/snapshot_blob.bin .  # only required once
    tools/linux-tick-processor --nm=$(pwd)/third_party/android_ndk/toolchains/arm-linux-androideabi-4.9/prebuilt/linux-x86_64/bin/arm-linux-androideabi-nm
    ```
