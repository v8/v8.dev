---
title: 'Testing'
---
V8 includes a test framework that allows you to test the engine. The framework lets you run both our own test suites that are included with the source code and others, such as [the Test262 test suite](https://github.com/tc39/test262).

## Running the V8 tests

Before you run the tests, [build V8 with GN](/docs/build-gn).

You can append `.check` to any build target to have tests run for it, e.g.

```bash
make ia32.release.check
make ia32.check
make release.check
make check # builds and tests everything (no dot before "check"!)
```

Before submitting patches, you should always run the `quickcheck` target, which builds a fast debug build and runs only the most relevant tests:

```bash
make quickcheck
```

If you built V8 using GN, you can run tests like this:

```bash
tools/run-tests.py --gn
```

Or if you want have multiple GN configurations and don’t want to run the tests on the last compiled configuration:

```bash
tools/run-tests.py --outdir=out.gn/ia32.release
```

You can also run tests manually:

```bash
tools/run-tests.py --arch-and-mode=ia32.release [--outdir=foo]
```

Or you can run individual tests:

```bash
tools/run-tests.py --arch=ia32 cctest/test-heap/SymbolTable/* mjsunit/delete-in-eval
```

Run the script with `--help` to find out about its other options, `--outdir` defaults to `out`. Also note that using the `cctest` binary to run multiple tests in one process is not supported.

## Running the Mozilla and Test262 tests

The V8 test framework comes with support for running the Mozilla test suite as well as the Test262 test suite. To download the test suites and then run them for the first time, do the following:

```bash
tools/run-tests.py --download-data mozilla
tools/run-tests.py --download-data test262
```

To run the tests subsequently, you may omit the flag that downloads the test suite:

```bash
tools/run-tests.py mozilla
tools/run-tests.py test262
```

Note that V8 fails a number of Mozilla tests because they require Firefox-specific extensions.

## Running the WebKit tests

Sometimes all of the above tests pass but WebKit build bots fail. To make sure WebKit tests pass run:

```bash
tools/run-tests.py --progress=verbose --outdir=out --arch=ia32 --mode=release webkit --timeout=200
```

Replace `--arch` and other parameters with values that match your build options.

## Running microbenchmarks

Under `test/js-perf-test` we have microbenchmarks to track feature performance. There is a special runner for these: `tools/run_perf.py`. Run them like:

```bash
tools/run_perf.py --arch x64 --binary-override-path out.gn/x64.release/d8 test/js-perf-test/JSTests.json
```

If you don’t want to run all the `JSTests`, you can provide a `filter` argument:

```bash
tools/run_perf.py --arch x64 --binary-override-path out.gn/x64.release/d8 --filter JSTests/TypedArrays test/js-perf-test/JSTests.json
```

## Updating the bytecode expectations

Sometimes the bytecode expectations may change resulting in `cctest` failures. To update the golden files, build `test/cctest/generate-bytecode-expectations` by running:

```bash
ninja -C out.gn/x64.release generate-bytecode-expectations
```

…and then updating the default set of inputs by passing the `--rebaseline` flag to the generated binary:

```bash
out.gn/x64.release/generate-bytecode-expectations --rebaseline
```

The updated goldens are now available in ` test/cctest/interpreter/bytecode_expectations/`.

## Adding a new bytecode expectations test

1. Add a new test case to `cctest/interpreter/test-bytecode-generator.cc` and specify a golden file with the same test name.

1. Build `generate-bytecode-expectations`:

    ```bash
    ninja -C out.gn/x64.release generate-bytecode-expectations
    ```

1. Run

    ```
    out.gn/x64.release/generate-bytecode-expectations --raw-js testcase.js --output=test/cctest/interpreter/bytecode-expectations/testname.golden
    ```

    where `testcase.js` contains the JavaScript test case that was added to `test-bytecode-generator.cc` and `testname` is the name of the test defined in `test-bytecode-generator.cc`.
