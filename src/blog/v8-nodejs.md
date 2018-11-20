---
title: 'V8 ❤️ Node.js'
author: 'Franziska Hinkelmann, Node Monkey Patcher'
date: 2016-12-15 13:33:37
tags:
  - Node.js
---
_Node's popularity has been growing steadily over the last few years, and we have been working to make Node better. This blog post highlights some of the recent efforts in V8 and DevTools._

## Debug Node.js in DevTools

You can now [debug Node applications using the Chrome developer tools](https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27#.knjnbsp6t). The Chrome DevTools Team moved the source code that implements the debugging protocol from Chromium to V8, thereby making it easier for Node Core to stay up to date with the debugger sources and dependencies. Other browser vendors and IDEs use the Chrome debugging protocol as well, collectively improving the developer experience when working with Node.

## ES6 speed-ups

We are working hard on making V8 faster than ever. [A lot of our recent performance work centers around ES6 features](/blog/v8-release-56), including promises, generators, destructors, and rest/spread operators. Because the versions of V8 in Node 6.2 and onwards fully support ES6, Node developers can use new language features "natively", without polyfills. This means that Node developers are often the first to benefit from ES6 performance improvements. Similarly, they are often the first to recognize performance regressions. Thanks to an attentive Node community, we discovered and fixed a number of regressions, including performance issues with [`instanceof`](https://github.com/nodejs/node/issues/9634), [`buffer.length`](https://github.com/nodejs/node/issues/9006), [long argument lists](https://github.com/nodejs/node/pull/9643), and [`let`/`const`](https://github.com/nodejs/node/issues/9729).

## Fixes for Node.js `vm` module and REPL coming

The [`vm` module](https://nodejs.org/dist/latest-v7.x/docs/api/vm.html) has had [some long-standing limitations](https://github.com/nodejs/node/issues/6283). In order to address these issues properly, we have extended the V8 API to implement more intuitive behavior. We are excited to announce that the vm module improvements are one of the projects we’re supporting as mentors in [Outreachy for the Node Foundation](https://nodejs.org/en/foundation/outreachy/). We hope to see additional progress on this project and others in the near future.

## `async`/`await`

With async functions, you can drastically simplify asynchronous code by rewriting program flow by awaiting promises sequentially. `async`/`await` will land in Node [with the next V8 update](https://github.com/nodejs/node/pull/9618). Our recent work on improving the performance of promises and generators has helped make async functions fast. On a related note, we are also working on providing [promise hooks](https://bugs.chromium.org/p/v8/issues/detail?id=4643), a set of introspection APIs needed for the [Node Async Hook API](https://github.com/nodejs/node-eps/pull/18).

## Want to try bleeding-edge Node.js?

If you’re excited to test the newest V8 features in Node and don’t mind using bleeding edge, unstable software, you can try out our integration branch [here](https://github.com/v8/node/tree/vee-eight-lkgr). [V8 is continuously integrated into Node](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8%20Linux64%20-%20node.js%20integration) before V8 hits Node master, so we can catch issues early. Be warned though, this is more experimental than Node master.
