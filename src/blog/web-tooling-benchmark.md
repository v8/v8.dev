---
title: 'Announcing the Web Tooling Benchmark'
author: 'Benedikt Meurer ([@bmeurer](https://twitter.com/bmeurer)), JavaScript Performance Juggler'
avatars:
  - 'benedikt-meurer'
date: 2017-11-06 13:33:37
tags:
  - benchmarks
  - Node.js
tweet: '927572065598824448'
---
JavaScript performance has always been important to the V8 team, and in this post we would like to discuss a new JavaScript [Web Tooling Benchmark](https://v8.github.io/web-tooling-benchmark) that we have been using recently to identify and fix some performance bottlenecks in V8. You may already be aware of V8’s [strong commitment to Node.js](/blog/v8-nodejs) and this benchmark extends that commitment by specifically running performance tests based on common developer tools built upon Node.js. The tools in the Web Tooling Benchmark are the same ones used by developers and designers today to build modern web sites and cloud-based applications. In continuation of our ongoing efforts to focus on [real-world performance](/blog/real-world-performance/) rather than artificial benchmarks, we created the benchmark using actual code that developers run every day.

The Web Tooling Benchmark suite was designed from the beginning to cover important [developer tooling use cases](https://github.com/nodejs/benchmarking/blob/master/docs/use_cases.md#web-developer-tooling) for Node.js. Because the V8 team focuses on core JavaScript performance, we built the benchmark in a way that focuses on the JavaScript workloads and excludes measurement of Node.js-specific I/O or external interactions. This makes it possible to run the benchmark in Node.js, in all browsers, and in all major JavaScript engine shells, including `ch` (ChakraCore), `d8` (V8), `jsc` (JavaScriptCore) and `jsshell` (SpiderMonkey). Even though the benchmark is not limited to Node.js, we are excited that the [Node.js benchmarking working group](https://github.com/nodejs/benchmarking) is considering using the tooling benchmark as a standard for Node performance as well ([nodejs/benchmarking#138](https://github.com/nodejs/benchmarking/issues/138)).

The individual tests in the tooling benchmark cover a variety of tools that developers commonly use to build JavaScript-based applications, for example:

- The [Babel](https://github.com/babel/babel) transpiler using the `es2015` preset.
- The parser used by Babel — named [Babylon](https://github.com/babel/babylon) — running on several popular inputs (including the [lodash](https://lodash.com/) and [Preact](https://github.com/developit/preact) bundles).
- The [acorn](https://github.com/ternjs/acorn) parser used by [webpack](http://webpack.js.org/).
- The [TypeScript](http://www.typescriptlang.org/) compiler running on the [typescript-angular](https://github.com/tastejs/todomvc/tree/master/examples/typescript-angular) example project from the [TodoMVC](https://github.com/tastejs/todomvc) project.

See the [in-depth analysis](https://github.com/v8/web-tooling-benchmark/blob/master/docs/in-depth.md) for details on all the included tests.

Based on past experience with other benchmarks like [Speedometer](http://browserbench.org/Speedometer), where tests quickly become outdated as new versions of frameworks become available, we made sure it is straight-forward to update each of the tools in the benchmarks to more recent versions as they are released. By basing the benchmark suite on npm infrastructure, we can easily update it to ensure that it is always testing the state of the art in JavaScript development tools. Updating a test case is just a matter of bumping the version in the `package.json` manifest.

We created a [tracking bug](http://crbug.com/v8/6936) and a [spreadsheet](https://docs.google.com/spreadsheets/d/14XseWDyiJyxY8_wXkQpc7QCKRgMrUbD65sMaNvAdwXw) to contain all the relevant information that we have collected about V8’s performance on the new benchmark up to this point. Our investigations have already yielded some interesting results. For example, we discovered that V8 was often hitting the slow path for `instanceof` ([v8:6971](http://crbug.com/v8/6971)), incurring a 3–4× slowdown. We also found and fixed performance bottlenecks in certain cases of property assignments of the form of `obj[name] = val` where `obj` was created via `Object.create(null)`. In these cases, V8 would fall off the fast-path despite being able to utilize the fact that `obj` has a `null` prototype ([v8:6985](http://crbug.com/v8/6985)). These and other discoveries made with the help of this benchmark improve V8, not only in Node.js, but also in Chrome.

We not only looked into making V8 faster, but also fixed and upstreamed performance bugs in the benchmark’s tools and libraries whenever we found them. For example, we discovered a number of performance bugs in [Babel](https://github.com/babel/babel) where code patterns like

```js
value = items[items.length - 1];
```

lead to accesses of the property `"-1"`, because the code didn’t check whether `items` is empty beforehand. This code pattern causes V8 to go through a slow-path due to the `"-1"` lookup, even though a slightly modified, equivalent version of the JavaScript is much faster. We helped to fix these issues in Babel ([babel/babel#6582](https://github.com/babel/babel/pull/6582), [babel/babel#6581](https://github.com/babel/babel/pull/6581) and [babel/babel#6580](https://github.com/babel/babel/pull/6580)). We also discovered and fixed a bug where Babel would access beyond the length of a string ([babel/babel#6589](https://github.com/babel/babel/pull/6589)), which triggered another slow-path in V8. Additionally we [optimized out-of-bounds reads of arrays and strings](https://twitter.com/bmeurer/status/926357262318305280) in V8. We’re looking forward to continue [working with the community](https://twitter.com/rauchg/status/924349334346276864) on improving the performance of this important use case, not only when run on top of V8, but also when run on other JavaScript engines like ChakraCore.

Our strong focus on real-world performance and especially on improving popular Node.js workloads is shown by the constant improvements in V8’s score on the benchmark over the last couple of releases:

<figure>
  <img src="/_img/web-tooling-benchmark/chart.png" intrinsicsize="1198x738" alt="">
</figure>

Since V8 v5.8, which is the last V8 release before [switching to the Ignition+TurboFan architecture](/blog/launching-ignition-and-turbofan), V8’s score on the tooling benchmark has improved by around **60%**.

Over the last several years, the V8 team has come to recognize that no one JavaScript benchmark — even a well-intentioned, carefully crafted one — should be used as a single proxy for a JavaScript engine’s overall performance. However, we do believe that the new **Web Tooling Benchmark** highlights areas of JavaScript performance that are worth focusing on. Despite the name and the initial motivation, we have found that the Web Tooling Benchmark suite is not only representative of tooling workloads, but is representative of a large range of more sophisticated JavaScript applications that are not tested well by front end-focused benchmarks like Speedometer. It is by no means a replacement for Speedometer, but rather a complementary set of tests.

The best news of all is that given how the Web Tooling Benchmark is constructed around real workloads, we expect that our recent improvements in benchmark scores will translate directly into improved developer productivity through [less time waiting for things to build](https://xkcd.com/303/). Many of these improvements are already available in Node.js: at the time of writing, Node 8 LTS is at V8 v6.1 and Node 9 is at V8 v6.2.

The latest version of the benchmark is hosted at [https://v8.github.io/web-tooling-benchmark/](https://v8.github.io/web-tooling-benchmark/).
