---
title: 'Understanding the ECMAScript spec, part 4'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-05-19
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: ''
---

## Previous episodes

In [part 1](/blog/understanding-ecmascript-part-1), we read through a simple method — `Object.prototype.hasOwnProperty` — and the **abstract operations** it invokes. We familiarized ourselves with the shorthands `?` and `!` related to error handling. We encountered **language types**, **specification types**, **internal slots**, and **internal methods**.

In [part 2](/blog/understanding-ecmascript-part-2), we examined a simple grammar production and how its runtime semantics are defined. In [the extra content](/blog/extra/understanding-ecmascript-part-2-extra), we also followed a long grammar production chain from `AssignmentExpression` to `MemberExpression`.

In [part 3](/blog/understanding-ecmascript-part-3), we familiarized ourselves with the lexical grammar, the syntactic grammar, and the shorthands used for defining the syntactic grammar.

## Meanwhile in other parts of the Web

[Jason Orendorff](https://github.com/jorendorff) from Mozilla published [a great in-depth analysis of JS syntactic quirks](https://github.com/mozilla-spidermonkey/jsparagus/blob/master/js-quirks.md#readme). Even though the implementation details differ, every JS engine faces the same problems with these quirks.

## Cover grammars

In this episode, we take a deeper look into *cover grammars*. They are a way to specify the grammar for syntactic constructs which look ambiguous at first.

Again, we'll skip the subscripts for `[In, Yield, Await]` for brevity, as they aren't important for this blog post. See [part 3](/blog/understanding-ecmascript-part-3) for an explanation of their meaning and usage.

## Finite lookaheads

Typically, parsers decide which production to use based on a finite lookahead (a fixed amount of following tokens).

In some cases, the next token determines the production to use unambiguously. [For example](https://tc39.es/ecma262/#prod-UpdateExpression):

```grammar
UpdateExpression :
  LeftHandSideExpression
  LeftHandSideExpression ++
  LeftHandSideExpression --
  ++ UnaryExpression
  -- UnaryExpression
```

If we're parsing an `UpdateExpression` and the next token is `++` or `--`, we know the production to use right away. If the next token is neither, it's still not too bad: we can parse a `LeftHandSideExpression` starting from the position we're at, and figure out what to do after we've parsed it.

If the token following the `LeftHandSideExpression` is `++`, the production to use is `UpdateExpression : LeftHandSideExpression ++`. The case for `--` is similar. And if the token following the `LeftHandSideExpression` is neither `++` nor `--`, we use the production `UpdateExpression : LeftHandSideExpression`.

### Arrow function parameter list or a parenthesized expression?

Distinguishing arrow function parameter lists from parenthesized expressions is more complicated.

For example:

```javascript
let x = (a,
```

Is this the start of an arrow function, like this?

```javascript
let x = (a, b) => { return a + b };
```

Or maybe it's a parenthesized expression, like this?

```javascript
let x = (a, 3);
```

The parenthesized whatever-it-is can be arbitrarily long - we cannot know what it is based on a finite amount of tokens.

Let's imagine for a moment that we had the following straightforward productions:

```grammar
AssignmentExpression :
  ...
  ArrowFunction
  ParenthesizedExpression

ArrowFunction :
  ArrowParameterList => ConciseBody
```

Now we can't choose the production to use with a finite lookahead. If we had to parse a `AssignmentExpression` and the next token was `(`, how would we decide what to parse next? We could either parse an `ArrowParameterList` or a `ParenthesizedExpression`, but our guess could go wrong.

### The very permissive new symbol: `CPEAAPL`

The spec solves this problem by introducing the symbol `CoverParenthesizedExpressionAndArrowParameterList` (`CPEAAPL` for short). `CPEAAPL` is a symbol that is actually an `ParenthesizedExpression` or an `ArrowParameterList` behind the scenes, but we don't yet know which one.

The [productions](https://tc39.es/ecma262/#prod-CoverParenthesizedExpressionAndArrowParameterList) for `CPEAAPL` are very permissive, allowing all constructs that can occur in `ParenthesizedExpression`s and in `ArrowParameterList`s:

```grammar
CPEAAPL :
  ( Expression )
  ( Expression , )
  ( )
  ( ... BindingIdentifier )
  ( ... BindingPattern )
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

Trailing comma and the `...` can occur only in `ArrowParameterList`. Some constructs, like `b = 1` can occur in both, but they have different meanings: Inside `ParenthesizedExpression` it's an assignment, inside `ArrowParameterList` it's a parameter with a default value. Numbers and other `PrimaryExpressions` which are not valid parameter names (or parameter destructuring patterns) can only occur in `ParenthesizedExpression`. But they all can occur inside a `CPEAAPL`.

### Using `CPEAAPL` in productions

Now we can use the very permissive `CPEAAPL` in [`AssignmentExpression` productions](https://tc39.es/ecma262/#prod-AssignmentExpression). (Note: `ConditionalExpression` leads to `PrimaryExpression` via a long production chain which is not shown here.)

```grammar
AssignmentExpression :
  ConditionalExpression
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

Imagine we're again in the situation that we need to parse an `AssignmentExpression` and the next token is `(`. Now we can parse a `CPEAAPL` and figure out later what production to use. It doesn't matter whether we're parsing an `ArrowFunction` or a `ConditionalExpression`, the next symbol to parse is `CPEAAPL` in any case!

After we've parsed the `CPEAAPL`, we can decide which production to use for the original `AssignmentExpression` (the one containing the `CPEAAPL`). This decision is made based on the token following the `CPEAAPL`.

If the token is `=>`, we use the production:

```grammar
AssignmentExpression :
  ArrowFunction
```

If the token is something else, we use the production:

```grammar
AssignmentExpression :
  ConditionalExpression
```

For example:

```javascript
let x = (a, b) => { return a + b; };
//      ^^^^^^
//     CPEAAPL
//             ^^
//             The token following the CPEAAPL

let x = (a, 3);
//      ^^^^^^
//     CPEAAPL
//            ^
//            The token following the CPEAAPL
```

At that point we can keep the `CPEAAPL` as is and continue parsing the rest of the program. For example, if the `CPEAAPL` is inside an `ArrowFunction`, we don't yet need to look at whether it's a valid arrow function parameter list or not - that can be done later. (Real-world parsers might choose to do the validity check right away, but from the spec point of view, we don't need to.)

### Restricting CPEAAPLs

As we saw before, the grammar productions for `CPEAAPL` are very permissive and allow constructs (such as `(1, ...a)`) which are never valid. After we've done parsing the program according to the grammar, we need to disallow the corresponding illegal constructs.

The spec does this by adding the following restrictions:

:::ecmascript-algorithm
> [Static Semantics: Early Errors](https://tc39.es/ecma262/#sec-grouping-operator-static-semantics-early-errors)
>
> `PrimaryExpression : CPEAAPL`
>
> It is a Syntax Error if `CPEAAPL` is not covering a `ParenthesizedExpression`.

:::ecmascript-algorithm
> [Supplemental Syntax](https://tc39.es/ecma262/#sec-primary-expression)
>
> When processing an instance of the production
>
> `PrimaryExpression : CPEAAPL`
>
> the interpretation of the `CPEAAPL` is refined using the following grammar:
>
> `ParenthesizedExpression : ( Expression )`

This means: if a `CPEAAPL` occurs in the place of `PrimaryExpression` in the syntax tree, it is actually an `ParenthesizedExpression` and this is its only valid production.

`Expression` can never be empty, so `( )` is not a valid `ParenthesizedExpression`. Comma separated lists like `(1, 2, 3)` are created by [the comma operator](https://tc39.es/ecma262/#sec-comma-operator):

```grammar
Expression :
  AssignmentExpression
  Expression , AssignmentExpression
```

Similarly, if a `CPEAAPL` occurs in the place of `ArrowParameters`, the following restrictions apply:

:::ecmascript-algorithm
> [Static Semantics: Early Errors](https://tc39.es/ecma262/#sec-arrow-function-definitions-static-semantics-early-errors)
>
> `ArrowParameters : CPEAAPL`
>
> It is a Syntax Error if `CPEAAPL` is not covering an `ArrowFormalParameters`.

:::ecmascript-algorithm
> [Supplemental Syntax](https://tc39.es/ecma262/#sec-arrow-function-definitions)
>
> When the production
>
> `ArrowParameters` : `CPEAAPL`
>
> is recognized the following grammar is used to refine the interpretation of `CPEAAPL`:
>
> `ArrowFormalParameters :`
> `( UniqueFormalParameters )`

### Other cover grammars

In addition to `CPEAAPL`, the spec uses cover grammars for other ambiguous-looking constructs.

`ObjectLiteral` is used as a cover grammar for `ObjectAssignmentPattern` which occurs inside arrow function parameter lists. This means that `ObjectLiteral` allows constructs which cannot occur inside actual object literals.

```grammar
ObjectLiteral :
  ...
  { PropertyDefinitionList }

PropertyDefinition :
  ...
  CoverInitializedName

CoverInitializedName :
  IdentifierReference Initializer

Initializer :
  = AssignmentExpression
```

For example:

```javascript
let o = { a = 1 }; // syntax error

// Arrow function with a destructuring parameter with a default
// value:
let f = ({ a = 1 }) => { return a; };
f({}); // returns 1
f({a : 6}); // returns 6
```

Async arrow functions also look ambiguous with a finite lookahead:

```javascript
let x = async(a,
```

Is this a call to a function called `async` or an async arrow function?

```javascript
let x1 = async(a, b);
let x2 = async();
function async() { }

let x3 = async(a, b) => {};
let x4 = async();
```

To this end, the grammar defines a cover grammar symbol `CoverCallExpressionAndAsyncArrowHead` which works similarly to `CPEAAPL`.

## Summary

In this episode we looked into how the spec defines cover grammars and uses them in cases where we cannot identify the current syntactic construct based on a finite lookahead.

In particular, we looked into distinguishing arrow function parameter lists from parenthesized expressions and how the spec uses a cover grammar for first parsing ambiguous-looking constructs permissively and restricting them with static semantic rules later.
