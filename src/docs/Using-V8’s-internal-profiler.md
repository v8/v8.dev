Today's highly optimized virtual machines can run web apps at blazing speed. But one shouldn't rely only on them to achieve great performances: a carefully optimized algorithm or a less expensive function can often reach many-fold speed improvements on all browsers. [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools/)' [CPU Profiler](https://developers.google.com/web/tools/chrome-devtools/profile/?hl=en) helps you analyze your code bottlenecks. But sometimes, you need to go deeper and more granular: this is where V8's internal [profiler](V8 Profiler) comes in handy.

Let’s use that profiler to examine the [Mandelbrot explorer demo](http://ie.microsoft.com/testdrive/performance/mandelbrotexplorer/) that Microsoft [released](http://blogs.msdn.com/b/ie/archive/2012/11/13/ie10-fast-fluid-perfect-for-touch-and-available-now-for-windows-7.aspx) together with IE10. After the demo release, V8 has fixed a bug that slowed down the computation unnecessarily (hence the poor performance of Chrome in the demo’s blog post) and further optimized the engine, implementing a faster exp() approximation than what the standard system libraries provide. Following these changes, **the demo ran 8x faster than previously measured** in Chrome.

But what if you want the code to run faster on all browsers? You should first **understand what keeps your CPU busy**. Run Chrome (Windows and Linux [Canary](https://tools.google.com/dlpage/chromesxs)) with the following command line switches, which will cause it to output profiler tick information (in the `v8.log` file) for the URL you specify, which in our case was a local version of the Mandelbrot demo without web workers:

```
$ ./chrome --js-flags=”--prof” --no-sandbox http://localhost:8080/index.html
```

When preparing the test case, make sure it begins its work immediately upon load, and simply close Chrome when the computation is done (hit Alt+F4), so that you only have the ticks you care about in the log file. Also note that web workers aren’t yet profiled correctly with this technique.

Then, process the `v8.log` file with the tick-processor script that ships with V8 (or the new practical web version):

```
$ v8/tools/linux-tick-processor v8.log
```

Here’s an interesting snippet of the processed output that should catch your attention:

```
Statistical profiling result from null, (14306 ticks, 0 unaccounted, 0 excluded).
 [Shared libraries]:
   ticks  total  nonlib   name
   6326   44.2%    0.0%  /lib/x86_64-linux-gnu/libm-2.15.so
   3258   22.8%    0.0%  /.../chrome/src/out/Release/lib/libv8.so
   1411    9.9%    0.0%  /lib/x86_64-linux-gnu/libpthread-2.15.so
     27    0.2%    0.0%  /.../chrome/src/out/Release/lib/libwebkit.so
```

The top section shows that V8 is spending more time inside an OS-specific system library than in its own code. Let’s look at what’s responsible for it by examining the “bottom up” output section, where you can read indented lines as "was called by" (and lines starting with a * mean that the function has been optimized by Crankshaft):

```
[Bottom up (heavy) profile]:
  Note: percentage shows a share of a particular caller in the total
  amount of its parent calls.
  Callers occupying less than 2.0% are not shown.

   ticks parent  name
   6326   44.2%  /lib/x86_64-linux-gnu/libm-2.15.so
   6325  100.0%    LazyCompile: *exp native math.js:91
   6314   99.8%      LazyCompile: *calculateMandelbrot http://localhost:8080/Demo.js:215
```

More than **44% of the total time is spent executing the exp() function inside a system library**! Adding some overhead for calling system libraries, that means about two thirds of the overall time are spent evaluating Math.exp().

If you look at the JavaScript code, you’ll see that exp() is used solely to produce a smooth grayscale palette. There are countless ways to produce a smooth grayscale palette, but let’s suppose you really really like exponential gradients. Here is where algorithmic optimization comes into play.

You’ll notice that exp() is called with an argument in the range -4 < x < 0, so we can safely replace it with its Taylor approximation for that range, which will deliver the same smooth gradient with only a multiplication and a couple of divisions:

```
exp(x) ≈ 1 / ( 1 - x + x*x / 2) for -4 < x < 0 
```

Tweaking the algorithm this way boosts the performance by an extra 30% compared to latest Canary and 5x to the system library based Math.exp() on Chrome Canary.

![](images/mandelbrot_chrome_speed.png)

This example shows how V8’s internal profiler can help you go deeper into understanding your code bottlenecks, and that a smarter algorithm can push performance even further.

To compare VM performances that represents today’s complex and demanding web applications, one might also want to consider a more comprehensive set of benchmarks such as the [Octane Javascript Benchmark Suite](http://chromium.github.io/octane/).