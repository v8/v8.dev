---
title: 'Adding BigInts to V8'
author: 'Jakob Kummerow, arbitrator of precision'
date: 2018-05-02 13:33:37
tags:
  - ECMAScript
description: 'V8 now supports BigInts, a JavaScript language feature enabling arbitrary-precision integers.'
tweet: '991705626391732224'
---
Over the past couple of months, we have implemented support for [BigInts](/features/bigint) in V8, as currently specified by [this proposal](https://github.com/tc39/proposal-bigint), to be included in a future version of ECMAScript. The following post tells the story of our adventures.

## TL;DR

As a JavaScript programmer, you now[^1] have integers with arbitrary[^2] precision in your toolbox:

```js
const a = 2172141653n;
const b = 15346349309n;
a * b;
// → 33334444555566667777n     // Yay!
Number(a) * Number(b);
// → 33334444555566670000      // Boo!
const such_many = 2n ** 222n;
// → 6739986666787659948666753771754907668409286105635143120275902562304n
```

For details about the new functionality and how it could be used, refer to [our in-depth article on BigInt](/features/bigint). We are looking forward to seeing the awesome things you’ll build with them!

[^1]: _Now_ if you run Chrome Beta, Dev, or Canary, or a [preview Node.js version](https://github.com/v8/node/tree/vee-eight-lkgr), otherwise _soon_ (Chrome 67, Node.js tip-of-tree probably around the same time).

[^2]: Arbitrary up to an implementation-defined limit. Sorry, we haven’t yet figured out how to squeeze an infinite amount of data into your computer’s finite amount of memory.

## Representing BigInts in memory

Typically, computers store integers in their CPU’s registers (which nowadays are usually 32 or 64 bits wide), or in register-sized chunks of memory. This leads to the minimum and maximum values you might be familiar with. For example, a 32-bit signed integer can hold values from -2,147,483,648 to 2,147,483,647. The idea of BigInts, however, is to not be restricted by such limits.

So how can one store a BigInt with a hundred, or a thousand, or a million bits? It can’t fit in a register, so we allocate an object in memory. We make it large enough to hold all the BigInt’s bits, in a series of chunks, which we call “digits” — because this is conceptually very similar to how one can write bigger numbers than “9” by using more digits, like in “10”; except where the decimal system uses digits from 0 to 9, our BigInts use digits from 0 to 4294967295 (i.e. `2**32-1`). That’s the value range of a 32-bit CPU register[^3], without a sign bit; we store the sign bit separately. In pseudo-code, a `BigInt` object with `3*32 = 96` bits looks like this:

```js
{
  type: 'BigInt',
  sign: 0,
  num_digits: 3,
  digits: [0x12…, 0x34…, 0x56…],
}
```

[^3]: On 64-bit machines, we use 64-bit digits, i.e. from 0 to 18446744073709551615 (i.e. `2n**64n-1n`).

## Back to school, and back to Knuth

Working with integers kept in CPU registers is really easy: to e.g. multiply two of them, there’s a machine instruction which software can use to tell the CPU “multiply the contents of these two registers!”, and the CPU will do it. For BigInt arithmetic, we have to come up with our own solution. Thankfully this particular task is something that quite literally every child at some point learns how to solve: remember what you did back in school when you had to multiply 345 \* 678 and weren’t allowed to use a calculator?

```
345 * 678
---------
     30    //   5 * 6
+   24     //  4  * 6
+  18      // 3   * 6
+     35   //   5 *  7
+    28    //  4  *  7
+   21     // 3   *  7
+      40  //   5 *   8
+     32   //  4  *   8
+    24    // 3   *   8
=========
   233910
```

That’s exactly how V8 multiplies BigInts: one digit at a time, adding up the intermediate results. The algorithm works just as well for `0` to `9` as it does for a BigInt’s much bigger digits.

Donald Knuth published a specific implementation of multiplication and division of large numbers made up of smaller chunks in Volume 2 of his classic _The Art of Computer Programming_, all the way back in 1969. V8’s implementation follows this book, which shows that this a pretty timeless piece of computer science.

## “Less desugaring” == more sweets?

Perhaps surprisingly, we had to spend quite a bit of effort on getting seemingly simple unary operations, like `-x`, to work. So far, `-x` did exactly the same as `x * (-1)`, so to simplify things, V8 applied precisely this replacement as early as possible when processing JavaScript, namely in the parser. This approach is called “desugaring”, because it treats an expression like `-x` as “syntactic sugar” for `x * (-1)`. Other components (the interpreter, the compiler, the entire runtime system) didn’t even need to know what a unary operation is, because they only ever saw the multiplication, which of course they must support anyway.

With BigInts, however, this implementation suddenly becomes invalid, because multiplying a BigInt with a Number (like `-1`) must throw a `TypeError`[^4]. The parser would have to desugar `-x` to `x * (-1n)` if `x` is a BigInt — but the parser has no way of knowing what `x` will evaluate to. So we had to stop relying on this early desugaring, and instead add proper support for unary operations on both Numbers and BigInts everywhere.

[^4]: Mixing `BigInt` and `Number` operand types is generally not allowed. That’s somewhat unusual for JavaScript, but there is [an explanation](/features/bigint#operators) for this decision.

## A bit of fun with bitwise ops

Most computer systems in use today store signed integers using a neat trick called “two’s complement”, which has the nice properties that the first bit indicates the sign, and adding 1 to the bit pattern always increments the number by 1, taking care of the sign bit automatically. For example, for 8-bit integers:

- `10000000` is -128, the lowest representable number,
- `10000001` is -127,
- `11111111` is -1,
- `00000000` is 0,
- `00000001` is 1,
- `01111111` is 127, the highest representable number.

This encoding is so common that many programmers expect it and rely on it, and the BigInt specification reflects this fact by prescribing that BigInts must act as if they used two’s complement representation. As described above, V8’s BigInts don’t!

To perform bitwise operations according to spec, our BigInts therefore must pretend to be using two’s complement under the hood. For positive values, it doesn’t make a difference, but negative numbers must do extra work to accomplish this. That has the somewhat surprising effect that `a & b`, if `a` and `b` are both negative BigInts, actually performs _four_ steps (as opposed to just one if they were both positive): both inputs are converted to fake-two’s-complement format, then the actual operation is done, then the result is converted back to our real representation. Why the back-and-forth, you might ask? Because all the non-bitwise operations are much easier that way.

## Two new types of TypedArrays

The BigInt proposal includes two new TypedArray flavors: `BigInt64Array` and `BigUint64Array`. We can have TypedArrays with 64-bit wide integer elements now that BigInts provide a natural way to read and write all the bits in those elements, whereas if one tried to use Numbers for that, some bits might get lost. That’s why the new arrays aren’t quite like the existing 8/16/32-bit integer TypedArrays: accessing their elements is always done with BigInts; trying to use Numbers throws an exception.

```js
> const big_array = new BigInt64Array(1);
> big_array[0] = 123n;  // OK
> big_array[0]
123n
> big_array[0] = 456;
TypeError: Cannot convert 456 to a BigInt
> big_array[0] = BigInt(456);  // OK
```

Just like JavaScript code working with these types of arrays looks and works a bit different from traditional TypedArray code, we had to generalize our TypedArray implementation to behave differently for the two newcomers.

## Optimization considerations

For now, we are shipping a baseline implementation of BigInts. It is functionally complete and should provide solid performance (a little bit faster than existing userland libraries), but it is not particularly optimized. The reason is that, in line with our aim to prioritize real-world applications over artificial benchmarks, we first want to see how you will use BigInts, so that we can then optimize precisely the cases you care about!

For example, if we see that relatively small BigInts (up to 64 bits) are an important use case, we could make those more memory-efficient by using a special representation for them:

```js
{
  type: 'BigInt-Int64',
  value: 0x12…,
}
```

One of the details that remain to be seen is whether we should do this for “int64” value ranges, “uint64” ranges, or both — keeping in mind having to support fewer fast paths means that we can ship them sooner, and also that every additional fast path ironically makes everything else a bit slower, because affected operations always have to check whether it is applicable.

Another story is support for BigInts in the optimizing compiler. For computationally heavy applications operating on 64-bit values and running on 64-bit hardware, keeping those values in registers would be much more efficient than allocating them as objects on the heap as we currently do. We have plans for how we would implement such support, but it is another case where we would first like to find out whether that is really what you, our users, care about the most; or whether we should spend our time on something else instead.

Please send us feedback on what you’re using BigInts for, and any issues you encounter! You can reach us at our bug tracker [crbug.com/v8/new](https://crbug.com/v8/new), via mail to [v8-users@googlegroups.com](mailto:v8-users@googlegroups.com), or [@v8js](https://twitter.com/v8js) on Twitter.
