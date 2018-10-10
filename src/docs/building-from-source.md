---
title: 'Building V8 from source'
---
In order to be able to build V8 from scratch on Windows/Linux/macOS for x64, please follow the following steps.

## Getting the V8 source

1. On Linux or macOS, first install [Git](https://github.com/v8/v8/wiki/Using%20Git#prerequisites) and then [`depot_tools`](http://commondatastorage.googleapis.com/chrome-infra-docs/flat/depot_tools/docs/html/depot_tools_tutorial.html#_setting_up).

    On Windows, follow the Chromium instructions ([for Googlers](https://goto.google.com/building-chrome-win), [for non-Googlers](https://chromium.googlesource.com/chromium/src/+/master/docs/windows_build_instructions.md#Setting-up-Windows)) to install Visual Studio, Debugging tools for Windows, and `depot_tools` (which on Windows includes Git).

1. Update `depot_tools` by executing the following into your terminal/shell. On Windows, this has to be done in the Command Prompt (`cmd.exe`), as opposed to PowerShell or others.

    ```bash
    gclient
    ```

1. Enter the directory you want to download the V8 source into and execute the following:

    ```bash
    fetch v8
    cd v8
    ```

**Note:** Do not simply `git clone` the V8 repository!

## Installing build dependencies

1. For macOS: install Xcode and accept its license agreement. (If you’ve installed the command-line tools separately, [remove them first](https://bugs.chromium.org/p/chromium/issues/detail?id=729990#c1).)

1. Make sure that you are in the V8 source directory. If you followed every step in the previous section, you’re already at the right location.

1. Download all the build dependencies:

    ```bash
    gclient sync
    ```

1. This step is only needed on Linux. Install additional build dependencies:

    ```bash
    ./build/install-build-deps.sh
    ```

## Building V8

1. Make sure that you are in the V8 source directory on the `master` branch.

    ```bash
    cd /path/to/v8
    ```

1. Pull in the latest changes and install any new build dependencies:

    ```bash
    git pull && gclient sync
    ```

1. Compile the source:

    ```bash
    tools/dev/gm.py x64.release
    ```

    Or, to compile the source and immediately run the tests:

    ```bash
    tools/dev/gm.py x64.release.check
    ```

    For more information on the `gm.py` helper script and the commands it triggers, see [Building with GN](TODO).

More in-depth information can be found [here](https://github.com/v8/v8/wiki/Building%20with%20GN).
