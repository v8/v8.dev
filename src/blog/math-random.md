---
title: 'There’s `Math.random()`, and then there’s `Math.random()`'
author: 'Yang Guo ([@hashseed](https://twitter.com/hashseed)), software engineer and dice designer'
avatars:
  - 'yang-guo'
date: 2015-12-17 13:33:37
tags:
  - ECMAScript
  - internals
description: 'V8’s Math.random implementation now uses an algorithm called xorshift128+, improving the randomness compared to the old MWC1616 implementation.'
---
> `Math.random()` returns a `Number` value with positive sign, greater than or equal to `0` but less than `1`, chosen randomly or pseudo-randomly with approximately uniform distribution over that range, using an implementation-dependent algorithm or strategy. This function takes no arguments.

— _[ES 2015, section 20.2.2.27](http://tc39.es/ecma262/#sec-math.random)_

`Math.random()` is the most well-known and frequently-used source of randomness in Javascript. In V8 and most other Javascript engines, it is implemented using a [pseudo-random number generator](https://en.wikipedia.org/wiki/Pseudorandom_number_generator) (PRNG). As with all PRNGs, the random number is derived from an internal state, which is altered by a fixed algorithm for every new random number. So for a given initial state, the sequence of random numbers is deterministic. Since the bit size n of the internal state is limited, the numbers that a PRNG generates will eventually repeat themselves. The upper bound for the period length of this [permutation cycle](https://en.wikipedia.org/wiki/Cyclic_permutation) is 2<sup>n</sup>.

There are many different PRNG algorithms; among the most well-known ones are [Mersenne-Twister](https://en.wikipedia.org/wiki/Mersenne_Twister) and [LCG](https://en.wikipedia.org/wiki/Linear_congruential_generator). Each has its particular characteristics, advantages, and drawbacks. Ideally, it would use as little memory as possible for the initial state, be quick to perform, have a large period length, and offer a high quality random distribution. While memory usage, performance, and period length can easily be measured or calculated, the quality is harder to determine. There is a lot of math behind statistical tests to check the quality of random numbers. The de-facto standard PRNG test suite, [TestU01](http://simul.iro.umontreal.ca/testu01/tu01.html), implements many of these tests.

Until [recently](https://github.com/v8/v8/blob/ceade6cf239e0773213d53d55c36b19231c820b5/src/js/math.js#L143) (up to version 4.9.40), V8’s choice of PRNG was MWC1616 (multiply with carry, combining two 16-bit parts). It uses 64 bits of internal state and looks roughly like this:

```cpp
uint32_t state0 = 1;
uint32_t state1 = 2;
uint32_t mwc1616() {
  state0 = 18030 * (state0 & 0xFFFF) + (state0 >> 16);
  state1 = 30903 * (state1 & 0xFFFF) + (state1 >> 16);
  return state0 << 16 + (state1 & 0xFFFF);
}
```

The 32-bit value is then turned into a floating point number between 0 and 1 in agreement with the specification.

MWC1616 uses little memory and is pretty fast to compute, but unfortunately offers sub-par quality:

- The number of random values it can generate is limited to 2<sup>32</sup> as opposed to the 2<sup>52</sup> numbers between 0 and 1 that double precision floating point can represent.
- The more significant upper half of the result is almost entirely dependent on the value of state0. The period length would be at most 2<sup>32</sup>, but instead of few large permutation cycles, there are many short ones. With a badly chosen initial state, the cycle length could be less than 40 million.
- It fails many statistical tests in the TestU01 suite.

This has been [pointed out](https://medium.com/@betable/tifu-by-using-math-random-f1c308c4fd9d) to us, and having understood the problem and after some research, we decided to reimplement `Math.random` based on an algorithm called [xorshift128+](http://vigna.di.unimi.it/ftp/papers/xorshiftplus.pdf). It uses 128 bits of internal state, has a period length of 2<sup>128</sup> - 1, and passes all tests from the TestU01 suite.

```cpp
uint64_t state0 = 1;
uint64_t state1 = 2;
uint64_t xorshift128plus() {
  uint64_t s1 = state0;
  uint64_t s0 = state1;
  state0 = s0;
  s1 ^= s1 << 23;
  s1 ^= s1 >> 17;
  s1 ^= s0;
  s1 ^= s0 >> 26;
  state1 = s1;
  return state0 + state1;
}
```

The new implementation [landed in V8 v4.9.41.0](https://github.com/v8/v8/blob/085fed0fb5c3b0136827b5d7c190b4bd1c23a23e/src/base/utils/random-number-generator.h#L102) within a few days of us becoming aware of the issue. It will become available with Chrome 49. Both [Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=322529#c99) and [Safari](https://bugs.webkit.org/show_bug.cgi?id=151641) switched to xorshift128+ as well.

Make no mistake however: even though xorshift128+ is a huge improvement over MWC1616, it still is not [cryptographically secure](https://en.wikipedia.org/wiki/Cryptographically_secure_pseudorandom_number_generator). For use cases such as hashing, signature generation, and encryption/decryption, ordinary PRNGs are unsuitable. The Web Cryptography API introduces [`window.crypto.getRandomValues`](https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues), a method that returns cryptographically secure random values, at a performance cost.

Please keep in mind, if you find areas of improvement in V8 and Chrome, even ones that — like this one — do not directly affect spec compliance, stability, or security, please file [an issue on our bug tracker](https://bugs.chromium.org/p/v8/issues/entry?template=Defect%20report%20from%20user).
