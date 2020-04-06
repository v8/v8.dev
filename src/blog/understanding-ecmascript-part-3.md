---
title: 'Understanding the ECMAScript spec, part 3'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-04-01
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: '1245400717667577857'
---
…where we dive deep in the syntax!

## Previous episodes

In [part 1](/blog/understanding-ecmascript-part-1), we read through a simple method — `Object.prototype.hasOwnProperty` — and the **abstract operations** it invokes. We familiarized ourselves with the shorthands `?` and `!` related to error handling. We encountered **language types**, **specification types**, **internal slots**, and **internal methods**.

In [part 2](/blog/understanding-ecmascript-part-2), we examined a simple grammar production and how its runtime semantics are defined. In [the extra content](/blog/extra/understanding-ecmascript-part-2-extra), we also followed a long grammar production chain from `AssignmentExpression` to `MemberExpression`. In this episode, we’ll go deeper in the definition of the ECMAScript language and its syntax.

If you’re not familiar with [context-free grammars](https://en.wikipedia.org/wiki/Context-free_grammar), now is a good time to check out the basics, since the spec uses context-free grammars to define the language.

## ECMAScript grammars

The ECMAScript spec defines four grammars:

The [lexical grammar](https://tc39.es/ecma262/#sec-ecmascript-language-lexical-grammar) describes how [Unicode code points](https://en.wikipedia.org/wiki/Unicode#Architecture_and_terminology) are translated into a sequence of **input elements** (tokens, line terminators, comments, white space).

The [syntactic grammar](https://tc39.es/ecma262/#sec-syntactic-grammar) defines how syntactically correct programs are composed of tokens.

The [RegExp grammar](https://tc39.es/ecma262/#sec-patterns) describes how Unicode code points are translated into regular expressions.

The [numeric string grammar](https://tc39.es/ecma262/#sec-tonumber-applied-to-the-string-type) describes how Strings are translated into numeric values.

Each grammar is defined as a context-free grammar, consisting of a set of productions.

The grammars use slightly different notation: the syntactic grammar uses `LeftHandSideSymbol :` whereas the lexical grammar and the RegExp grammar use `LeftHandSideSymbol ::` and the numeric string grammar uses `LeftHandSideSymbol :::`.

Next we’ll look into the lexical grammar and the syntactic grammar in more detail.

## Lexical grammar

The spec defines ECMAScript source text as a sequence of Unicode code points. For example, variable names are not limited to ASCII characters but can also include other Unicode characters. The spec doesn’t talk about the actual encoding (for example, UTF-8 or UTF-16). It assumes that the source code has already been converted into a sequence of Unicode code points according to the encoding it was in.

It’s not possible to tokenize ECMAScript source code in advance, which makes defining the lexical grammar slightly more complicated.

For example, we cannot determine whether `/` is the division operator or the start of a RegExp without looking at the larger context it occurs in:

```js
const x = 10 / 5;
```

Here `/` is a `DivPunctuator`.

```js
const r = /foo/;
```

Here the first `/` is the start of a `RegularExpressionLiteral`.

Templates introduce a similar ambiguity — the interpretation of <code>}`</code> depends on the context it occurs in:

```js
const what1 = 'temp';
const what2 = 'late';
const t = `I am a ${ what1 + what2 }`;
```

Here <code>\`I am a ${</code> is `TemplateHead` and <code>}\`</code> is a `TemplateTail`.

```js
if (0 == 1) {
}`not very useful`;
```

Here `}` is a `RightBracePunctuator` and <code>\`</code> is the start of a `NoSubstitutionTemplate`.

Even though the interpretation of `/` and <code>}`</code> depends on their “context” — their position in the syntactic structure of the code — the grammars we’ll describe next are still context-free.

The lexical grammar uses several goal symbols to distinguish between the contexts where some input elements are permitted and some are not. For example, the goal symbol `InputElementDiv` is used in contexts where `/` is a division and `/=` is a division-assignment. The [`InputElementDiv`](https://tc39.es/ecma262/#prod-InputElementDiv) productions list the possible tokens which can be produced in this context:

```grammar
InputElementDiv ::
  WhiteSpace
  LineTerminator
  Comment
  CommonToken
  DivPunctuator
  RightBracePunctuator
```

In this context, encountering `/` produces the `DivPunctuator` input element. Producing a `RegularExpressionLiteral` is not an option here.

On the other hand, [`InputElementRegExp`](https://tc39.es/ecma262/#prod-InputElementRegExp) is the goal symbol for the contexts where `/` is the beginning of a RegExp:

```grammar
InputElementRegExp ::
  WhiteSpace
  LineTerminator
  Comment
  CommonToken
  RightBracePunctuator
  RegularExpressionLiteral
```

As we see from the productions, it’s possible that this produces the `RegularExpressionLiteral` input element, but producing `DivPunctuator` is not possible.

Similarly, there is another goal symbol, `InputElementRegExpOrTemplateTail`, for contexts where `TemplateMiddle` and `TemplateTail` are permitted, in addition to `RegularExpressionLiteral`. And finally, `InputElementTemplateTail` is the goal symbol for contexts where only `TemplateMiddle` and `TemplateTail` are permitted but `RegularExpressionLiteral` is not permitted.

In implementations, the syntactic grammar analyzer (“parser”) may call the lexical grammar analyzer (“tokenizer” or “lexer”), passing the goal symbol as a parameter and asking for the next input element suitable for that goal symbol.

## Syntactic grammar

We looked into the lexical grammar, which defines how we construct tokens from Unicode code points. The syntactic grammar builds on it: it defines how syntactically correct programs are composed of tokens.

### Example: Allowing legacy identifiers

Introducing a new keyword to the grammar is a possibly breaking change — what if existing code already uses the keyword as an identifier?

For example, before `await` was a keyword, someone might have written the following code:

```js
function old() {
  var await;
}
```

The ECMAScript grammar carefully added the `await` keyword in such a way that this code continues to work. Inside async functions, `await` is a keyword, so this doesn’t work:

```js
async function modern() {
  var await; // Syntax error
}
```

Allowing `yield` as an identifier in non-generators and disallowing it in generators works similarly.

Understanding how `await` is allowed as an identifier requires understanding ECMAScript-specific syntactic grammar notation. Let’s dive right in!

### Productions and shorthands

Let’s look at how the productions for [`VariableStatement`](https://tc39.es/ecma262/#prod-VariableStatement) are defined. At the first glance, the grammar can look a bit scary:

```grammar
VariableStatement[Yield, Await] :
  var VariableDeclarationList[+In, ?Yield, ?Await] ;
```

What do the subscripts (`[Yield, Await]`) and prefixes (`+` in `+In` and `?` in `?Async`) mean?

The notation is explained in the section [Grammar Notation](https://tc39.es/ecma262/#sec-grammar-notation).

The subscripts are a shorthand for expressing a set of productions, for a set of left-hand side symbols, all at once. The left-hand side symbol has two parameters, which expands into four "real" left-hand side symbols: `VariableStatement`, `VariableStatement_Yield`, `VariableStatement_Await`, and `VariableStatement_Yield_Await`.

Note that here the plain `VariableStatement` means “`VariableStatement` without `_Await` and `_Yield`”. It should not be confused with <code>VariableStatement<sub>[Yield, Await]</sub></code>.

On the right-hand side of the production, we see the shorthand `+In`, meaning "use the version with `_In`", and `?Await`, meaning “use the version with `_Await` if and only if the left-hand side symbol has `_Await`” (similarly with `?Yield`).

The third shorthand, `~Foo`, meaning “use the version without `_Foo`”, is not used in this production.

With this information, we can expand the productions like this:

```grammar
VariableStatement :
  var VariableDeclarationList_In ;

VariableStatement_Yield :
  var VariableDeclarationList_In_Yield ;

VariableStatement_Await :
  var VariableDeclarationList_In_Await ;

VariableStatement_Yield_Await :
  var VariableDeclarationList_In_Yield_Await ;
```

Ultimately, we need to find out two things:

1. Where is it decided whether we’re in the case with `_Await` or without `_Await`?
2. Where does it make a difference — where do the productions for `Something_Await` and `Something` (without `_Await`) diverge?

### `_Await` or no `_Await`?

Let’s tackle question 1 first. It’s somewhat easy to guess that non-async functions and async functions differ in whether we pick the parameter `_Await` for the function body or not. Reading the productions for async function declarations, we find [this](https://tc39.es/ecma262/#prod-AsyncFunctionBody):

```grammar
AsyncFunctionBody :
  FunctionBody[~Yield, +Await]
```

Note that `AsyncFunctionBody` has no parameters — they get added to the `FunctionBody` on the right-hand side.

If we expand this production, we get:

```grammar
AsyncFunctionBody :
  FunctionBody_Await
```

In other words, async functions have `FunctionBody_Await`, meaning a function body where `await` is treated as a keyword.

On the other hand, if we’re inside a non-async function, [the relevant production](https://tc39.es/ecma262/#prod-FunctionDeclaration) is:

```grammar
FunctionDeclaration[Yield, Await, Default] :
  function BindingIdentifier[?Yield, ?Await] ( FormalParameters[~Yield, ~Await] ) { FunctionBody[~Yield, ~Await] }
```

(`FunctionDeclaration` has another production, but it’s not relevant for our code example.)

To avoid combinatorial expansion, let’s ignore the `Default` parameter which is not used in this particular production.

The expanded form of the production is:

```grammar
FunctionDeclaration :
  function BindingIdentifier ( FormalParameters ) { FunctionBody }

FunctionDeclaration_Yield :
  function BindingIdentifier_Yield ( FormalParameters ) { FunctionBody }

FunctionDeclaration_Await :
  function BindingIdentifier_Await ( FormalParameters ) { FunctionBody }

FunctionDeclaration_Yield_Await :
  function BindingIdentifier_Yield_Await ( FormalParameters ) { FunctionBody }
```

In this production we always get `FunctionBody` and `FormalParameters` (without `_Yield` and without `_Await`), since they are parameterized with `[~Yield, ~Await]` in the non-expanded production.

Function name is treated differently: it gets the parameters `_Await` and `_Yield` if the left-hand side symbol has them.

To summarize: Async functions have a `FunctionBody_Await` and non-async functions have a `FunctionBody` (without `_Await`). Since we’re talking about non-generator functions, both our async example function and our non-async example function are parameterized without `_Yield`.

Maybe it’s hard to remember which one is `FunctionBody` and which `FunctionBody_Await`. Is `FunctionBody_Await` for a function where `await` is an identifier, or for a function where `await` is a keyword?

You can think of the `_Await` parameter meaning "`await` is a keyword". This approach is also future proof. Imagine a new keyword, `blob` being added, but only inside "blobby" functions. Non-blobby non-async non-generators would still have `FunctionBody` (without `_Await`, `_Yield` or `_Blob`), exactly like they have now. Blobby functions would have a `FunctionBody_Blob`, async blobby functions would have `FunctionBody_Await_Blob` and so on. We’d still need to add the `Blob` subscript to the productions, but the expanded forms of `FunctionBody` for already existing functions stay the same.

### Disallowing `await` as an identifier

Next, we need to find out how `await` is disallowed as an identifier if we're inside a `FunctionBody_Await`.

We can follow the productions further to see that the `_Await` parameter gets carried unchanged from `FunctionBody` all the way to the `VariableStatement` production we were previously looking at.

Thus, inside an async function, we’ll have a `VariableStatement_Await` and inside a non-async function, we’ll have a `VariableStatement`.

We can follow the productions further and keep track of the parameters. We already saw the productions for [`VariableStatement`](https://tc39.es/ecma262/#prod-VariableStatement):

```grammar
VariableStatement[Yield, Await] :
  var VariableDeclarationList[+In, ?Yield, ?Await] ;
```

All productions for [`VariableDeclarationList`](https://tc39.es/ecma262/#prod-VariableDeclarationList) just carry the parameters on as is:

```grammar
VariableDeclarationList[In, Yield, Await] :
  VariableDeclaration[?In, ?Yield, ?Await]
```

(Here we show only the [production](https://tc39.es/ecma262/#prod-VariableDeclaration) relevant to our example.)

```grammar
VariableDeclaration[In, Yield, Await] :
  BindingIdentifier[?Yield, ?Await] Initializer[?In, ?Yield, ?Await] opt
```

The `opt` shorthand means that the right-hand side symbol is optional; there are in fact two productions, one with the optional symbol, and one without.

In the simple case relevant to our example, `VariableStatement` consists of the keyword `var`, followed by a single `BindingIdentifier` without an initializer, and ending with a semicolon.

To disallow or allow `await` as a `BindingIdentifier`, we hope to end up with something like this:

```grammar
BindingIdentifier_Await :
  Identifier
  yield

BindingIdentifier :
  Identifier
  yield
  await
```

This would disallow `await` as an identifier inside async functions and allow it as an identifier inside non-async functions.

But the spec doesn’t define it like this, instead we find this [production](https://tc39.es/ecma262/#prod-BindingIdentifier):

```grammar
BindingIdentifier[Yield, Await] :
  Identifier
  yield
  await
```

Expanded, this means the following productions:

```grammar
BindingIdentifier_Await :
  Identifier
  yield
  await

BindingIdentifier :
  Identifier
  yield
  await
```

(We’re omitting the productions for `BindingIdentifier_Yield` and `BindingIdentifier_Yield_Await` which are not needed in our example.)

This looks like `await` and `yield` would be always allowed as identifiers. What’s up with that? Is the whole blog post for nothing?

### Statics semantics to the rescue

It turns out that **static semantics** are needed for forbidding `await` as an identifier inside async functions.

Static semantics describe static rules — that is, rules that are checked before the program runs.

In this case, the [static semantics for `BindingIdentifier`](https://tc39.es/ecma262/#sec-identifiers-static-semantics-early-errors) define the following syntax-directed rule:

> ```grammar
> BindingIdentifier[Yield, Await] : await
> ```
>
> It is a Syntax Error if this production has an <code><sub>[Await]</sub></code> parameter.

Effectively, this forbids the `BindingIdentifier_Await : await` production.

The spec explains that the reason for having this production but defining it as a Syntax Error by the static semantics is because of interference with automatic semicolon insertion (ASI).

Remember that ASI kicks in when we’re unable to parse a line of code according to the grammar productions. ASI tries to add semicolons to satisfy the requirement that statements and declarations must end with a semicolon. (We’ll describe ASI in more detail in a later episode.)

Consider the following code (example from the spec):

```js
async function too_few_semicolons() {
  let
  await 0;
}
```

If the grammar disallowed `await` as an identifier, ASI would kick in and transform the code into the following grammatically correct code, which also uses `let` as an identifier:

```js
async function too_few_semicolons() {
  let;
  await 0;
}
```

This kind of interference with ASI was deemed too confusing, so static semantics were used for disallowing `await` as an identifier.

### Disallowed `StringValues` of identifiers

There’s also another related rule:

> ```grammar
> BindingIdentifier : Identifier
> ```
>
> It is a Syntax Error if this production has an <code><sub>[Await]</sub></code> parameter and `StringValue` of `Identifier` is `"await"`.

This might be confusing at first. [`Identifier`](https://tc39.es/ecma262/#prod-Identifier) is defined like this:

<!-- markdownlint-disable no-inline-html -->
```grammar
Identifier :
  IdentifierName but not ReservedWord
```
<!-- markdownlint-enable no-inline-html -->

`await` is a `ReservedWord`, so how can an `Identifier` ever be `await`?

As it turns out, `Identifier` cannot be `await`, but it can be something else whose `StringValue` is `"await"` — a different representation of the character sequence `await`.

[Static semantics for identifier names](https://tc39.es/ecma262/#sec-identifier-names-static-semantics-stringvalue) define how the `StringValue` of an identifier name is computed. For example, the Unicode escape sequence for `a` is `\u0061`, so `\u0061wait` has the `StringValue` `"await"`. `\u0061wait` won’t be recognized as a keyword by the lexical grammar, instead it will be an `Identifier`. The static semantics for forbid using it as a variable name inside async functions.

So this works:

```js
function old() {
  var \u0061wait;
}
```

And this doesn’t:

```js
async function modern() {
  var \u0061wait; // Syntax error
}
```

## Summary

In this episode, we familiarized ourselves with the lexical grammar, the syntactic grammar, and the shorthands used for defining the syntactic grammar. As an example, we looked into forbidding using `await` as an identifier inside async functions but allowing it inside non-async functions.

Other interesting parts of the syntactic grammar, such as automatic semicolon insertion and cover grammars will be covered in a later episode. Stay tuned!
