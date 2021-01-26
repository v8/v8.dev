---
title: 'Weak references and finalizers'
author: 'Sathya Gunasekaran ([@_gsathya](https://twitter.com/_gsathya)), Mathias Bynens ([@mathias](https://twitter.com/mathias)), Shu-yu Guo ([@_shu](https://twitter.com/_shu)), and Leszek Swirski ([@leszekswirski](https://twitter.com/leszekswirski))'
avatars:
- 'sathya-gunasekaran'
- 'mathias-bynens'
- 'shu-yu-guo'
- 'leszek-swirski'
date: 2019-07-09
updated: 2020-06-19
tags:
  - ECMAScript
  - ES2021
  - io19
description: 'Weak references and finalizers are coming to JavaScript! This article explains the new functionality.'
tweet: '1148603966848151553'
---
Generally, references to objects are _strongly held_ in JavaScript, meaning that as long you have a reference to the object, it won’t be garbage-collected.

```js
const ref = { x: 42, y: 51 };
// As long as you have access to `ref` (or any other reference to the
// same object), the object won’t be garbage-collected.
```

Currently, `WeakMap`s and `WeakSet`s are the only way to kind-of-weakly reference an object in JavaScript: adding an object as a key to a `WeakMap` or `WeakSet` doesn’t prevent it from being garbage-collected.

```js
const wm = new WeakMap();
{
  const ref = {};
  const metaData = 'foo';
  wm.set(ref, metaData);
  wm.get(ref);
  // → metaData
}
// We no longer have a reference to `ref` in this block scope, so it
// can be garbage-collected now, even though it’s a key in `wm` to
// which we still have access.

const ws = new WeakSet();
{
  const ref = {};
  ws.add(ref);
  ws.has(ref);
  // → true
}
// We no longer have a reference to `ref` in this block scope, so it
// can be garbage-collected now, even though it’s a key in `ws` to
// which we still have access.
```

:::note
**Note:** You can think of `WeakMap.prototype.set(ref, metaData)` as adding a property with the value `metaData` to the object `ref`: as long as you have a reference to the object, you can get the metadata. Once you no longer have a reference to the object, it can be garbage-collected, even if you still have a reference to the `WeakMap` to which it was added. Similarly, you can think of a `WeakSet` as a special case of `WeakMap` where all the values are booleans.

