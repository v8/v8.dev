---
title: 'Profiling Chromium with V8'
---
[V8’s CPU & heap profilers](/docs/profiler) are trivial to use from V8’s shells, but it may appear confusing how to use them with Chromium. This page should help you with it.

## Why is using V8’s profilers with Chromium different from using them with V8 shells?

Chromium is a complex application, unlike V8 shells. Below is the list of Chromium features that affect profiler usage:

- each renderer is a separate process (OK, not actually each, but let’s omit this detail), so they can’t share the same log file;
- sandbox built around renderer process prevents it from writing to a disk;
- Developer Tools configure profilers for their own purposes;
- V8’s logging code contains some optimizations to simplify logging state checks.

## How to run Chromium to get a CPU profile?

Here is how to run Chromium in order to get a CPU profile from the start of the process:

```bash
./Chromium --no-sandbox --js-flags='--logfile=%t.log --prof'
```

Please note that you wouldn’t see profiles in Developer Tools, because all the data is being logged to a file, not to Developer Tools.

### Flags description

`--no-sandbox` turns off the renderer sandbox, which is a must for this exercise.

`--js-flags` contains the flags passed to V8:

- `--logfile=%t.log` specifies a name pattern for log files. `%t` gets expanded into the current time in milliseconds, so each process gets its own log file. You can use prefixes and suffixes if you want, like this: `prefix-%t-suffix.log`.
- `--prof` tells V8 to write statistical profiling information into the log file.

## Notes

Under Windows, be sure to turn on `.MAP` file creation for `chrome.dll`, but not for `chrome.exe`.
