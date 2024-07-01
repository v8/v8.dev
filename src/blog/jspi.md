---
title: 'Introducing the WebAssembly JavaScript Promise Integration API'
description: 'This document introduces JSPI and provides some simple examples to get you started in using it'
author: 'Francis McCabe, Thibaud Michaud, Ilya Rezvov, Brendan Dahl'
date: 2024-07-01
tags:
  - WebAssembly
---
The JavaScript Promise Integration (JSPI) API allows WebAssembly applications that were written assuming _synchronous_ access to external functionality to operate smoothly in an environment where the functionality is actually _asynchronous_.

This note outlines what the core capabilities of the JSPI API are, how to access it, how to develop software for it and offers some examples to try out.

## What is ‘JSPI’ for?

Asynchronous APIs operate by separating the _initiation_ of the operation from its _resolution_; with the latter coming some time after the first. Most importantly, the application continues execution after kicking off the operation; and is then notified when the operation completes.

For example, using the `fetch` API, Web applications can access the contents associated with a URL; however, the `fetch` function does not directly return the results of the fetch; instead it returns a `Promise` object. The connection between the fetch response and the original request is reestablished by attaching a _callback_ to that `Promise` object. The callback function can inspect the response and collect the data (if it is there of course).

In many cases C/C++ (and many other languages) applications are originally written against a _synchronous_ API. For example, the Posix `read` function does not complete until the I/O operation is complete: the `read` function *blocks* until the read is complete.

However, it is not permitted to block the browser’s main thread; and many environments are not supportive of synchronous programming. The result is a mismatch between the desires of the application programmer for a simple to use API and the wider ecosystem that requires I/O to be crafted with asynchronous code. This is especially a problem for existing legacy applications that would be expensive to port.

The JSPI is an API that bridges the gap between synchronous applications and asynchronous Web APIs. It works by intercepting `Promise` objects returned by asynchronous Web API functions and _suspending_ the WebAssembly application. When the asynchronous I/O operation is completed, the WebAssembly application is _resumed_. This allows the WebAssembly application to use straight-line code to perform asynchronous operations and to process their results.

Crucially, using JSPI requires very few changes to the WebAssembly application itself.

### How does JSPI work?

The JSPI works by intercepting the `Promise` object returned from  calls to JavaScript and suspending the main logic of the WebAssembly application. A callback is attached to this `Promise` object which will resume the suspended WebAssembly code when invoked by the browser's event loop task runner.

In addition, the WebAssembly export is refactored to return a `Promise` object &mdash; instead of the original returned value from the export. This `Promise` object becomes the value returned by the WebAssembly application: when the WebAssembly code is suspended,[^first] the export `Promise` object is returned as the value of the call into WebAssembly.

[^first]: If a WebAssembly application is suspended more than once, subsequent suspensions will return to the browser's event loop and will not be directly visible to the web application.

The export Promise is resolved when the original call completes: if the original WebAssembly function returns a normal value the export `Promise` object is resolved with that value (converted to a JavaScript object); if an exception is thrown then the export `Promise` object is rejected.

#### Wrapping imports and exports

This is enabled by _wrapping_ imports and exports during the WebAssembly module instantiation phase. The function wrappers add the suspending behavior to the normal asynchronous imports and route suspensions to `Promise` object callbacks.

It is not necessary to wrap all the exports and imports of a WebAssembly module. Some exports whose execution paths don’t involve calling asynchronous APIs are better left unwrapped. Similarly, not all of a WebAssembly module’s imports are to asynchronous API functions; those imports too should not be wrapped.

Of course, there is a significant amount of internal mechanisms that allow this to happen;[^1] but neither the JavaScript language nor WebAssembly itself are changed by the JSPI. Its operations are confined to the boundary between JavaScript and WebAssembly.

From the perspective of a Web application developer, the result is a body of code that participates in the JavaScript world of async functions and Promises in an analogous way that other async functions written in JavaScript work. From the perspective of the WebAssembly developer, this allows them to craft applications using synchronous APIs and yet participate in the Web’s asynchronous ecosystem.

### Expected performance

Because the mechanisms used when suspending and resuming WebAssembly modules are essentially constant time, we don’t anticipate high costs in using JSPI &mdash; especially compared to other transformation based approaches.

