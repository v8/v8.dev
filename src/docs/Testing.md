V8 includes a test framework that allows you to test the engine. The framework lets you run both our own test suites that are included with the source code and others, currently only the Mozilla tests.

## Running the V8 tests

Before you run the tests, [build V8 with GN](https://github.com/v8/v8/wiki/Building-with-GN).

You can append `.check` to any build target to have tests run for it, e.g.
```
make ia32.release.check
make ia32.check
make release.check
make check # builds and tests everything (no dot before "check"!)
```

Before submitting patches, you should always run the `quickcheck` target, which builds a fast debug build and runs only the most relevant tests:

```
make quickcheck
```

If you built V8 using GN, you can run tests like this:
```
tools/run-tests.py --gn
```

or if you want have multiple GN configurations and don't want to run the tests on the last compiled configuration:
```
tools/run-tests.py --outdir=out.gn/ia32.release
```

You can also run tests manually:
```
tools/run-tests.py --arch-and-mode=ia32.release [--outdir=foo]
```

Or you can run individual tests:
```
tools/run-tests.py --arch=ia32 cctest/test-heap/SymbolTable/* mjsunit/delete-in-eval
```

Run the script with `--help` to find out about its other options, `--outdir` defaults to `out`. Also note that using the `cctest` binary to run multiple tests in one process is not supported.

## Running the Mozilla and Test262 tests

The V8 test framework comes with support for running the Mozilla as well as the Test262 test suite. To download the test suites and then run them for the first time, do the following:

```
tools/run-tests.py --download-data mozilla
tools/run-tests.py --download-data test262
```

To run the tests subsequently, you may omit the flag that downloads the test suite:

```
tools/run-tests.py mozilla
tools/run-tests.py test262
```

Note that V8 fails a number of Mozilla tests because they require Firefox-specific extensions.

## Running the WebKit tests

Sometimes all of the above tests pass but WebKit build bots fail. To make sure WebKit tests pass run:

```
tools/run-tests.py --progress=verbose --outdir=out --arch=ia32 --mode=release webkit --timeout=200
```

Replace `--arch` and other parameters with values that match your build options.

## Running Microbenchmarks

Under `test/js-perf-test` we have microbenchmarks to track feature performance. There is a special runner for these: `tools/run_perf.py`. Run them like:
```
tools/run_perf.py --arch x64 --binary-override-path out.gn/x64.release/d8 test/js-perf-test/JSTests.json
```

If you don't want to run all the JSTests, you can provide a filter argument:
```
tools/run_perf.py --arch x64 --binary-override-path out.gn/x64.release/d8 --filter JSTests/TypedArrays test/js-perf-test/JSTests.json
```

## Updating the bytecode expectations

Sometimes the bytecode expectations may change resulting in cctest failures. To update the golden files, build `test/cctest/generate-bytecode-expectations` by running:
```
ninja -C out.gn/x64.release generate-bytecode-expectations
```

and then updating the default set of inputs by passing the `--rebaseline` flag to the generated binary:
```
out.gn/x64.release/generate-bytecode-expectations --rebaseline
```

The updated goldens will be available in ` test/cctest/interpreter/bytecode_expectations/`.

## Adding a new bytecode expectations test

1) Add a new test case to `cctest/interpreter/test-bytecode-generator.cc` and specify a golden file with the same test name.
2) Build `generate-bytecode-expectations` by running:
```
ninja -C out.gn/x64.release generate-bytecode-expectations
```
3) Run 
```
out.gn/x64.release/generate-bytecode-expectations --raw-js testcase.js --output=test/cctest/interpreter/bytecode-expectations/testname.golden
``` 
where `testcase.js` contains the JavaScript test case that was added to `test-bytecode-generator.cc` and `testname` is the name of the test defined in `test-bytecode-generator.cc`.