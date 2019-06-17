---
title: 'Code caching for WebAssembly developers'
author: '[Bill Budge](https://twitter.com/billb), putting the Ca-ching! in caching'
avatars:
  - bill-budge
date: 2019-06-17
tags:
  - WebAssembly
  - internals
---
There’s a saying among developers that the fastest code is code that doesn’t run. Likewise, the fastest compiling code is code that doesn’t have to be compiled. WebAssembly code caching is a new optimization in Chrome and V8 that tries to avoid code compilation by caching the native code produced by the compiler. We’ve [written](/blog/code-caching) [about](/blog/improved-code-caching) [how](/blog/code-caching-for-devs) Chrome and V8 cache JavaScript code in the past, and best practices for taking advantage of this optimization. In this blog post, we describe the operation of Chrome’s WebAssembly code cache and how developers can take advantage of it to speed up loading for applications with large WebAssembly modules.

## WebAssembly compilation recap { #recap }

WebAssembly is a way to run non-JavaScript code on the Web. A web app can use WebAssembly by loading a `.wasm` resource, which contains partially compiled code from another language, such as C, C++, or Rust (and more to come.) The WebAssembly compiler’s job is to decode the `.wasm` resource, validate that it is well-formed, and then compile it to native machine code that can be executed on the user’s machine.

V8 has two compilers for WebAssembly: Liftoff and TurboFan. [Liftoff](/blog/liftoff) is the baseline compiler, which compiles modules as quickly as possible so execution can begin as soon as possible. TurboFan is V8’s optimizing compiler for both JavaScript and WebAssembly. It runs in the background to generate high-quality native code to give a web app optimal performance over the long term. For large WebAssembly modules, TurboFan can take significant amounts of time — 30 seconds to a minute or more — to completely finish compiling a WebAssembly module to native code.

That’s where code caching comes in. Once TurboFan has finished compiling a large WebAssembly module, Chrome can save the code in its cache so that the next time the module is loaded, we can skip both Liftoff and TurboFan compilation, leading to faster startup and reduced power consumption — compiling code is very CPU-intensive.

