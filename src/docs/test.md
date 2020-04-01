---
title: 'Testing'
description: 'This document explains the testing framework that is part of the V8 repository.'
---
V8 includes a test framework that allows you to test the engine. The framework lets you run both our own test suites that are included with the source code and others, such as [the Test262 test suite](https://github.com/tc39/test262).

## Running the V8 tests

[Using `gm`](/docs/build-gn#gm), you can simply append `.check` to any build target to have tests run for it, e.g.

```bash
gm x64.release.check
gm x64.optdebug.check  # recommended: reasonably fast, with DCHECKs.
gm ia32.check
gm release.check
gm check  # builds and tests all default platforms
```

`gm` automatically builds any required targets before running the tests. You can also limit the tests to be run:

```bash
gm x64.release test262
gm x64.debug mjsunit/regress/regress-123
```

If you have already built V8, you can run the tests manually:

```bash
tools/run-tests.py --outdir=out/ia32.release
```

Again, you can specify which tests to run:

```bash
tools/run-tests.py --outdir=ia32.release cctest/test-heap/SymbolTable/* mjsunit/delete-in-eval
```

Run the script with `--help` to find out about its other options.

## Running more tests

The default set of tests to be run does not include all available tests. You can specify additional test suites on the command line of either `gm` or `run-tests.py`:

- `benchmarks` (just for correctness; does not produce benchmark results!)
- `mozilla`
- `test262`
- `webkit`

## Running microbenchmarks

Under `test/js-perf-test` we have microbenchmarks to track feature performance. There is a special runner for these: `tools/run_perf.py`. Run them like:

```bash
tools/run_perf.py --arch x64 --binary-override-path out/x64.release/d8 test/js-perf-test/JSTests.json
```

If you don’t want to run all the `JSTests`, you can provide a `filter` argument:

```bash
tools/run_perf.py --arch x64 --binary-override-path out/x64.release/d8 --filter JSTests/TypedArrays test/js-perf-test/JSTests.json
```

## Updating the bytecode expectations (rebaselining)

Sometimes the bytecode expectations may change resulting in `cctest` failures. To update the golden files, build `test/cctest/generate-bytecode-expectations` by running:

```bash
gm x64.release generate-bytecode-expectations
```

…and then updating the default set of inputs by passing the `--rebaseline` flag to the generated binary:

```bash
out/x64.release/generate-bytecode-expectations --rebaseline
```

The updated goldens are now available in `test/cctest/interpreter/bytecode_expectations/`.

## Adding a new bytecode expectations test

1. Add a new test case to `cctest/interpreter/test-bytecode-generator.cc` and specify a golden file with the same test name.

1. Build `generate-bytecode-expectations`:

    ```bash
    gm x64.release generate-bytecode-expectations
    ```

1. Run

    ```bash
    out/x64.release/generate-bytecode-expectations --raw-js testcase.js --output=test/cctest/interpreter/bytecode-expectations/testname.golden
    ```

    where `testcase.js` contains the JavaScript test case that was added to `test-bytecode-generator.cc` and `testname` is the name of the test defined in `test-bytecode-generator.cc`.