A JavaScript `WeakMap` is not really _weak_: it actually refers _strongly_ to its contents as long as the key is alive. The `WeakMap` only refers weakly to its contents once the key is garbage-collected. A more accurate name for this kind of relationship is [_ephemeron_](https://en.wikipedia.org/wiki/Ephemeron).
:::

`WeakRef` is a more advanced API that provides _actual_ weak references, enabling a window into the lifetime of an object. Let’s walk through an example together.

For the example, suppose we’re working on a chat web application that uses web sockets to communicate with a server. Imagine a `MovingAvg` class that, for performance diagnostic purposes, keeps a set of events from a web socket in order to compute a simple moving average of the latency.

```js
class MovingAvg {
  constructor(socket) {
    this.events = [];
    this.socket = socket;
    this.listener = (ev) => { this.events.push(ev); };
    socket.addEventListener('message', this.listener);
  }

  compute(n) {
    // Compute the simple moving average for the last n events.
    // …
  }
}
```

It is used by a `MovingAvgComponent` class that lets you control when to start and stop monitoring the simple moving average of the latency.

```js
class MovingAvgComponent {
  constructor(socket) {
    this.socket = socket;
  }

  start() {
    this.movingAvg = new MovingAvg(this.socket);
  }

  stop() {
    // Allow the garbage collector to reclaim memory.
    this.movingAvg = null;
  }

  render() {
    // Do rendering.
    // …
  }
}
```

We know that keeping all the server messages inside an instance `MovingAvg` uses a lot of memory, so we take care to null out `this.movingAvg` when monitoring is stopped to let the garbage collector reclaim memory.

However, after checking in the memory panel in DevTools, we found out that memory was not being reclaimed at all! The seasoned web developer may have already spotted the bug: event listeners are strong references and must be explicitly removed.

Let’s make this explicit with reachability diagrams. After calling `start()`, our object graph looks like the following, where a solid arrow means a strong reference. Everything reachable via solid arrows from the `MovingAvgComponent` instance is not garbage-collectible.

![](/_img/weakrefs/after-start.svg)

After calling `stop()`, we’ve removed the strong reference from the `MovingAvgComponent` instance to the `MovingAvg` instance, but not via the socket’s listener.

![](/_img/weakrefs/after-stop.svg)

Thus, the listener in `MovingAvg` instances, by referencing `this`, keeps the whole instance alive as long as the event listener isn't removed.

Until now, the solution is to manually unregister the event listener via a `dispose` method.

```js
class MovingAvg {
  constructor(socket) {
    this.events = [];
    this.socket = socket;
    this.listener = (ev) => { this.events.push(ev); };
    socket.addEventListener('message', this.listener);
  }

  dispose() {
    this.socket.removeEventListener('message', this.listener);
  }

  // …
}
```

The downside to this approach is that it is manual memory management. `MovingAvgComponent`, and all other users of the `MovingAvg` class, must remember to call `dispose` or suffer memory leaks. What’s worse, manual memory management is cascading: users of `MovingAvgComponent` must remember to call `stop` or suffer memory leaks, so on and so forth. The application behavior doesn’t depend on the event listener of this diagnostic class, and the listener is expensive in terms of memory use but not in computation. What we really want is for the listener’s lifetime to be logically tied to the `MovingAvg` instance, so that `MovingAvg` could be used like any other JavaScript object whose memory is automatically reclaimed by the garbage collector.

`WeakRef`s make it possible to solve the dilemma by creating a _weak reference_ to the actual event listener, and then wrapping that `WeakRef` in an outer event listener. This way, the garbage collector can clean up the actual event listener and the memory that it holds alive, like the `MovingAvg` instance and its `events` array.

```js
function addWeakListener(socket, listener) {
  const weakRef = new WeakRef(listener);
  const wrapper = (ev) => { weakRef.deref()?.(ev); };
  socket.addEventListener('message', wrapper);
}

class MovingAvg {
  constructor(socket) {
    this.events = [];
    this.listener = (ev) => { this.events.push(ev); };
    addWeakListener(socket, this.listener);
  }
}
```

:::note
**Note:** `WeakRef`s to functions must be treated with caution. JavaScript functions are [closures](https://en.wikipedia.org/wiki/Closure_(computer_programming)) and strongly reference the outer environments which contain the values of free variables referenced inside the functions. These outer environments may contain variables that _other_ closures reference as well. That is, when dealing with closures, their memory is often strongly referenced by other closures in subtle ways. This is the reason `addWeakListener` is a separate function and `wrapper` is not local to the `MovingAvg` constructor. In V8, if `wrapper` were local to the `MovingAvg` constructor and shared the lexical scope with the listener that is wrapped in the `WeakRef`, the `MovingAvg` instance and all its properties become reachable via the shared environment from the wrapper listener, causing the instance to be uncollectible. Keep this in mind when writing code.
:::

We first make the event listener and assign it to `this.listener`, so that it is strongly referenced by the `MovingAvg` instance. In other words, as long as the `MovingAvg` instance is alive, so is the event listener.

Then, in `addWeakListener`, we create a `WeakRef` whose _target_ is the actual event listener. Inside `wrapper`, we `deref` it. Because `WeakRef`s do not prevent garbage collection of their targets if the targets do not have other strong references, we must manually dereference them to get the target. If the target has been garbage-collected in the meantime, `deref` returns `undefined`. Otherwise, the original target is returned, which is the `listener` function we then call using [optional chaining](/features/optional-chaining).

Since the event listener is wrapped in a `WeakRef`, the _only_ strong reference to it is the `listener` property on the `MovingAvg` instance. That is, we’ve successfully tied the lifetime of the event listener to the lifetime of the `MovingAvg` instance.

Returning to reachability diagrams, our object graph looks like the following after calling `start()` with the `WeakRef` implementation, where a dotted arrow means a weak reference.

![](/_img/weakrefs/weak-after-start.svg)

After calling `stop()`, we’ve removed the only strong reference to the listener:

![](/_img/weakrefs/weak-after-stop.svg)

Eventually, after a garbage collection occurs, the `MovingAvg` instance and the listener will be collected:

![](/_img/weakrefs/weak-after-gc.svg)

But there’s still a problem here: we’ve added a level of indirection to `listener` by wrapping it a `WeakRef`, but the wrapper in `addWeakListener` is still leaking for the same reason that `listener` was leaking originally. Granted, this is a smaller leak since only the wrapper is leaking instead of the whole `MovingAvg` instance, but it is still a leak. The solution to this is the companion feature to `WeakRef`, `FinalizationRegistry`. With the new `FinalizationRegistry` API, we can register a callback to run when the garbage collector zaps a register object. Such callbacks are known as _finalizers_.

:::note
**Note:** The finalization callback does not run immediately after garbage-collecting the event listener, so don't use it for important logic or metrics. The timing of garbage collection and finalization callbacks is unspecified. In fact, an engine that never garbage-collects would be fully compliant. However, it's safe to assume that engines _will_ garbage collect, and finalization callbacks will be called at some later time, unless the environment is discarded (such as the tab closing, or the worker terminating). Keep this uncertainty in mind when writing code.
:::

We can register a callback with a `FinalizationRegistry` to remove `wrapper` from the socket when the inner event listener is garbage-collected. Our final implementation looks like this:

```js
const gListenersRegistry = new FinalizationRegistry(({ socket, wrapper }) => {
  socket.removeEventListener('message', wrapper); // 6
});

function addWeakListener(socket, listener) {
  const weakRef = new WeakRef(listener); // 2
  const wrapper = (ev) => { weakRef.deref()?.(ev); }; // 3
  gListenersRegistry.register(listener, { socket, wrapper }); // 4
  socket.addEventListener('message', wrapper); // 5
}

class MovingAvg {
  constructor(socket) {
    this.events = [];
    this.listener = (ev) => { this.events.push(ev); }; // 1
    addWeakListener(socket, this.listener);
  }
}
```

:::note
**Note:** `gListenersRegistry` is a global variable to ensure the finalizers are executed. A `FinalizationRegistry` is not kept alive by objects that are registered on it. If a registry is itself garbage-collected, its finalizer may not run.
:::

We make an event listener and assign it to `this.listener` so that it is strongly referenced by the `MovingAvg` instance (1). We then wrap the event listener that does the work in a `WeakRef` to make it garbage-collectible, and to not leak its reference to the `MovingAvg` instance via `this` (2). We make a wrapper that `deref` the `WeakRef` to check if it is still alive, then call it if so (3). We register the inner listener on the `FinalizationRegistry`, passing a _holding value_ `{ socket, wrapper }` to the registration (4). We then add the returned wrapper as an event listener on `socket` (5). Sometime after the `MovingAvg` instance and the inner listener are garbage-collected, the finalizer may run, with the holding value passed to it. Inside the finalizer, we remove the wrapper as well, making all memory associated with the use of a `MovingAvg` instance garbage-collectible (6).

With all this, our original implementation of `MovingAvgComponent` neither leaks memory nor requires any manual disposal.

## Don’t overdo it { #progressive-enhancement }

After hearing about these new capabilities, it might be tempting to `WeakRef` All The Things™. However, that’s probably not a good idea. Some things are explicitly _not_ good use cases for `WeakRef`s and finalizers.

In general, avoid writing code that depends on the garbage collector cleaning up a `WeakRef` or calling a finalizer at any predictable time — [it can’t be done](https://github.com/tc39/proposal-weakrefs#a-note-of-caution)! Moreover, whether an object is garbage-collectible at all may depend on implementation details, such as the representation of closures, that are both subtle and may differ across JavaScript engines and even between different versions of the same engine. Specifically, finalizer callbacks:

- Might not happen immediately after garbage collection.
- Might not happen in the same order as actual garbage collection.
- Might not happen at all, e.g. if the browser window is closed.

So, don’t place important logic in the code path of a finalizer. They're useful to perform clean-up in response to garbage-collection, but you can't reliably use them to, say, record meaningful metrics about memory usage. For that use case, see [`measureMemory`](https://web.dev/monitor-total-page-memory-usage/).

`WeakRef`s and finalizers can help you save memory, and work best when used sparingly as a means of progressive enhancement. Since they’re power-user features, we expect most usage to happen within frameworks or libraries.

## `WeakRef` support { #support }

<feature-support chrome="74 https://v8.dev/blog/v8-release-84#weak-references-and-finalizers"
                 firefox="partial https://bugzilla.mozilla.org/show_bug.cgi?id=1561074"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
