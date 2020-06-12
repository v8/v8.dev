---
title: 'Weak references and finalizers'
author: 'Sathya Gunasekaran ([@_gsathya](https://twitter.com/_gsathya)) and Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
- 'sathya-gunasekaran'
- 'mathias-bynens'
date: 2019-07-09
tags:
  - ECMAScript
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
You can think of `WeakMap.prototype.set(ref, metaData)` as adding a property with the value `metaData` to the object `ref`: as long as you have a reference to the object, you can get the metadata. Once you no longer have a reference to the object, it can be garbage-collected, even if you still have a reference to the `WeakMap` to which it was added. Similarly, you can think of a `WeakSet` as a special case of `WeakMap` where all the values are booleans.

A JavaScript `WeakMap` is not really _weak_: it actually refers _strongly_ to its contents as long as the key is alive. The `WeakMap` only refers weakly to its contents once the key is garbage-collected. A more accurate name for this kind of relationship is [_ephemeron_](https://en.wikipedia.org/wiki/Ephemeron).
:::

`WeakRef` is a more advanced API that provides _actual_ weak references, enabling a window into the lifetime of an object. Let’s walk through an example together.

For the example, suppose we're working on a chat web application that uses web sockets to communicate with a server. Imagine a `MovingAvg` class that, for performance diagnostic purposes, keeps a set of events from a web socket in order to compute a simple moving average of the latency.

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
    // ...
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
    // ...
  }
}
```

We know that keeping all the server messages inside an instance `MovingAvg` uses a lot of memory, so we take care to null out `this.movingAvg` when monitoring is stopped to let the garbage collector reclaim memory.

However, after checking in the memory panel in DevTools, we found out that memory was not being reclaimed at all! The seasoned web developer may have already spotted the bug: event listeners are strong references and must be explicitly removed. Thus, the listener in `MovingAvg` instances, by referencing `this`, keeps the whole instance alive as long as the event listener isn't removed.

Until now, the solution is to manually unregister the event listener via `dispose` method.

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

  // ...
}
```

The downside to this approach is that it is manual memory management. `MovingAvgComponent`, and all other users of the `MovingAvg` class, must remember to call `dispose` or suffer memory leaks. Because the application behavior doesn't depend on the event listener of this diagnostic class, and that the listener is expensive in terms of memory use but not in computation, we really want the listener's lifetime to be logically tied to the `MovingAvg` instance. If its lifetime were tied to the `MovingAvg` instance, then `MovingAvg` could be used like any other JavaScript object whose memory is automatically reclaimed by the garbage collector.

`WeakRef`s make it possible to solve the dilemma by creating a _weak reference_ to the actual event listener, and then wrapping that `WeakRef` in an outer event listener. This way, the garbage collector can clean up the actual event listener and the memory that it holds alive, like the `events` array.

```js
class MovingAvg {
  constructor(socket) {
    this.events = [];
    const listener = (ev) => { this.events.push(ev); }
    const weakRef = new WeakRef(listener);
    const listenerWrapper = (ev) => {
      const deref = weakRef.deref();
      if (deref !== undefined) deref(ev);
    });
    socket.addEventListener("message", listenerWrapper);
  }

  // No more dispose!
}
```

We create a `WeakRef` whose _target_ is the actual event listener. Inside the `listenerWrapper`, we `deref` it. Because `WeakRef`s do not prevent garbage collection of their targets if the targets do not have other strong references, we must manually dereference them to get at the target. If the target has been garbage-collected in the meantime, `deref` returns `undefined`. Otherwise, the original target is returned, which is the `listener` function we then call.

But there's still a problem here: we've added a level of indirection to `listener` by wrapping it a `WeakRef`, but `listenerWrapper` is still leaking for the same reason that `listener` was leaking originally. The solution to this is the companion feature to `WeakRef`, `FinalizationRegistry`. With the new `FinalizationRegistry` API, we can register a callback to run when the garbage collector zaps a register object. Such callbacks are known as _finalizers_.

:::note
**Note:** The finalization callback does not run immediately after garbage-collecting the event listener. It either runs at some point in the future, or not at all — the spec doesn’t guarantee that it runs! Keep this in mind when writing code.
:::

We can register a callback with a `FinalizationRegistry` to remove `listenerWrapper` from the socket when the inner event listener is garbage-collected. Our final implementation looks like this:

```js
const gListenersRegistry = new FinalizationRegistry(
  ({ socket, listenerWrapper }) => {
    socket.removeEventListener(socket, listenerWrapper); // 5
  });

class MovingAvg {
  constructor(socket) {
    this.events = [];
    const listener = (ev) => { this.events.push(ev); }
    const weakRef = new WeakRef(listener); // 1
    const listenerWrapper = (ev) => {
      const deref = weakRef.deref(); // 2
      if (deref !== undefined) deref(ev); // 3
    });
    socket.addEventListener("message", listenerWrapper);
    gListenersRegistry.register(listener,
                                { socket, listenerWrapper }); // 4
  }
}
```

We wrap the event listener that does the work in a `WeakRef` to make garbage-collectible, and to not leak its reference to the `MovingAvg` instance via `this` (1). We make a wrapper that `deref` the `WeakRef` to check if it is still alive (2), then call it if so (3). After registering the listener wrapper on the socket, we also register the inner listener on the `FinalizationRegistry`, passing a _holding value_ `{ socket, wrapper }` to the registration (4). Sometime after the inner listener garbage-collected, the finalizer may run, with the holding value passed to it. Inside the finalizer, we unregister the listener wrapper as well, making all memory associated with a `MovingAvg` instance garbage-collectible (5).

With all this, our original implementation of `MovingAvgComponent` neither leaks memory nor requires any manual disposal.

## Don’t overdo it { #progressive-enhancement }

After hearing about these new capabilities, it might be tempting to `WeakRef` All The Things™. However, that’s probably not a good idea. Some things are explicitly _not_ good use cases for `WeakRef`s and finalizers.

In general, avoid writing code that depends on the garbage collector cleaning up a `WeakRef` or calling a finalizer at any predictable time — [it can’t be done](https://github.com/tc39/proposal-weakrefs#a-note-of-caution)! Moreover, whether an object is garbage-collectible at all may depend on implementation details, such as the representation of closures, that are both subtle and may differ between different versions of V8.

For example, don’t place important logic in the code path of a finalizer. There’s no way to predict _when_, or even _if_, a given finalizer gets called. It’s best to think of `WeakRef`s and finalizers as **progressive enhancement**: it’s nice if your custom finalizer code runs, but your program should still work without it.

`WeakRef`s and finalizers can help you save memory, and work best when used sparingly as a means of progressive enhancement. Since they’re power-user features, we expect most usage to happen within frameworks or libraries.

## `WeakRef` support { #support }

<feature-support chrome="partial https://bugs.chromium.org/p/v8/issues/detail?id=8179"
                 firefox="partial https://bugzilla.mozilla.org/show_bug.cgi?id=1561074"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
