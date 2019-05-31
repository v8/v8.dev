---
title: 'Code caching for WebAssembly developers'
author: '[Bill Budge](https://twitter.com/billb), putting the Ca-ching! in caching'
avatars:
  - bill budge
date: 2019-04-18 13:33:37
tags:
  - internals
tweet: '1115264282675953664'
---
There's a saying that the fastest code is code that doesn't run. Likewise, the fastest compiling code is code that doesn't have to be compiled. WebAssembly compiled module caching is a new optimization in Chrome and V8 that can reduce the start-up time of WebAssembly modules by caching native code produced by the compiler . We’ve [written](/blog/code-caching) [about](/blog/improved-code-caching) [how](/blog/code-caching-for-devs) Chrome and V8 cache compiled Javascript in the past, and best practices for taking advantage of this optimization. In this blog post, we will describe the operation of Chrome's WebAssembly cache and how developers can take advantage of it to speed startup for applications with large WebAssembly modules.

## WebAssembly Compilation recap

WebAssembly provides a way to run non-Javascript code on the Web. `.wasm` resources contain partially compiled code from other languages, such as C, C++, Rust, with more to come. The WASM compiler's job is to decode the `.wasm` resource, validate that it is well-formed, and then compile it to native code that can be directly executed by hardware.

V8 has two compilers for WebAssembly, Liftoff and Turbofan. [Liftoff](/blog/liftoff) is our baseline compiler, which compiles the `.wasm` resource as quickly as possible so execution can begin. Turbofan is V8's optimizing compiler. It runs in the background to generate high quality native code. For large WASM modules, Turbofan can take significant amounts of time - 30 seconds to a minute or more - to completely finish compiling the WASM module to native code.

That's where code caching comes in. Once Turbofan has finished compiling a large WASM module, Chrome can save the code in its cache so that the next time the module is created, we can skip the compilation step, leading to even faster  startup, not to mention reduced power consumption. Compiling code is very CPU-intensive.

