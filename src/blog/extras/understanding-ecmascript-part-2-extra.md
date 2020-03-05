---
title: 'Extra content for "Understanding the ECMAScript spec, part 2"'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-03-02
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: ''
---

### Why is `o2.foo` an `AssignmentExpression`?

`o2.foo` doesn’t look like an `AssignmentExpression` since there’s no assignment. Why is it an `AssignmentExpression`?

The spec actually allows an `AssignmentExpression` both as an argument and as the right hand side of an assignment. For example:

```js
function simple(a) {
  console.log('The argument was ' + a);
}
simple(x = 1);
// → Logs “The argument was 1”.
x;
// → 1
```

…and…

```js
x = y = 5;
x; // 5
y; // 5
```

`o2.foo` is an `AssignmentExpression` which doesn't assign anything. This follows from the following grammar productions, each one taking the "simplest" case until the last one:

An `AssignmentExpresssion` doesn't need to have an assignment, it can also be just a `ConditionalExpression`:

> **[`AssignmentExpression : ConditionalExpression`](https://tc39.es/ecma262/#sec-assignment-operators)**

(There are other productions too, here we show only the relevant one.)

A `ConditionalExpression` doesn't need to have a conditional (`a == b ? c : d`), it can also be just a `ShortcircuitExpression`:

> **[`ConditionalExpression : ShortCircuitExpression`](https://tc39.es/ecma262/#sec-conditional-operator)**

And so on:

> [`ShortCircuitExpression : LogicalORExpression`](https://tc39.es/ecma262/#prod-ShortCircuitExpression)
>
> [`LogicalORExpression : LogicalANDExpression`](https://tc39.es/ecma262/#prod-LogicalORExpression)
>
> [`LogicalANDExpression : BitwiseORExpression`](https://tc39.es/ecma262/#prod-LogicalANDExpression)
>
> [`BitwiseORExpression : BitwiseXORExpression`](https://tc39.es/ecma262/#prod-BitwiseORExpression)
>
> [`BitwiseXORExpression : BitwiseANDExpression`](https://tc39.es/ecma262/#prod-BitwiseXORExpression)
>
> [`BitwiseANDExpression : EqualityExpression`](https://tc39.es/ecma262/#prod-BitwiseANDExpression)
>
> [`EqualityExpression : RelationalExpression`](https://tc39.es/ecma262/#sec-equality-operators)
>
> [`RelationalExpression : ShiftExpression`](https://tc39.es/ecma262/#prod-RelationalExpression)

Almost there…

> [`ShiftExpression : AdditiveExpression`](https://tc39.es/ecma262/#prod-ShiftExpression)
>
> [`AdditiveExpression : MultiplicativeExpression`](https://tc39.es/ecma262/#prod-AdditiveExpression)
>
> [`MultiplicativeExpression : ExponentialExpression`](https://tc39.es/ecma262/#prod-MultiplicativeExpression)
>
> [`ExponentialExpression : UnaryExpression`](https://tc39.es/ecma262/#prod-ExponentiationExpression)

Don’t despair! Just a couple of more productions…

> [`UnaryExpression : UpdateExpression`](https://tc39.es/ecma262/#prod-UnaryExpression)
>
> [`UpdateExpression : LeftHandSideExpression`](https://tc39.es/ecma262/#prod-UpdateExpression)

Then we hit the productions for `LeftHandSideExpression`:

> [`LeftHandSideExpression :`](https://tc39.es/ecma262/#prod-LeftHandSideExpression)
> `NewExpression`
> `CallExpression`
> `OptionalExpression`

It’s not clear which production might apply to `o2.foo`. We just need to know (or find out) that a `NewExpression` doesn’t actually have to have the `new` keyword.

> [`NewExpression : MemberExpression`](https://tc39.es/ecma262/#prod-NewExpression)

`MemberExpression` sounds like something we were looking for, so now we take the production

> [`MemberExpression : MemberExpression . IdentifierName`](https://tc39.es/ecma262/#prod-MemberExpression)

So, `o2.foo` is a `MemberExpression` if `o2` is a valid `MemberExpression`. Luckily it's much easier to see:

> [`MemberExpression : PrimaryExpression`](https://tc39.es/ecma262/#prod-MemberExpression)
>
> [`PrimaryExpression : IdentifierReference`](https://tc39.es/ecma262/#prod-PrimaryExpression)
>
> [`IdentifierReference : Identifier`](https://tc39.es/ecma262/#prod-IdentifierReference)

`o2` is surely an `Identifier` so we're good. `o2` is a `MemberExpression`, so `o2.foo` is also a `MemberExpression`. A `MemberExpression` is a valid `AssignmentExpression`, so `o2.foo` is an `AssignmentExpression` too.
