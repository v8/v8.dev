---
title: 'Optimizing hash tables: hiding the hash code'
author: '[Sathya Gunasekaran](https://twitter.com/_gsathya), keeper of hash codes'
avatars:
  - 'sathya-gunasekaran'
date: 2018-01-29 13:33:37
tags:
  - internals
tweet: '958046113390411776'
---
ECMAScript 2015 introduced several new data structures such as Map, Set, WeakSet, and WeakMap, all of which use hash tables under the hood. This post details the [recent improvements](https://bugs.chromium.org/p/v8/issues/detail?id=6404) in how [V8 v6.3+](/blog/v8-release-63) stores the keys in hash tables.

## Hash code

A [_hash function_](https://en.wikipedia.org/wiki/Hash_function) is used to map a given key to a location in the hash table. A _hash code_ is the result of running this hash function over a given key.

In V8, the hash code is just a random number, independent of the object value. Therefore, we can’t recompute it, meaning we must store it.

For JavaScript objects that were used as keys, previously, the hash code was stored as a private symbol on the object. A private symbol in V8 is similar to a [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), except that it’s not enumerable and doesn’t leak to userspace JavaScript.

```js
function GetObjectHash(key) {
  let hash = key[hashCodeSymbol];
  if (IS_UNDEFINED(hash)) {
    hash = (MathRandom() * 0x40000000) | 0;
    if (hash === 0) hash = 1;
    key[hashCodeSymbol] = hash;
  }
  return hash;
}
```

This worked well because we didn’t have to reserve memory for a hash code field until the object was added to a hash table, at which point a new private symbol was stored on the object.

V8 could also optimize the hash code symbol lookup just like any other property lookup using the IC system, providing very fast lookups for the hash code. This works well for [monomorphic IC lookups](https://en.wikipedia.org/wiki/Inline_caching#Monomorphic_inline_caching), when the keys have the same [hidden class](/). However, most real-world code doesn’t follow this pattern, and often keys have different hidden classes, leading to slow [megamorphic IC lookups](https://en.wikipedia.org/wiki/Inline_caching#Megamorphic_inline_caching) of the hash code.

Another problem with the private symbol approach was that it triggered a [hidden class transition](/#fast-property-access) in the key on storing the hash code. This resulted in poor polymorphic code not just for the hash code lookup but also for other property lookups on the key and [deoptimization](https://floitsch.blogspot.com/2012/03/optimizing-for-v8-inlining.html) from optimized code.

## JavaScript object backing stores

A JavaScript object (`JSObject`) in V8 uses two words (apart from its header): one word for storing a pointer to the elements backing store, and another word for storing a pointer to the properties backing store.

The elements backing store is used for storing properties that look like [array indices](https://tc39.es/ecma262/#sec-array-index), whereas the properties backing store is used for storing properties whose keys are strings or symbols. See this [V8 blog post](/blog/fast-properties) by Camillo Bruni for more information about these backing stores.

```js
const x = {};
x[1] = 'bar';      // ← stored in elements
x['foo'] = 'bar';  // ← stored in properties
```

## Hiding the hash code

The easiest solution to storing the hash code would be to extend the size of a JavaScript object by one word and store the hash code directly on the object. However, this would waste memory for objects that aren’t added to a hash table. Instead, we could try to store the hash code in the elements store or properties store.

The elements backing store is an array containing its length and all the elements. There’s not much to be done here, as storing the hashcode in a reserved slot (like the 0th index) would still waste memory when we don’t use the object as a key in a hash table.

Let’s look at the properties backing store. There are two kinds of data structures used as a properties backing store: arrays and dictionaries.

Unlike the array used in the elements backing store which does not have an upper limit, the array used in the properties backing store has an upper limit of 1022 values. V8 transitions to using a dictionary on exceeding this limit for performance reasons. (I’m slightly simplifying this — V8 can also use a dictionary in other cases, but there is a fixed upper limit on the number of values that can be stored in the array.)

So, there are three possible states for the properties backing store:

1. empty (no properties)
2. array (can store up to 1022 values)
3. dictionary

Let’s discuss each of these.

### The properties backing store is empty

For the empty case, we can directly store the hash code in this offset on the `JSObject`.

<figure>
  <img src="/_img/hash-code/properties-backing-store-empty.png" intrinsicsize="323x160" alt="">
</figure>

### The properties backing store is an array

V8 represents integers less than 2<sup>31</sup> (on 32-bit systems) unboxed, as [Smi](https://wingolog.org/archives/2011/05/18/value-representation-in-javascript-implementations)s. In a Smi, the least significant bit is a tag used to distinguish it from pointers, while the remaining 31 bits hold the actual integer value.

Normally, arrays store their length as a Smi. Since we know that the maximum capacity of this array is only 1022, we only need 10 bits to store the length. We can use the remaining 21 bits to store the hash code!

<figure>
  <img src="/_img/hash-code/properties-backing-store-array.png" intrinsicsize="491x322" alt="">
</figure>

### The properties backing store is a dictionary

For the dictionary case, we increase the dictionary size by 1 word to store the hashcode in a dedicated slot at the beginning of the dictionary. We get away with potentially wasting a word of memory in this case, because the proportional increase in size isn’t as big as in the array case.

<figure>
  <img src="/_img/hash-code/properties-backing-store-dictionary.png" intrinsicsize="446x214" alt="">
</figure>

With these changes, the hash code lookup no longer has to go through the complex JavaScript property lookup machinery.

## Performance improvements

The [SixSpeed](https://github.com/kpdecker/six-speed) benchmark tracks the performance of Map and Set, and these changes resulted in a ~500% improvement.

<figure>
  <img src="/_img/hash-code/sixspeed.png" intrinsicsize="1999x386" alt="">
</figure>

This change caused a 5% improvement on the Basic benchmark in [ARES6](https://webkit.org/blog/7536/jsc-loves-es6/) as well.

<figure>
  <img src="/_img/hash-code/ares-6.png" intrinsicsize="1999x505" alt="">
</figure>

This also resulted in an 18% improvement in one of the benchmarks in the [Emberperf](http://emberperf.eviltrout.com/) benchmark suite that tests Ember.js.

<figure>
  <img src="/_img/hash-code/emberperf.jpg" intrinsicsize="1987x609" alt="">
</figure>
