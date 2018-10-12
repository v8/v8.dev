---
title: 'Using `d8` on Android'
---
## Prerequisites

- a Linux/Mac workstation
- V8 r12178 (on Google Code) or later
- an Android emulator or device with matching USB cable
- make sure building with GYP works
- Mac-only: [download the NDK](http://developer.android.com/ndk/downloads/index.html) and note the path where it is installed.

## Get the code

- First, [check out the V8 source code](/docs/source-code).
- Add the Android dependencies:

    ```bash
    echo "target_os = ['android']" >> ../.gclient && gclient sync --nohooks
    ```

- The sync takes a while the first time as it downloads the Android NDK to `v8/third_party`.
- If you want to use a different NDK, or you are building on Mac where you *must* supply your own NDK, you need to pass the path to your NDK installation when running `make`.

    ```bash
    make android_arm.release -j16 android_ndk_root=[full path to ndk]
    ```


## Get the Android SDK

- tested version: `r15`
- download the SDK from http://developer.android.com/sdk/index.html
- extract it
- install the “Platform tools” using the SDK manager that you can start by running `tools/android`
- now you have a `platform_tools/adb` binary which will be used later; put it in your `PATH` or remember where it is

## Set up your device

- Enable USB debugging (Gingerbread: Settings > Applications > Development > USB debugging; Ice Cream Sandwich: Settings > Developer Options > USB debugging)
- connect your device to your workstation
- make sure `adb devices` shows it; you may have to edit `udev` rules to give yourself proper permissions
- run `adb shell` to get an SSH-like shell on the device. In that shell, do:

    ```bash
    cd /data/local/tmp
    mkdir v8
    cd v8
    ```

## Push stuff onto the device

- make sure your device is connected
- from your workstation’s shell:

    ```bash
    adb push /file/you/want/to/push /data/local/tmp/v8/
    ```

## Compile V8 for Android

`gn args` should specify:

```js
is_component_build = false
target_cpu = "arm"
target_os = "android"
v8_android_log_stdout = true
```

You may use goma, and specify debug or not, and symbol levels, as usual.

Assuming you build to `out/android_arm.release`, copy the binaries and support files over:

```bash
adb push out/android_arm.release/d8 /data/local/tmp/v8/d8
adb push out/android_arm.release/snapshot_blob.bin /data/local/tmp/v8/
adb push out/android_arm.release/natives_blob.bin /data/local/tmp/v8/
```

The most comfortable way to run it is from your workstation’s shell as a one-off command (rather than starting an interactive shell session on the device), that way you can use pipes or whatever to process the output as necessary:

```bash
adb shell /data/local/tmp/v8/d8 <parameters>
```

- warning: when you cancel such an `adb shell whatever` command using Ctrl+C, the process on the phone sometimes keeps running.


## Profile

- compile a binary, push it to the device, keep a copy of it on the host

    ```bash
    ninja -C android_arm.release
    adb push out/android_arm.release/d8 /data/local/tmp/v8/d8-version.under.test
    cp out/android_arm.release/d8 ./d8-version.under.test
    ```

- get a profiling log and copy it to the host:

    ```bash
    adb shell /data/local/tmp/v8/d8-version.under.test benchmark.js --prof
    adb pull /data/local/tmp/v8/v8.log ./
    ```

- open `v8.log` in your favorite editor and edit the first line to match the full path of the `d8-version.under.test` binary on your workstation (instead of the `/data/local/tmp/v8/` path it had on the device)

- run the tick processor with the host’s `d8` and an appropriate `nm` binary:

    ```
    cp out/ia32.release/d8 ./d8  # only required once
    tools/linux-tick-processor --nm=$ANDROID_NDK_ROOT/toolchain/bin/arm-linux-androideabi-nm
    ```

## Using the static libraries

The static libraries created by the build process are found in `out/android_arm.release/obj.target/tools/gyp/`. They are “thin” archives, which means that the `.a` files contain symbolic links to the `.o` files used to make the archive. This makes these libraries unusable on any machine but the one that built the library.

A program linking with V8 must link with `libv8_libplatform.a` `libv8_base.a` `libv8_libbase.a` and one of the snapshot libaries such as`libv8_nosnapshot.a` that are produced if V8 is compiled with the `snapshot=off` option.

Unless V8 was compiled with `i18nsupport=off` option the program must also link with the International Components for Unicode (ICU) library found in `out/android_arm.release/obj.target/third_party/icu/`.

## Compile SpiderMonkey for Lollipop

```bash
cd firefox/js/src
autoconf2.13
./configure \
  --target=arm-linux-androideabi \
  --with-android-ndk=$ANDROID_NDK_ROOT \
  --with-android-version=21 \
  --without-intl-api \
  --disable-tests \
  --enable-android-libstdcxx \
  --enable-pie
make
adb push -p js/src/shell/js /data/local/tmp/js
```