There is a constant amount of work needed to propagate the `Promise` object returned by the asynchronous API call to the WebAssembly. Similarly, when a Promise is resolved, the WebAssembly application can be resumed with constant-time overhead.

However, as with other Promise-style APIs in the browser, any time the WebAssembly application suspends it will not be ‘woken up’ again except by the browser’s task runner. This requires that the execution of the JavaScript code that started the WebAssembly computation itself returns to the browser.

### Can I use JSPI to suspend JavaScript programs?

JavaScript already has a well developed mechanism for representing asynchronous computations: the `Promise` object and the `async` function notation. The JSPI is designed to integrate well with this but not to replace it.

### How can I use JSPI today?

The JSPI is currently being standardized by the W3C WebAssembly WG. As of this writing, it is phase 3 of the standards process and we anticipate full standardization before the end of 2024.

JSPI is available for Chrome on Linux, MacOS, Windows and ChromeOS, on Intel and Arm platforms, both 64 bit and 32 bit.[^firefox]

[^firefox]: JSPI is also available in Firefox nightly: turn on "`javascript.options.wasm_js_promise_integration`" in the about:config panel &mdash; and restart.

JSPI can be used in two ways today: via an [origin trial](https://developer.chrome.com/origintrials/#/register_trial/1603844417297317889) and locally via a Chrome flag. To test it locally, go to `chrome://flags` in Chrome, search for “Experimental WebAssembly JavaScript Promise Integration (JSPI)” and check the box. Relaunch as suggested for it to take effect.

You should use at least version `126.0.6478.26` to get the latest version of the API. We recommend using the Dev channel to ensure that any stability updates are applied. In addition, if you wish to use Emscripten to generate WebAssembly (which we recommend), you should use a version that is at least `3.1.61`.

Once enabled, you should be able to run scripts that use JSPI. Below we show how you can use Emscripten to generate a WebAssembly module in C/C++ that uses JSPI. If your application involves a different language, not using Emscripten for example, then we suggest that you look at how the API works you should look at the [proposal](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md).

#### Limitations

The Chrome implementation of JSPI already supports typical use cases. However it is still considered to be experimental so there are a few limitations to be aware of:

- Requires the use of a command line flag, or participation in the origin trial.
- Each call to a JSPI export runs on a fixed size stack.
- Debugging support is somewhat minimal. In particular, it may be difficult to see the different events happening in the Dev tools panel. Providing a richer support for debugging JSPI applications is on the roadmap.

## A small demo

To see all this working, let’s try a simple example. This C program computes Fibonacci in a spectacularly bad way: by asking JavaScript to do the addition, even worse by using JavaScript `Promise` objects to do it:[^2]

```c
long promiseFib(long x) {
 if (x == 0)
   return 0;
 if (x == 1)
   return 1;
 return promiseAdd(promiseFib(x - 1), promiseFib(x - 2));
}
// promise an addition
EM_ASYNC_JS(long, promiseAdd, (long x, long y), {
  return Promise.resolve(x+y);
});
```

The `promiseFib` function itself is a straightforward recursive version of the Fibonacci function. The intriguing part (from our point of view) is the definition of `promiseAdd` which does the addition of the two Fibonacci halves — using JSPI!.

We use the `EM_ASYNC_JS` Emscripten macro to write down the `promiseFib` function as a JavaScript function within the body of our C program. Since addition does not normally involve Promises in JavaScript, we have to force it by constructing a `Promise`.

The `EM_ASYNC_JS` macro generates all the necessary glue code so that we can use JSPI to access the Promise’s result as though it were a normal function.

To compile our small demo, we use Emscripten’s `emcc` compiler:[^4]

```sh
emcc -O3 badfib.c -o b.html -s JSPI
```

This compiles our program, creating a loadable HTML file (`b.html`). The most special command line option here is `-s JSPI`. This invokes the option to generate code that uses JSPI to interface with JavaScript imports that return Promises.

If you load the generated `b.html` file into Chrome, then you should see output that approximates to:

```
fib(0) 0μs 0μs 0μs
fib(1) 0μs 0μs 0μs
fib(2) 0μs 0μs 3μs
fib(3) 0μs 0μs 4μs
…
fib(15) 0μs 13μs 1225μs
```

This is simply a list of the first 15 Fibonacci numbers followed by the average time in microseconds it took to compute a single Fibonacci number. The three time values on each line refer to the time taken for a pure WebAssembly computation, for a mixed JavaScript/WebAssembly computation and the third number gives the time for a suspending version of the computation.

Note that `fib(2)` is the smallest calculation that involves accessing a Promise, and, by the time `fib(15)` is computed, approximately 1000 calls to `promiseAdd` have been made. This suggests that the actual cost of a JSPI’d function is approximately 1μs — significantly higher than just adding two integers but much smaller than the milliseconds typically required for accessing an external I/O function.

## Using JSPI to load code lazily

In this next example we are going to look at what may be a somewhat surprising use of JSPI: dynamically loading code. The idea is to `fetch` a module that contains needed code, but to delay that until the needed function is first called.

We need to use JSPI because APIs like `fetch` are inherently asynchronous in nature, but we want to be able to invoke them from arbitrary places in our application—in particular, from the middle of a call to a function that does not yet exist.

The core idea is to replace a dynamically loaded function with a stub; this stub first of all loads the missing function code, replaces itself by the loaded code, and then calls the newly loaded code with the original arguments. Any subsequent call to the function goes directly to the loaded function. This strategy allows for an essentially transparent approach to dynamically loading code.

The module we are going to load is fairly simple, it contains a function that returns `42`:

```c
// This is a simple provider of forty-two
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE long provide42(){
  return 42l;
}
```

which is in a file called `p42.c`, and is compiled using Emscripten without building any ‘extras’:

```sh
emcc p42.c -o p42.wasm --no-entry -Wl,--import-memory
```

The `EMSCRIPTEN_KEEPALIVE` prefix is an Emscripten macro that makes sure that the function `provide42` is not eliminated even though it is not used within the code. This results in a WebAssembly module that contains the function that we want to load dynamically.

The `-Wl,--import-memory` flag that we added to the build of `p42.c` is to ensure that it has access to the same memory that the main module has.[^3]

In order to dynamically load code, we use the standard `WebAssembly.instantiateStreaming` API:

```js
WebAssembly.instantiateStreaming(fetch('p42.wasm'));
```

This expression uses `fetch` to locate the compiled Wasm module, `WebAssembly.instantiateStreaming` to compile the result of the fetch and to create an instantiated module from it. Both `fetch` and `WebAssembly.instantiateStreaming` return Promises; so we cannot simply access the result and extract our needed function. Instead we wrap this into an JSPI-style import using the `EM_ASYNC_JS` macro:

```c
EM_ASYNC_JS(fooFun, resolveFun, (), {
  console.log('loading promise42');
  LoadedModule = (await WebAssembly.instantiateStreaming(fetch('p42.wasm'))).instance;
  return addFunction(LoadedModule.exports['provide42']);
});
```

Notice the `console.log` call, we will use it to make sure that our logic is correct.

The `addFunction` is part of the Emscripten API, but to make sure that it is available for us at run-time, we have to inform `emcc` that it is a required dependency. We do that in the following line:

```c
EM_JS_DEPS(funDeps, "$addFunction")
```

In a situation where we want to dynamically load code, we would like to make sure that we don’t load code unnecessarily; in this case, we would like to make sure that subsequent calls to `provide42` will not trigger reloads. C has a simple feature that we can use for this: we don’t call `provide42` directly, but do so via a trampoline that will cause the function to be loaded, and then, just before actually invoking the function, change the trampoline to bypass itself. We can do this using an appropriate function pointer:

```c
extern fooFun get42;

long stub(){
  get42 = resolveFun();
  return get42();
}

fooFun get42 = stub;
```

From the perspective of the rest of the program, the function that we want to call is called `get42`. Its initial implementation is via `stub`, which calls `resolveFun` to actually load the function. After the successful load, we change get42 to point to the newly loaded function – and call it.

Our main function calls `get42` twice:[^6]

```c
int main() {
  printf("first call p42() = %ld\n", get42());
  printf("second call = %ld\n", get42());
}
```

The result of running this in the browser is a log that looks like:

```
loading promise42
first call p42() = 42
second call = 42
```

Notice that the line `loading promise42` only appears once, whereas `get42` is actually called twice.

This example demonstrates that JSPI can be used in some unexpected ways: loading code dynamically seems a long way from creating promises. Moreover, there are other ways of dynamically linking WebAssembly modules together; this is not intended to represent the definitive solution to that problem.

We are definitely looking forward to seeing what you can do with this new capability! Join the discussion at the W3C WebAssembly Community Group [repo](https://github.com/WebAssembly/js-promise-integration).

## Appendix A: Complete Listing of `badfib`


```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <emscripten.h>

typedef long (testFun)(long, int);

#define microSeconds (1000000)

long add(long x, long y) {
  return x + y;
}

// Ask JS to do the addition
EM_JS(long, jsAdd, (long x, long y), {
  return x + y;
});

// promise an addition
EM_ASYNC_JS(long, promiseAdd, (long x, long y), {
  return Promise.resolve(x+y);
});

__attribute__((noinline))
long localFib(long x) {
 if (x==0)
   return 0;
 if (x==1)
   return 1;
 return add(localFib(x - 1), localFib(x - 2));
}

__attribute__((noinline))
long jsFib(long x) {
  if (x==0)
    return 0;
  if (x==1)
    return 1;
  return jsAdd(jsFib(x - 1), jsFib(x - 2));
}

__attribute__((noinline))
long promiseFib(long x) {
  if (x==0)
    return 0;
  if (x==1)
    return 1;
  return promiseAdd(promiseFib(x - 1), promiseFib(x - 2));
}

long runLocal(long x, int count) {
  long temp = 0;
  for(int ix = 0; ix < count; ix++)
    temp += localFib(x);
  return temp / count;
}

long runJs(long x,int count) {
  long temp = 0;
  for(int ix = 0; ix < count; ix++)
    temp += jsFib(x);
  return temp / count;
}

long runPromise(long x, int count) {
  long temp = 0;
  for(int ix = 0; ix < count; ix++)
    temp += promiseFib(x);
  return temp / count;
}

double runTest(testFun test, int limit, int count){
  clock_t start = clock();
  test(limit, count);
  clock_t stop = clock();
  return ((double)(stop - start)) / CLOCKS_PER_SEC;
}

void runTestSequence(int step, int limit, int count) {
  for (int ix = 0; ix <= limit; ix += step){
    double light = (runTest(runLocal, ix, count) / count) * microSeconds;
    double jsTime = (runTest(runJs, ix, count) / count) * microSeconds;
    double promiseTime = (runTest(runPromise, ix, count) / count) * microSeconds;
    printf("fib(%d) %gμs %gμs %gμs %gμs\n",ix, light, jsTime, promiseTime, (promiseTime - jsTime));
  }
}

EMSCRIPTEN_KEEPALIVE int main() {
  int step =  1;
  int limit = 15;
  int count = 1000;
  runTestSequence(step, limit, count);
  return 0;
}
```

## Appendix B: Listing of `u42.c` and `p42.c`

The `u42.c` C code represents the main part of our dynamic loading example:

```c
#include <stdio.h>
#include <emscripten.h>

typedef long (*fooFun)();

// promise a function
EM_ASYNC_JS(fooFun, resolveFun, (), {
  console.log('loading promise42');
  LoadedModule = (await WebAssembly.instantiateStreaming(fetch('p42.wasm'))).instance;
  return addFunction(LoadedModule.exports['provide42']);
});

EM_JS_DEPS(funDeps, "$addFunction")

extern fooFun get42;

long stub() {
  get42 = resolveFun();
  return get42();
}

fooFun get42 = stub;

int main() {
  printf("first call p42() = %ld\n", get42());
  printf("second call = %ld\n", get42());
}
```

The `p42.c` code is the dynamically loaded module.

```c
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE long provide42() {
  return 42l;
}
```

<!-- Footnotes themselves at the bottom. -->
## Notes

[^1]: For the technically curious, see [the WebAssembly proposal for JSPI](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md) and [the V8 stack switching design portfolio](https://docs.google.com/document/d/16Us-pyte2-9DECJDfGm5tnUpfngJJOc8jbj54HMqE9Y).

[^2]: Note: we include the complete program below, in Appendix A.

[^3]: We do not need this flag for our specific example, but you would likely need it for anything bigger.

[^4]: Note: you need a version of Emscripten that is ≥ 3.1.61.

[^6]: The complete program is shown in Appendix B.