WebAssembly code caching uses the same machinery in Chrome that is used for JavaScript code caching. We use the same type of storage, and the same double-keyed caching technique that keeps code compiled by different origins separate in accordance with [site isolation](https://developers.google.com/web/updates/2018/07/site-isolation), an important Chrome security feature.

## WebAssembly code caching algorithm { #algorithm }

For now, WebAssembly caching is only implemented for the streaming API calls, `compileStreaming` and `instantiateStreaming`. These operate on an HTTP fetch of a `.wasm` resource, making it easier to use Chrome’s resource fetching and caching mechanisms, and providing a handy resource URL to use as the key to identify the WebAssembly module. The caching algorithm works as follows:

1. When a `.wasm` resource is first requested (i.e. a _cold run_), Chrome downloads it from the network and streams it to V8 to compile. Chrome also stores the `.wasm` resource in the browser’s resource cache, stored in the file system of the user’s device. This resource cache allows Chrome to load the resource faster the next time it’s needed.
1. When TurboFan has completely finished compiling the module, and if the `.wasm` resource is large enough (currently 128 kB), Chrome writes the compiled code to the WebAssembly code cache. This code cache is physically separate from the resource cache in step 1.
1. When a `.wasm` resource is requested a second time (i.e. a _hot run_), Chrome loads the `.wasm` resource from the resource cache and simultaneously queries the code cache. If there is a cache hit, then the compiled module bytes are sent to the renderer process and passed to V8 which deserializes the code instead of compiling the module. Deserializing is faster and less CPU-intensive than compiling.
1. It may be that the cached code is no longer valid. This can happen because the `.wasm` resource has changed, or because V8 has changed, something that is expected to happen at least every 6 weeks because of Chrome’s rapid release cycle. In this case the cached native code is cleared from the cache, and compilation proceeds as in step 1.

Based on this description, we can give some recommendations for improving your website’s use of the WebAssembly code cache.

## Tip 1: use the WebAssembly streaming API { #stream }

Since code caching only works with the streaming API, compile or instantiate your WebAssembly module with `compileStreaming` or `instantiateStreaming`, as in this JavaScript snippet:

```js
(async () => {
  const fetchPromise = fetch('fibonacci.wasm');
  const module = await WebAssembly.compileStreaming(fetchPromise);
  const instance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

This [article](https://developers.google.com/web/updates/2018/04/loading-wasm) goes into detail about the advantages of using the WebAssembly streaming API. Emscripten tries to use this API by default when it generates loader code for your app. Note that streaming requires that the `.wasm` resource has the correct MIME type, so the server must send the `Content-type: application/wasm` header in its response.

## Tip 2: be cache-friendly { #cache-friendly }

Since code caching depends on the resource URL and whether the `.wasm` resource is up-to-date, developers should try to keep those both stable. If the `.wasm` resource is fetched from a different URL, it is considered different and V8 has to compile the module again. Similarly, if the `.wasm` resource is no longer valid in the resource cache, then Chrome has to throw away any cached code.

### Keep your code stable { #keep-code-stable }

Whenever you ship a new WebAssembly module, it must be completely recompiled. Ship new versions of your code only when necessary to deliver new features or fix bugs. When your code hasn’t changed, let Chrome know. When the browser makes an HTTP request for a resource URL, such as a WebAssembly module, it includes the date and time of the last fetch of that URL. If the server knows that the file hasn’t changed, it can send back a `304 Not Modified` response, which tells Chrome and V8 that the cached resource and therefore the cached code are still valid. On the other hand, returning a `200 OK` response updates the cached `.wasm` resource and invalidates the code cache, reverting WebAssembly back to a cold run. Follow [web resource best practices](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching) by using the response to inform the browser about whether the `.wasm` resource is cacheable, how long it’s expected to be valid, or when it was last modified.

### Don’t change your code’s URL { #url }

Cached compiled code is associated with the URL of the `.wasm` resource, which makes it easy to look up without having to scan the actual resource. This means that changing the URL of a resource (including any query parameters!) creates a new entry in our resource cache, which also requires a complete recompile and creates a new code cache entry.

### Go big (but not too big!) { #go-big }

The principal heuristic of WebAssembly code caching is the size of the `.wasm` resource. If the `.wasm` resource is smaller than a certain threshold size, we don’t cache the compiled module bytes. The reasoning here is that V8 can compile small modules quickly, possibly faster than loading the compiled code from the cache. At the moment, the cutoff is for `.wasm` resources of 128 kB or more.

But bigger is better only up to a point. Because caches take up space on the user’s machine, Chrome is careful not to consume too much space. Right now, on desktop machines, the code caches typically hold a few hundred megabytes of data. Since the Chrome caches also restrict the largest entries in the cache to some fraction of the total cache size, there is a further limit of about 150 MB for the compiled WebAssembly code (half the total cache size). It is important to note that compiled modules are often 5–7 times larger than the corresponding `.wasm` resource on a typical desktop machine.

This size heuristic, like the rest of the caching behavior, may change as we determine what works best for users and developers.

### Use a service worker { #service-worker }

WebAssembly code caching is enabled for workers and service workers, so it’s possible to use them to load, compile, and cache a new version of code so it’s available the next time your app starts. Every web site must perform at least one full compilation of a WebAssembly module — use workers to hide that from your users.

## Tracing

As a developer, you might want to check that your compiled module is being cached by Chrome. WebAssembly code caching events are not exposed by default in Chrome’s Developer Tools, so the best way to find out whether your modules are being cached is to use the slightly lower-level `chrome://tracing` feature.

`chrome://tracing` records instrumented traces of Chrome during some period of time. Tracing records the behavior of the entire browser, including other tabs, windows, and extensions, so it works best when done in a clean user profile, with extensions disabled, and with no other browser tabs open:

```bash
# Start a new Chrome browser session with a clean user profile and extensions disabled
google-chrome --user-data-dir="$(mktemp -d)" --disable-extensions
```

Navigate to `chrome://tracing` and click ‘Record’ to begin a tracing session. On the dialog window that appears, click ‘Edit Categories’ and check the `devtools.timeline` category on the right side under ‘Disabled by Default Categories’ (you can uncheck any other pre-selected categories to reduce the amount of data collected). Then click the ‘Record’ button on the dialog to begin the trace.

In another tab load or reload your app. Let it run long enough, 10 seconds or more, to make sure TurboFan compilation completes. When done, click ‘Stop’ to end the trace. A timeline view of events appears. At the top right of the tracing window, there is a text box, just to the right of ‘View Options’. Type `v8.wasm` to filter out non-WebAssembly events. You should see one or more of the following events:

- `v8.wasm.streamFromResponseCallback` — The resource fetch passed to instantiateStreaming received a response.
- `v8.wasm.compiledModule` — TurboFan finished compiling the `.wasm` resource.
- `v8.wasm.cachedModule` — Chrome wrote the compiled module to the code cache.
- `v8.wasm.moduleCacheHit` — Chrome found the code in its cache while loading the `.wasm` resource.
- `v8.wasm.moduleCacheInvalid` — V8 wasn’t able to deserialize the cached code because it was out of date.

On a cold run, we expect to see `v8.wasm.streamFromResponseCallback` and `v8.wasm.compiledModule` events. This indicates that the WebAssembly module was received, and compilation succeeded. If neither event is observed, check that your WebAssembly streaming API calls are working correctly.

After a cold run, if the size threshold was exceeded, we also expect to see a `v8.wasm.cachedModule` event, meaning that the compiled code was sent to the cache. It is possible that we get this event but that the write doesn’t succeed for some reason. There is currently no way to observe this, but metadata on the events can show the size of the code. Very large modules may not fit in the cache.

When caching is working correctly, a hot run will produce two events, `v8.wasm.streamFromResponseCallback` and `v8.wasm.moduleCacheHit`. The metadata on these events allow you to see the size of the compiled code.

For more on using `chrome://tracing`, see [our article on JavaScript (byte)code caching for developers](/blog/code-caching-for-devs).

## Conclusion

For most developers, code caching should “just work”. It works best, like any cache, when things are stable. Chrome’s caching heuristics may change between versions, but code caching does have behaviors that can be used, and limitations which can be avoided. Careful analysis using `chrome://tracing` can help you tweak and optimize the use of the WebAssembly code cache by your web app.
