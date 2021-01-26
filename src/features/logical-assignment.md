---
title: 'Logical assignment'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2020-05-07
tags:
  - ECMAScript
  - ES2021
description: 'JavaScript now supports compound assignment with logical operations.'
tweet: '1258387483823345665'
---
JavaScript supports a range of [compound assignment operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Assignment_Operators) that let programmers succinctly express a binary operation together with assignment. Currently, only mathematical or bitwise operations are supported.

What has been missing is the ability to combine logical operations with assignment. Until now! JavaScript now supports logical assignment with the new operators `&&=`, `||=`, and `??=`.

## Logical assignment operators

Before we dive into the new operators, let’s have a refresher on the existing compound assignment operators. For instance, the meaning of `lhs += rhs` is roughly equivalent to `lhs = lhs + rhs`. This rough equivalence holds for all the existing operators `@=` where `@` stands in for a binary operator like `+`, or `|`. It is worth noting this is, strictly speaking, only correct when `lhs` is a variable. For more complex left-hand sides in expressions like `obj[computedPropertyName()] += rhs`, the left-hand side is only evaluated once.

Let’s now dive into the new operators. In contrast with the existing operators, `lhs @= rhs` does not roughly mean `lhs = lhs @ rhs` when `@` is a logical operation: `&&`, `||`, or `??`.

```js
// As an additional review, here is the semantics of logical and:
x && y
// → y when x is truthy
// → x when x is not truthy

// First, logical and assignment. The two lines following this
// comment block are equivalent.
// Note that like existing compound assignment operators, more complex
// left-hand sides are only evaluated once.
x &&= y;
x && (x = y);

// The semantics of logical or:
x || y
// → x when x is truthy
// → y when x is not truthy

// Similarly, logical or assignment:
x ||= y;
x || (x = y);

// The semantics of nullish coalescing operator:
x ?? y
// → y when x is nullish (null or undefined)
// → x when x is not nullish

// Finally, nullish coalescing assignment:
x ??= y;
x ?? (x = y);
```

## Short-circuit semantics

Unlike their mathematical and bitwise counterparts, logical assignments follow the short-circuiting behavior of their respective logical operations. They _only_ perform an assignment if the logical operation would evaluate the right-hand side.

At first this may seem confusing. Why not unconditionally assign to the left-hand side like in other compound assignments?

There is a good practical reason for the difference. When combining logical operations with assignment, the assignment may cause a side-effect that should happen conditionally based on the result of that logical operation. Causing the side-effect unconditionally can negatively affect the performance or even correctness of the program.

Let’s make this concrete with an example of two versions of a function that sets a default message in an element.

```js
// Display a default message if it doesn’t override anything.
// Only assigns to innerHTML if it’s empty. Doesn’t cause inner
// elements of msgElement to lose focus.
function setDefaultMessage() {
  msgElement.innerHTML ||= '<p>No messages<p>';
}

// Display a default message if it doesn’t override anything.
// Buggy! May cause inner elements of msgElement to
// lose focus every time it’s called.
function setDefaultMessageBuggy() {
  msgElement.innerHTML = msgElement.innerHTML || '<p>No messages<p>';
}
```

:::note
**Note:** Because the `innerHTML` property is [specified](https://w3c.github.io/DOM-Parsing/#dom-innerhtml-innerhtml) to return the empty string instead of `null` or `undefined`, `||=` must be used instead of `??=`. When writing code, keep in mind that many web APIs do not use `null` or `undefined` to mean empty or absent.
:::

In HTML, assigning to the `.innerHTML` property on an element is destructive. Inner children are deleted, and new children parsed from the newly assigned string are inserted. Even when the new string is the same as the old string, it causes both additional work and the inner elements to lose focus. For this practical reason of not causing unwanted side-effects, the semantics of logical assignment operators short-circuit the assignment.

It may help to think about the symmetry with other compound assignment operators in the following way. Mathematical and bitwise operators are unconditional, and so the assignment is also unconditional. Logical operators are conditional, and so the assignment is also conditional.

## Logical assignment support { #support }

<feature-support chrome="85"
                 firefox="79 https://bugzilla.mozilla.org/show_bug.cgi?id=1629106"
                 safari="14 https://developer.apple.com/documentation/safari-release-notes/safari-14-beta-release-notes#New-Features:~:text=Added%20logical%20assignment%20operator%20support."
                 nodejs="no"
                 babel="yes https://babeljs.io/docs/en/babel-plugin-proposal-logical-assignment-operators"></feature-support>
