---
title: 'Weak references and finalizers'
author: 'Sathya Gunasekaran ([@_gsathya](https://twitter.com/_gsathya)) and Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
- 'sathya-gunasekaran'
- 'mathias-bynens'
date: 2019-06-09
tags:
  - ECMAScript
  - io19
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
ws.add(ref);
ws.has(ref);
// → true
```

:::note
You can think of `WeakMap.prototype.set(ref, metaData)` as adding a property with the value `metaData` to the object `ref`: as long as you have a reference to the object, you can get the metadata. Once you no longer have a reference to the object, it can be garbage-collected, even if you still have a reference to the WeakMap to which it was added. Similarly, you can think of a `WeakSet` as a special case of `WeakMap` where all the values are booleans.

A JavaScript `WeakMap` is not really _weak_: it actually refers _strongly_ to its contents as long as the key is alive. The `WeakMap` only refers weakly to its contents once the key is garbage-collected. A more accurate name for this kind of relationship is [_ephemeron_](https://en.wikipedia.org/wiki/Ephemeron).
:::

`WeakRef` is a more advanced API that provides _actual_ weak references, enabling a window into the lifetime of an object. Let’s walk through an example together.

Imagine a `getImage` function that takes a `name` and performs some expensive operation to generate another object, like a binary blob of image data:

```js
function getImage(name) {
  const image = performExpensiveOperation(name);
  return image;
}
```

To improve performance, we store the image in a cache. Now, we don’t have to perform the expensive operation again for the same name!

```js
const cache = new Map();

function getImageCached(name) {
  if (cache.has(name)) return cache.get(name);
  const image = performExpensiveOperation(name);
  cache.set(name, image);
  return image;
}
```

But, there’s a problem here. `Map`s hold on to their keys and values strongly, and so the image names and data can never be garbage-collected. This steadily increases memory and causes a memory leak!

(Note that using a `WeakMap` would not help here, as `WeakMaps` don’t support string keys.)

`WeakRef`s make it possible to solve the memory leak by creating a _weak reference_ to the image and storing _that_ in the cache (instead of the image itself). This way, when the garbage collector realizes that it’s running out of memory, it can clean up some of the images.

```js
const cache = new Map();

function getImageCached(name) {
  const ref = cache.get(name);
  if (ref !== undefined) {
    const deref = ref.deref();
    if (deref !== undefined) return deref;
  }
  const image = performExpensiveOperation(name);
  const wr = new WeakRef(image);
  cache.set(name, wr);
  return image;
}
```

But there’s still a problem here: the `Map` still holds on to the `name` strings forever, because those are the keys in the cache. Ideally, those strings would be removed too. The `WeakRef` proposal has a solution for this as well! With the new `FinalizationGroup` API, we can register a callback to run when the garbage collector zaps a registered object. Such callbacks are known as _finalizers_.

:::note
**Note:** The finalization callback does not run immediately after garbage-collecting the image object. It just runs at some point in the future. Keep this in mind when writing code!
:::

Here, we register a callback to remove keys from the cache when the image objects are garbage-collected:

```js
const cache = new Map();

const finalizationGroup = new FinalizationGroup((iterator) => {
  for (const name of iterator) {
    const ref = cache.get(name);
    if (ref !== undefined && ref.deref() === undefined) {
      cache.delete(name);
    }
  }
});
```

:::note
**Note:** The `ref !== undefined` is required because we could’ve added a new `WeakRef` with the same `name` between the old `WeakRef` enqueueing the finalization callback and actually running the finalization callback.
:::

Our final implementation looks like this:

```js
const cache = new Map();

const finalizationGroup = new FinalizationGroup((iterator) => {
  for (const name of iterator) {
    const ref = cache.get(name);
    if (ref !== undefined && ref.deref() === undefined) {
      cache.delete(name);
    }
  }
});

function getImageCached(name) {
  const ref = cache.get(name); // 1
  if (ref !== undefined) { // 2
    const deref = ref.deref();
    if (deref !== undefined) return deref;
  }
  const image = performExpensiveOperation(name); // 3
  const wr = new WeakRef(image); // 4
  cache.set(name, wr); // 5
  finalizationGroup.register(image, name); // 6
  return image; // 7
}
```

Given an image name, we look up its corresponding weak reference in the cache (1). If the weak reference still points to something (2), we can return the cached image data. If there’s no cache entry yet for this image name, or if the cached image data has been garbage-collected, we compute the image data (3), create a new weak reference to it (4), store the image name and the weak reference in the cache (5),
register a finalizer that removes the image name from the cache once the image data is garbage-collected (6), and return the image (7).

## `WeakRef` support { #support }

<feature-support chrome="no"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
