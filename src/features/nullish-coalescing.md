---
title: 'Nullish coalescing'
author: 'Justin Ridgewell'
avatars:
  - 'justin-ridgewell'
date: 2019-09-17
tags:
  - ECMAScript
  - ES2020
description: 'The JavaScript nullish coalescing operator enables safer default expressions.'
tweet: '1173971116865523714'
---
The [nullish coalescing proposal](https://github.com/tc39/proposal-nullish-coalescing/) (`??`) adds a new short-circuiting operator meant to handle default values.

You might already be familiar with the other short-circuiting operators `&&` and `||`. Both of these operators handle “truthy” and “falsy” values. Imagine the code sample `lhs && rhs`. If `lhs` (read, _left-hand side_) is falsy, the expression evaluates to `lhs`. Otherwise, it evaluates to `rhs` (read, _right-hand side_). The opposite is true for the code sample `lhs || rhs`. If `lhs` is truthy, the expression evaluates to `lhs`. Otherwise, it evaluates to `rhs`.

But what exactly does “truthy” and “falsy” mean? In spec terms, it equates to the [`ToBoolean`](https://tc39.es/ecma262/#sec-toboolean) abstract operation. For us regular JavaScript developers, **everything** is truthy except the falsy values `undefined`, `null`, `false`, `0`, `NaN`, and the empty string `''`. (Technically, the value associated with `document.all` is also falsy, but we’ll get to that later.)

So, what’s the issue with `&&` and `||`? And why do we need a new nullish coalescing operator? It’s because this definition of truthy and falsy doesn’t fit every scenario and this leads to bugs. Imagine the following:

```js
function Component(props) {
  const enable = props.enabled || true;
  // …
}
```

In this example, let’s treat the `enabled` property as an optional boolean property that controls whether some functionality in the component is enabled. Meaning, we can explicitly set `enabled` to either `true` or `false`. But, because it is an _optional_ property, we can implicitly set it to `undefined` by not setting it at all. If it’s `undefined` we want to treat it as if the component is `enabled = true` (its default value).

By now, you can probably spot the bug with the code example. If we explicitly set `enabled = true`, then the `enable` variable is `true`. If we implicitly set `enabled = undefined`, then the `enable` variable is `true`. And if we explicitly set `enabled = false`, then the `enable` variable is still `true`! Our intention was to _default_ the value to `true`, but we actually forced the value instead. The fix in this case is to be very explicit about the values we expect:

```js
function Component(props) {
  const enable = props.enabled !== false;
  // …
}
```

We see this kind of bug pop up with every falsy value. This could have very easily been an optional string (where the empty string `''` is considered valid input), or an optional number (where `0` is considered a valid input). This is such a common problem that we’re now introducing the nullish coalescing operator to handle this sort of default value assignment:

```js
function Component(props) {
  const enable = props.enabled ?? true;
  // …
}
```

The nullish coalescing operator (`??`) acts very similar to the `||` operator, except that we don’t use “truthy” when evaluating the operator. Instead we use the definition of “nullish”, meaning “is the value strictly equal to `null` or `undefined`”. So imagine the expression `lhs ?? rhs`: if `lhs` is not nullish, it evaluates to `lhs`. Otherwise, it evaluates to `rhs`.

Explicitly, that means the values `false`, `0`, `NaN`, and the empty string `''` are all falsy values that are not nullish. When such falsy-but-not-nullish values are the left-hand side of a `lhs ?? rhs`, the expression evaluates to them instead of the right-hand side. Bugs begone!

```js
false ?? true;   // => false
0 ?? 1;          // => 0
'' ?? 'default'; // => ''

null ?? [];      // => []
undefined ?? []; // => []
```

## What about default assignment while destructuring? { #destructuring }

You might have noticed that the last code example could also be fixed by using default assignment inside an object destructure:

```js
function Component(props) {
  const {
    enabled: enable = true,
  } = props;
  // …
}
```

It’s a bit of a mouthful, but still completely valid JavaScript. It uses slightly different semantics, though. Default assignment inside object destructures checks if the property is strictly equal to `undefined`, and if so defaults the assignment.

But these strict equality tests for only `undefined` aren’t always desirable, and an object to perform destructing on isn’t always available. For instance, maybe you want to default on a function’s return values (no object to destructure). Or maybe the function returns `null` (which is common for DOM APIs). These are the times you want to reach for nullish coalescing:

```js
// Concise nullish coalescing
const link = document.querySelector('link') ?? document.createElement('link');

// Default assignment destructure with boilerplate
const {
  link = document.createElement('link'),
} = {
  link: document.querySelector('link') || undefined
};
```

Additionally, certain new features like [optional chaining](/features/optional-chaining) don’t work perfectly with destructuring. Since destructuring requires an object, you must guard the destructure in case the optional chain returned `undefined` instead of an object. With nullish coalescing, we have no such problem:

```js
// Optional chaining and nullish coalescing in tandem
const link = obj.deep?.container.link ?? document.createElement('link');

// Default assignment destructure with optional chaining
const {
  link = document.createElement('link'),
} = (obj.deep?.container || {});
```

## Mixing and matching operators

Language design is hard, and we’re not always able to create new operators without a certain amount of ambiguity in the intention of the developer. If you’ve ever mixed the `&&` and `||` operators together, you’ve probably run into this ambiguity yourself. Imagine the expression `lhs && middle || rhs`. In JavaScript, this is actually parsed the same as the expression `(lhs && middle) || rhs`. Now imagine the expression `lhs || middle && rhs`. This one is actually parsed the same as `lhs || (middle && rhs)`.

You can probably see that the `&&` operator has a higher precedence for its left- and right-hand side than the `||` operator, meaning that the implied parentheses wrap the `&&` instead of the `||`. When designing the `??` operator, we had to decide what the precedence would be. It could either have:

1. lower precedence than both `&&` and `||`
1. lower than `&&` but higher than `||`
1. higher precedence than both `&&` and `||`

For each of these precedence definitions, we then had to run it through the four possible test cases:

1. `lhs && middle ?? rhs`
1. `lhs ?? middle && rhs`
1. `lhs || middle ?? rhs`
1. `lhs ?? middle || rhs`

In each test expression, we had to decide where the implicit parenthesis belonged. And if they didn’t wrap the expression exactly the way the developer intended, then we’d have badly-written code. Unfortunately no matter which precedence level we chose, one of the test expressions could violate the developer’s intentions.

In the end, we decided to require explicit parentheses when mixing the `??` and (`&&` or `||`) (notice I was explicit with my parentheses grouping! meta joke!). If you mix, you must wrap one of the operator groups in parentheses, or you get a syntax error.

```js
// Explicit parentheses groups are required to mix
(lhs && middle) ?? rhs;
lhs && (middle ?? rhs);

(lhs ?? middle) && rhs;
lhs ?? (middle && rhs);

(lhs || middle) ?? rhs;
lhs || (middle ?? rhs);

(lhs ?? middle) || rhs;
lhs ?? (middle || rhs);
```

This way, the language parser always matches what the developer intended. And anyone later reading the code can immediately understand it, too. Nice!

## Tell me about `document.all` { #document.all }

[`document.all`](https://developer.mozilla.org/en-US/docs/Web/API/Document/all) is a special value that you should never ever ever use. But if you do use it, it’s best you know how it interacts with “truthy” and “nullish”.

`document.all` is an array-like object, meaning it has indexed properties like an array and a length. Objects are usually truthy — but surprisingly, `document.all` pretends to be a falsy value! In fact, it’s loosely equal to both `null` and `undefined` (which normally means that it can’t have properties at all).

When using `document.all` with either `&&` or `||`, it pretends to be falsy. But, it’s not strictly equal to `null` nor `undefined`, so it’s not nullish. So when using `document.all` with `??`, it behaves like any other object would.

```js
document.all || true; // => true
document.all ?? true; // => HTMLAllCollection[]
```

## Support for nullish coalescing { #support }

<feature-support chrome="80 https://bugs.chromium.org/p/v8/issues/detail?id=9547"
                 firefox="72 https://bugzilla.mozilla.org/show_bug.cgi?id=1566141"
                 safari="13.1 https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/"
                 nodejs="14 https://medium.com/@nodejs/node-js-version-14-available-now-8170d384567e"
                 babel="yes https://babeljs.io/docs/en/babel-plugin-proposal-nullish-coalescing-operator"></feature-support>