WASM module caching leverages the machinery in Chrome for Javascript code caching. We use the same type of cache, and the same double-keyed caching technique to keep code compiled by different origins separate in accordance with [site-isolation](https://developers.google.com/web/updates/2018/07/site-isolation), an important Chrome security feature.

## WebAssembly Caching algorithm

For now, WASM caching is only implemented for the streaming API calls, compileStreaming and instantiateStreaming. These require a fetch of the  `.wasm` resource, which uses Chrome's resource fetching and caching mechanisms, and provides a handy resource URL to use as the key to identify the WASM module. The caching algorithm works as follows:

1. When a `.wasm` resource is first requested (i.e. a _cold run_), Chrome downloads it from the network and streams it to V8 to compile. Chrome  also stores the `.wasm` resource in the browser’s resource cache, which is kept in persistent storage on the device. For our purposes, we'll just call this storage a `disk cache`.
2. When Turbofan has completely finished compiling the module, and if the `.wasm` resource is large enough (currently 128 kilobytes), Chrome will serialize the compiled native code and send the bytes to the browser process to be written to the browser's code cache. This is separate from the resource cache.
3. When the same `.wasm` resource is requested a second time (i.e. a _hot run_), Chrome loads the `.wasm` file from the browser's resource cache and simultaneously queries the code cache. If there is a cache 'hit', then the compiled module bytes are sent to the renderer process and passed to V8 which deserializes the code instead of compiling the module. Deserializing is faster and less work than compiling.
4. It may be that the cached code is no longer valid. This can happen because the  `.wasm` resource has been updated, or because V8 has changed, something that is expected to happen at least every 6 weeks because of Chrome's rapid release cycle. In this case the cached native code will be cleared from the cache, and compilation will proceed from Step 1.

Based on this description, we can give some recommendations for improving your website’s use of the WASM code cache.

## Tip 1: Use the WebAssembly streaming API

Since code caching only works with the streaming API, compile or instantiate your WASM Module with one of these calls:
```js
Promise<WebAssembly.Module> WebAssembly.compileStreaming(source);

Promise<ResultObject> WebAssembly.instantiateStreaming(source, imports);
```
## Tip 2: Be Cache-Friendly

Since code caching depends on the resource URL and whether the `.wasm` resource is up-to-date, developers should try to keep those both stable. If the `.wasm` resource is fetched from a different URL, it is considered different and V8 will have to compile the module again. Similarly, if the `.wasm` resource is no longer valid in the resource cache, then Chrome has to throw away any cached code.  

### Don’t change your code

Whenever you ship a new `.wasm` module, it must be completely recompiled. When the browser makes an HTTP request for a resource URL, it includes the date and time of the last fetch of that URL, and if the server knows that the file hasn’t changed, it can send back a 304 Not Modified response, making the code cache valid. Otherwise, a 200 OK response updates the cached `.wasm` resource, and invalidates the code cache, reverting it back to a cold run. Follow web resource [best practices](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching) by using response headers to inform the browser about whether the `.wasm` resource is cacheable, how long it's expected to be valid, or when it was last modified.

### Don’t change your code's URL

Cached compiled code is associated with the URL of the `.wasm` resource, as that makes it easy to look up without having to read the actual resource. This means that changing the URL of a resource (including any query parameters!) creates a new resource entry in our resource cache, and with it a new code cache entry.

### Go big (but not too big!)

The principal heuristic of WASM code caching is the size of the `.wasm` resource. If the `.wasm` resource is smaller than a certain threshold size, we don't cache the compiled module bytes. The reasoning here is that V8 can compile small modules quickly, maybe faster than a round trip to the browser process to read from disk, so we skip the caching steps. At the moment, the  cutoff is for `.wasm` resources of 128 K bytes or more. 
But bigger is better only up to a point. Because caches take up space on the user's machine, Chrome is careful not to consume too much space. Right now, on desktop machines, the code caches typically hold a few hundred megabytes of data. Since the Chrome disk caches also restrict the largest entries in the cache to some fraction of the total cache size, there is a practical limit of about 150 megabytes for the compiled WASM code. It is important to note that compiled modules are often 5-7 times larger than the `.wasm` resource on a typical desktop machine.

The size heuristic, like the rest of the caching behavior, may change as we determine what works best for users and developers.

### Use ServiceWorker

WASM code caching is enabled for Workers and ServiceWorkers, so it's possible to use this to load, compile, and cache code so it's available when your app starts. 

## Tracing

As a developer, you might want to check that your compiled module is being cached by Chrome. Unfortunately, WASM code caching information is not currently exposed in DevTools, so the best way to find out whether your modules are cached is to use the slightly lower-level `chrome://tracing` feature.

`chrome://tracing` records instrumented traces of Chrome during some period of time. Tracing records the behavior of the entire browser, including other tabs, windows, and extensions, so it works best when done in a clean user profile, with no extensions installed, and with no other browser tabs open:

```bash
# Start a new Chrome browser session with a clean user profile
google-chrome --user-data-dir="$(mktemp -d)"
```
Navigate to `chrome://tracing` and click 'Record' to begin a tracing session. On the dialog window that appears, click 'Edit Categories' and check the `devtools.timeline` category (you can un-check any other preselected categories to reduce the amount of data collected). Then click the 'Record' button on the dialog to begin the trace.

In another tab load or reload your app. Let it run long enough, 10 seconds or more, to make sure Turbofan compilation completes. When done, click 'Stop' to end the trace. A timeline view of events appears. At the top right of the tracing window, there is a text box, just to the right of 'View Options'. Type `v8.wasm` to filter events. You should see one or more of the following events:

`v8.wasm.streamFromResponseCallback` - this means that the resource fetch passed to instantiateStreaming received a response.

`v8.wasm.compiledModule` - Turbofan finished compiling the `.wasm` resource.

`v8.wasm.cachedModule` - Chrome sent the compiled module to the browser process, to be written to the code cache.

`v8.wasm.moduleCacheHit` - Chrome found the code in its cache while loading the `.wasm` resource.

`v8.wasm.moduleCacheInvalid` - V8 wasn't able to deserialize the cached code because it's out of date.

When everything is working correctly, a hot run will produce two events, `v8.wasm.streamFromResponseCallback` and `v8.wasm.moduleCacheHit`. Metadata on these events allows you to see the size of the compiled code as well.

## Conclusion

For most developers, code caching should “just work”. It works best, like any cache, when things stay unchanged, and works on heuristics which can change between versions. Nevertheless, code caching does have behaviors that can be used, and limitations which can be avoided, and careful analysis using `chrome://tracing` can help you tweak and optimize the use of caches by your web app.
