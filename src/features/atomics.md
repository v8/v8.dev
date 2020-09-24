---
title: '`Atomics.wait`, `Atomics.notify`, `Atomics.waitAsync`'
author: '[Marja Hölttä](https://twitter.com/marjakh), a non-blocking blogger'
avatars:
  - marja-holtta
date: 2020-09-24
tags:
  - ECMAScript
  - ES2020
description: 'Atomics.wait and Atomics.notify are low-level synchronization primitives useful for implementing e.g., mutexes. Atomics.wait is only usable on worker threads. V8 version 8.7 now supports a non-blocking version, Atomics.waitAsync, which is also usable on the main thread.'
tweet: '1309118447377358848'
---

[`Atomics.wait`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait) and [`Atomics.notify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/notify) are low-level synchronization primitives useful for implementing mutexes and other means of synchronization. However, since `Atomics.wait` is blocking, it’s not possible to call it on the main thread (trying to do so throws a `TypeError`).

Starting from version 8.7, V8 supports a non-blocking version, [`Atomics.waitAsync`](https://github.com/tc39/proposal-atomics-wait-async/blob/master/PROPOSAL.md), which is also usable on the main thread.

In this post, we explain how to use these low-level APIs to implement a mutex that works both synchronously (for worker threads) and asynchronously (for worker threads or the main thread).

`Atomics.wait` and `Atomics.waitAsync` take the following parameters:

- `buffer`: an `Int32Array` or `BigInt64Array` backed by a `SharedArrayBuffer`
- `index`: a valid index within the array
- `expectedValue`: a value we expect to be present in the memory location described by `(buffer, index)`
- `timeout`: a timeout in milliseconds (optional, defaults to `Infinity`)

The return value of `Atomics.wait` is a string. If the memory location doesn’t contain the expected value, `Atomics.wait` returns immediately with the value `'not-equal'`. Otherwise, the thread is blocked until another thread calls `Atomics.notify` with the same memory location or the timeout is reached. In the former case, `Atomics.wait` returns the value `'ok'`, in the latter case, `Atomics.wait` returns the value `'timed-out'`.

`Atomics.notify` takes the following parameters:

- an `Int32Array` or `BigInt64Array` backed by a `SharedArrayBuffer`
- an index (valid within the array)
- how many waiters to notify (optional, defaults to `Infinity`)

It notifies the given amount of waiters, in FIFO order, waiting on the memory location described by `(buffer, index)`. If there are several pending `Atomics.wait` calls or `Atomics.waitAsync` calls related to the same location, they are all in the same FIFO queue.

In contrast to `Atomics.wait`, `Atomics.waitAsync` always returns immediately. The return value is one of the following:

- `{ async: false, value: 'not-equal' }` (if the memory location didn’t contain the expected value)
- `{ async: false, value: 'timed-out' }` (only for immediate timeout 0)
- `{ async: true, value: promise }`

The promise may later be resolved with a string value `'ok'` (if `Atomics.notify` was called with the same memory location) or `'timed-out'` (if the timeout was reached). The promise is never rejected.

The following example demonstrates the basic usage of `Atomics.waitAsync`:

```js
const sab = new SharedArrayBuffer(16);
const i32a = new Int32Array(sab);
const result = Atomics.waitAsync(i32a, 0, 0, 1000);
//                                     |  |  ^ timeout (opt)
//                                     |  ^ expected value
//                                     ^ index

if (result.value === 'not-equal') {
  // The value in the SharedArrayBuffer was not the expected one.
} else {
  result.value instanceof Promise; // true
  result.value.then(
    (value) => {
      if (value == 'ok') { /* notified */ }
      else { /* value is 'timed-out' */ }
    });
}

// In this thread, or in another thread:
Atomics.notify(i32a, 0);
```

Next, we’ll show how to implement a mutex which can be used both synchronously and asynchronously. Implementing the synchronous version of the mutex has been previously discussed e.g., [in this blog post](https://blogtitle.github.io/using-javascript-sharedarraybuffers-and-atomics/).

In the example, we don’t use the timeout parameter in `Atomics.wait` and `Atomics.waitAsync`. The parameter can be used for implementing condition variables with a timeout.

Our mutex class, `AsyncLock`, operates on a `SharedArrayBuffer` and implements the following methods:

- `lock` - blocks the thread until we're able to lock the mutex (usable only on a worker thread)
- `unlock` - unlocks the mutex (counterpart of `lock`)
- `executeLocked(callback)` - non-blocking lock, can be used by the main thread; schedules `callback` to be executed once we manage to get the lock

Let’s see how each of those can be implemented. The class definition includes constants and a constructor which takes the `SharedArrayBuffer` as a parameter.

```js
class AsyncLock {
  static INDEX = 0;
  static UNLOCKED = 0;
  static LOCKED = 1;

  constructor(sab) {
    this.sab = sab;
    this.i32a = new Int32Array(sab);
  }

  lock() {
    /* … */
  }

  unlock() {
    /* … */
  }

  executeLocked(f) {
    /* … */
  }
}
```

Here `i32a[0]` contains either the value `LOCKED` or `UNLOCKED`. It’s also the wait location for `Atomics.wait`and `Atomics.waitAsync`. The `AsyncLock` class ensures the following invariants:

1. If `i32a[0] == LOCKED`, and a thread starts to wait (either via `Atomics.wait` or `Atomics.waitAsync`) on `i32a[0]`, it will eventually be notified.
1. After getting notified, the thread tries to grab the lock. If it gets the lock, it will notify again when releasing it.

## Sync lock and unlock

Next we show the blocking `lock` method which can only be called from a worker thread:

```js
lock() {
  while (true) {
    const oldValue = Atomics.compareExchange(self.i32a, AsyncLock.INDEX,
                       /* old value >>> */  AsyncLock.UNLOCKED,
                       /* new value >>> */  AsyncLock.LOCKED);
    if (oldValue == AsyncLock.UNLOCKED) {
      return;
    }
    Atomics.wait(this.i32a, AsyncLock.INDEX,
                 AsyncLock.LOCKED); // <<< expected value at start
  }
}
```

When a thread calls `lock()`, first it tries to get the lock by using `Atomics.compareExchange` to change the lock state from `UNLOCKED` to `LOCKED`. `Atomics.compareExchange` tries to do the state change atomically, and it returns the original value of the memory location. If the original value was `UNLOCKED`, we know the state change succeeded, and the thread acquired the lock. Nothing more is needed.

If `Atomics.compareExchange` doesn’t manage to change the lock state, another thread must be holding the lock. Thus, this thread tries `Atomics.wait` in order to wait for the other thread to release the lock. If the memory location still holds the expected value (in this case, `AsyncLock.LOCKED`), calling `Atomics.wait` will block the thread and the `Atomics.wait` call will return only when another thread calls `Atomics.notify`.

The `unlock` is method sets the lock to the `UNLOCKED` state and calls `Atomics.notify` to wake up one waiter which was waiting for the lock. The state change is always expected to succeed, since this thread is holding the lock, and nobody else should call `unlock()` meanwhile.

```js
unlock() {
  const oldValue = Atomics.compareExchange(this.i32a, AsyncLock.INDEX,
                      /* old value >>> */  AsyncLock.LOCKED,
                      /* new value >>> */  AsyncLock.UNLOCKED);
  if (oldValue != AsyncLock.LOCKED) {
    throw new Error('Tried to unlock while not holding the mutex');
  }
  Atomics.notify(this.i32a, AsyncLock.INDEX, 1);
}
```

The straightforward case goes as follows: the lock is free and thread T1 acquires it by changing the lock state with `Atomics.compareExchange`. Thread T2 tries to acquire the lock by calling `Atomics.compareExchange`, but it doesn’t succeed in changing the lock state. T2 then calls `Atomics.wait`, which blocks the thread. At some point T1 releases the lock and calls `Atomics.notify`. That makes the `Atomics.wait` call in T2 return `"ok"`, waking up T2. T2 then tries to acquire the lock again, and this time succeeds.

There are also 2 possible corner cases - these demonstrate the reason for `Atomics.wait` and `Atomics.waitAsync` checking for a specific value at the index:

- T1 is holding the lock and T2 tries to get it. First, T2 tries to change the lock state with `Atomics.compareExchange`, but doesn't succeed. But then T1 releases the lock before T2 manages to call `Atomics.wait`. When T2 calls `Atomics.wait`, it will return immediately with the return value `"not-equal"`. In that case, T2 will continue with the next loop iteration, trying to acquire the lock again.
- T1 is holding the lock and T2 is waiting for it with `Atomics.wait`. T1 releases the lock - T2 wakes up (the `Atomics.wait` call returns) and tries to do `Atomics.compareExchange` to acquire the lock, but another thread T3 was faster and got the lock already. So the call to `Atomics.compareExchange` fails to get the lock, and T2 calls `Atomics.wait` again, blocking until T3 releases the lock.

Because of the latter corner case, the mutex isn’t "fair". It’s possible that T2 has been waiting for the lock to be released, but T3 comes and gets it immediately. A more realistic lock implementation may use several states to differentiate between "locked" and "locked with contention".

## Async lock

The non-blocking `executeLocked` method is callable from the main thread, unlike the blocking `lock` method. It gets a callback function as its only parameter and schedules the callback to be executed once it has successfully acquired the lock.

```js
executeLocked(f) {
  const self = this;

  async function tryGetLock() {
    while (true) {
      const oldValue = Atomics.compareExchange(self.i32a, AsyncLock.INDEX,
                          /* old value >>> */  AsyncLock.UNLOCKED,
                          /* new value >>> */  AsyncLock.LOCKED);
      if (oldValue == AsyncLock.UNLOCKED) {
        f();
        self.unlock();
        return;
      }
      const result = Atomics.waitAsync(self.i32a, AsyncLock.INDEX,
                                       AsyncLock.LOCKED);
                                   //  ^ expected value at start
      await result.value;
    }
  }

  tryGetLock();
}
```

The inner function `tryGetLock` tries to first get the lock with `Atomics.compareExchange`, as before. If that successfully changes the lock state, it can execute the callback, unlock the lock, and return.

If `Atomics.compareExchange` fails to get the lock, we need to try again when the lock is probably free. We can’t block and wait for the lock to become free - instead, we schedule the new try using `Atomics.waitAsync` and the Promise it returns.

If we successfully started `Atomics.waitAsync`, the returned Promise will resolve when the lock-holding thread does `Atomics.notify`. Then the thread that was waiting for the lock will try to get the lock again, like before.

The same corner cases (the lock getting released between the `Atomics.compareExchange` call and the `Atomics.waitAsync` call, as well as the lock getting acquired again between the Promise resolving and the `Atomics.compareExchange` call) are possible in the asynchronous version too, so the code has to handle them in a robust way.

## Conclusion

In this post, we showed how to use the synchronization primitives `Atomics.wait`, `Atomics.waitAsync`, and `Atomics.notify`, to implement a mutex which is usable both in the main thread an in worker threads.

## Feature support { #support }

### `Atomics.wait` and `Atomics.notify`

<feature-support chrome="68"
                 firefox="78"
                 safari="no"
                 nodejs="8.10.0"
                 babel="no"></feature-support>

### `Atomics.waitAsync`

<feature-support chrome="87"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
