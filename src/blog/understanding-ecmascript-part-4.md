---
title: 'Understanding the ECMAScript spec, part 4'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-05-06
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

In this episode, we take a deeper look into *cover grammars*. They are a way to specify grammar rules for syntactic constructs where we don't know what we're looking at until we've seen the complete construct.

Again, we'll skip the subscripts for `[In, Yield, Await]` for brevity, as they aren't important for this blog post. See [part 3](/blog/understanding-ecmascript-part-3) for an explanation of their meaning and usage.

## Parenthesized expression or an arrow parameter list?

Typically, parsers decide which grammar production to follow based on finite lookahead.

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

If the productions were written like this:

```grammar
AssignmentExpression :
...
ConditionalExpression (eventually leading to PrimaryExpression)
ArrowFunction

PrimaryExpression :
...
ParenthesizedExpression

ArrowFunction :
ArrowParameterList => ConciseBody
```

We couldn't choose the correct production with limited lookahead. Imagine we had to parse a `AssignmentExpression` and the next token is `(`. How would we decide what to parse next? We could either parse an `ParenthesizedExpression` or an `ArrowParameterList`, but our guess could go wrong.

### The very permissive new symbol: CPEAAPL

We'd like to specify the grammar in such a way that it's possible to parse JavaScript according to it with limited lookahead.

The spec solves this problem by introducing the symbol `CoverParenthesizedExpressionAndArrowParameterList` (`CPEAAPL` for short). `CPEAAPL` is a symbol that is actually an `ParenthesizedExpression` or an `ArrowParameterList` behind the scenes, but we don't yet know which one.

The [productions](https://tc39.es/ecma262/#prod-CoverParenthesizedExpressionAndArrowParameterList) for `CPEAAPL` are very permissive, allowing all constructs that can occur in `ParenthesizedExpression`s and in `ArrowParameterList`s:

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
ConditionalExpression (eventually leading to PrimaryExpression)
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

### Restricting CPEAAPLs

As we saw before, the grammar productions for `CPEAAPL` are very permissive and allow constructs (such as `(1, ...a)`) which are never valid. Once we know whether we were parsing an `ArrowFunction` or `ParenthesizedExpression`, we need to disallow the corresponding illegal constructs.

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

This means: if `CPEAAPL` occurs in the place of `PrimaryExpression` in the syntax tree, it is actually an `ParenthesizedExpression` and this is its only valid production.

`Expression` can never be empty, so `( )` is not a valid `ParenthesizedExpression`. Comma separated lists like `(1, 2, 3)` are created by [the comma operator](https://tc39.es/ecma262/#sec-comma-operator):

```grammar
Expression :
AssignmentExpression
Expression , AssignmentExpression
```

Similarly, if we try to use a `CPEAAPL` as an `ArrowParameters`, the following restrictions apply:

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

### Other CPEAAPL restrictions

There are also additional rules related to `CPEAAPL`s. For example:

:::ecmascript-algorithm
> [Static Semantics: Early Errors](https://tc39.es/ecma262/#sec-delete-operator-static-semantics-early-errors)
>
> `UnaryExpression: delete UnaryExpression`
>
> - It is a Syntax Error if the `UnaryExpression` is contained in strict mode code and the derived `UnaryExpression` is `PrimaryExpression : IdentifierReference`.
> - It is a Syntax Error if the derived `UnaryExpression` is
> `PrimaryExpression : CPEAAPL`
> and `CPEAAPL` ultimately derives a phrase that, if used in place of `UnaryExpression`, would produce a  Syntax Error according to these rules. This rule is recursively applied.

The first rule forbids `delete IdentifierReference` (for example, `delete foo`) in strict mode. The second rule forbids `CPEAAPL`s which would ultimately produce an `IdentifierReference`, such as `delete (foo)`, `delete ((foo))` and so on.

### Other cover grammars

In addition to `CPEAAPL`, the spec uses gover grammars for other ambiguous-looking constructs.

`ObjectLiteral` is used as a cover grammar for `ObjectAssignmentPattern` which occurs inside arrow function parameter lists. This means `ObjectLiteral` allows constructs which cannot occur inside actual object literals.

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

```javascript
let o = { a = 1 }; // syntax error

// Arrow function with a destructuring parameter with a default value:
let f = ({ a = 1 }) => { return a; };
f({}); // returns 1
f({a : 6}); // returns 6
```
Async arrow functions also look ambiguous with limited lookahead:

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

In this episode we looked into how the spec defines the grammar in such a way that implementing a finite lookahead parser based on it is straightforward.

In particular, we looked into how the spec uses a cover grammar for defining the productions for constructs for which we don't know in advance whether they're parenthesized expressions or arrow function parameters lists.