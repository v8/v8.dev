---
title: 'Understanding the ECMAScript spec, part 4'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-05-01
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: '1245400717667577857'
---
…where we dive deep in the syntax!

## Previous episodes

In [part 1](/blog/understanding-ecmascript-part-1), we read through a simple method — `Object.prototype.hasOwnProperty` — and the **abstract operations** it invokes. We familiarized ourselves with the shorthands `?` and `!` related to error handling. We encountered **language types**, **specification types**, **internal slots**, and **internal methods**.

In [part 2](/blog/understanding-ecmascript-part-2), we examined a simple grammar production and how its runtime semantics are defined. In [the extra content](/blog/extra/understanding-ecmascript-part-2-extra), we also followed a long grammar production chain from `AssignmentExpression` to `MemberExpression`.

In [part 3](/blog/understanding-ecmascript-part-3), we familiarized ourselves with the lexical grammar, the syntactic grammar, and the shorthands used for defining the syntactic grammar.

## Meanwhile in other parts of the Web...

[Jason Orendorff](https://github.com/jorendorff) from Mozilla published [a great in-depth analysis of JS syntactic quirks](https://github.com/mozilla-spidermonkey/jsparagus/blob/master/js-quirks.md#readme). Even though the implelmentation differ, every JS engine faces the same problems with these quirks.

## Cover grammars


FIXME: intro

Again, we'll skip the subscripts for `[In, Yield, Await]` for brevity, as they aren't important for this blog post. See [part 2](/blog/understanding-ecmascript-part-2) for an explanation of their meaning and usage.

## Parenthesized expression or an arrow parameter list?

When parsing JavaScript, we need to decide which grammar production to follow based on finite lookahead.

For example:
```javascript
let x = (a,
```

Is this the start of an arrow function, like this?

```javascript
let x = (a, b) => { a + b };
```

Or maybe it's a parenthesized expression:

```javascript
let x = (a, 3);
```

The parenthesized whatever-it-is can be arbitrarily long - we cannot know what it is based on a finite amount of tokens.

If the productions were written like this:

```grammar
AssignmentExpression :
...
ConditionalExpression (leading eventually to PrimaryExpression)
ArrowFunction

PrimaryExpression :
...
ParenthesizedExpression

ArrowFunction :
ArrowParameterList => ConciseBody
```

... we'd be in trouble! Imagine we had to parse a `AssignmentExpression` and the next token is `(`. How would we decide what to parse next? We could either parse an `ParenthesizedExpression` or an `ArrowParameterList`, but our guess could go wrong.

FIXME: LR(1) maybe here

### The very permissive new symbol: CPEAAPL

The spec solves this problem by introducing the symbol `CoverParenthesizedExpressionAndArrowParameterList` (`CPEAAPL` for short). `CPEAAPL` is a symbol that is actually an `ParenthesizedExpression` or an `ArrowParameterList` behind the scenes, but we don't yet know which one.

The [productions](https://tc39.es/ecma262/#prod-CoverParenthesizedExpressionAndArrowParameterList) for `CPEAAPL` are pretty permissive, allowing all constructs that can occur in `ParenthesizedExpression`s and in `ArrowParameterList`s:

```grammar
CPEAAPL :
( Expression )
( Expression , )
( )
(... BindingIdentifier )
(... BindingPattern )
( Expression , ... BindingIdentifier )
( Expression , ... BindingPattern )
```

For example, the following expressions are valid `CPEAAPL`s:

```javascript
// Valid ParenthesizedExpression and ArrowParameterList:
(a, b)
(a, b = 1)

// Valid ParenthesizedExpression:
(1, 2, 3)
(function foo() { })

// Valid ArrowParameterList:
()
(a, b,)
(a, ...b)
(a = 1, ...b)

// Not valid either, but still a CPEAAPL:
(1, ...b)
(1, )
```

Trailing comma and the `...` can occur only in `ArrowParameterList`. Some constructs, like `b = 1` can occur in both, but they have different meanings: Inside `ParenthesizedExpression` it's an assignment, inside `ArrowParameterList` it's a parameter with a default value.

### Using CPEAAPL in grammar rules

Now we can use the very permissive `CPEAAPL` in grammar productions:

```grammar
AssignmentExpression :
ConditionalExpression (will eventually lead to PrimaryExpression)
ArrowFunction
...

ArrowFunction :
ArrowParameters => ConciseBody

ArrowParameters :
BindingIdentifier
CPEAAPL

PrimaryExpression :
...
CPEAAPL

```

Imagine we're again in the situation that we need to parse an `AssignmentExpression` and the next token is `(`. Now we can just decide to parse a `CPEAAPL` and figure out later what it actually is. It doesn't matter whether we're parsing an `ArrowFunction` or a `ParenthesizedExpression`, the next symbol to parse is `CPEAAPL` in any case!

After we've parsed the `CPEAAPL`, we can decide whether the original `AssignmentExpression` is an `ArrowFunction` or a `ParenthesizedExpression` based on the token following the `CPEAAPL`.

### Restricting CPEAAPLs

As we saw before, the grammar productions for `CPEAAPL` are very permissive and allow constructs (such as `(1, ... a)`) which are never valid. Once we know whether we were parsing an `ArrowFunction` or `ParenthesizedExpression`, we need to disallow the corresponding illegal constructs.

The spec does this by adding the following restrictions:

:::ecmascript-algorithm
> When processing an instance of the production
> `PrimaryExpression : CPEAAPL`
> the interpretation of the `CPEAAPL` is _refined_ by the following grammar
> `ParenthesizedExpression : ( Expression )`

This means: if we arrived at the `CPEAAPL` from `PrimaryExpression`, it is actually an `ParenthesizedExpression` and this is its only valid production.

`Expression` can never be empty, so `( )` is not a valid `ParenthesizedExpression`. The comma separated lists like `(1, 2, 3)` are created by [the comma operator](https://tc39.es/ecma262/#sec-comma-operator) via the following productions:

```grammar
Expression :
AssignmentExpression
Expression , AssignmentExpression
```

Similarly, if we were arrived at the `CPEAAPL` via `ArrowParameters`, the following restrictions apply:


FIXME: other cover grammars

FIXME: explain the term "covering"

FIXME: explain LR(1)

## Summary

FIXME: summary
