---
title: 'RegExp match indices'
author: 'Maya Armyanova ([@Zmayski](https://twitter.com/Zmayski)), regularly expressing new features'
avatars:
  - 'maya-armyanova'
date: 2019-12-17
tags:
  - ECMAScript
  - Node.js 16
description: 'RegExp match indices provide `start` and `end` indices of each matched capture group.'
tweet: '1206970814400270338'
---
JavaScript is now equipped with a new regular expression enhancement, called “match indices”. Imagine you want to find invalid variable names in JavaScript code that coincide with reserved words, and output a caret and an “underline” under the variable name, like:

```js
const function = foo;
      ^------- Invalid variable name
```

In the example above, `function` is a reserved word and cannot be used as a variable name. For that we might write the following function:

```js
function displayError(text, message) {
  const re = /\b(continue|function|break|for|if)\b/d;
  const match = text.match(re);
  // Index `1` corresponds to the first capture group.
  const [start, end] = match.indices[1];
  const error = ' '.repeat(start) + // Adjust the caret position.
    '^' +
    '-'.repeat(end - start - 1) +   // Append the underline.
    ' ' + message;                  // Append the message.
  console.log(text);
  console.log(error);
}

const code = 'const function = foo;'; // faulty code
displayError(code, 'Invalid variable name');
```

:::note
**Note:** For simplicity, the above example contains only a few of the JavaScript [reserved words](https://mathiasbynens.be/notes/reserved-keywords).
:::

In short, the new `indices` array stores the start and end positions of each matched capture group. This new array is available when the source regular expression uses the `/d` flag for all builtins producing regular expression match objects, including `RegExp#exec`, `String#match`, and [`String#matchAll`](https://v8.dev/features/string-matchall).

Read on if you’re interested in how it works in more detail.

## Motivation

Let’s move to a more involved example and think about how you’d solve the task of parsing a programming language (for instance what the [TypeScript compiler](https://github.com/microsoft/TypeScript/tree/master/src/compiler) does) — first split the input source code into tokens, then give a syntactic structure to those tokens. If the user wrote some syntactically incorrect code, you’d want to present them with a meaningful error, ideally pointing to the location where the problematic code was first encountered. For example, given the following code snippet:

```js
let foo = 42;
// some other code
let foo = 1337;
```

We’d want to present the programmer with an error like:

```js
let foo = 1337;
    ^
SyntaxError: Identifier 'foo' has already been declared
```

To achieve this, we need a few building blocks, the first of which is recognizing TypeScript identifiers. Then we’ll focus on pinpointing the exact location where the error occurred. Let’s consider the following example, using a regex to tell whether a string is a valid identifier:

```js
function isIdentifier(name) {
  const re = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
  return re.exec(name) !== null;
}
```

:::note
**Note:** A real-world parser could make use of the newly introduced [property escapes in regexes](https://github.com/tc39/proposal-regexp-unicode-property-escapes#other-examples) and use the following regular expression for matching all valid ECMAScript identifier names:

```js
const re = /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u;
```

For simplicity, let’s stick to our previous regex, which matches only Latin characters, numbers, and underscores.
:::

If we encounter an error with a variable declaration like above and want to print the exact position to the user, we might want to extend the regex from above and use a similar function:

```js
function getDeclarationPosition(source) {
  const re = /(let|const|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/;
  const match = re.exec(source);
  if (!match) return -1;
  return match.index;
}
```

One could use the `index` property on the match object returned by `RegExp.prototype.exec`, which returns the starting position of the whole match. For use cases like the one described above though, you’d often want to use (possibly multiple) capture groups. Until recently, JavaScript didn’t expose the indices where the substrings matched by capture groups begin and end.

## RegExp match indices explained

Ideally we want to print an error at the position of the variable name, not at the `let`/`const` keyword (as the example above does). But for that we’d need to find the position of the capture group with index `2`. (Index `1` refers to the `(let|const|var)` capture group and `0` refers to the entire match.)

As mentioned above, [the new JavaScript feature](https://github.com/tc39/proposal-regexp-match-indices) adds an `indices` property on the result (the array of substrings) of `RegExp.prototype.exec()`. Let’s enhance our example from above to make use of this new property:

```js
function getVariablePosition(source) {
  // Notice the `d` flag, which enables `match.indices`
  const re = /(let|const|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/d;
  const match = re.exec(source);
  if (!match) return undefined;
  return match.indices[2];
}
getVariablePosition('let foo');
// → [4, 7]
```

This example returns the array `[4, 7]`, which is the `[start, end)` position of the matched substring from the group with index `2`. Based on this information, our compiler can now print the desired error.

## Additional features

The `indices` object also contains a `groups` property, which can be indexed by the names of the [named capture groups](https://mathiasbynens.be/notes/es-regexp-proposals#named-capture-groups). Using that, the function from above can be rewritten as:

```js
function getVariablePosition(source) {
  const re = /(?<keyword>let|const|var)\s+(?<id>[a-zA-Z_$][0-9a-zA-Z_$]*)/d;
  const match = re.exec(source);
  if (!match) return -1;
  return match.indices.groups.id;
}
getVariablePosition('let foo');
```

## Support for RegExp match indices

<feature-support chrome="90 https://bugs.chromium.org/p/v8/issues/detail?id=9548"
                 firefox="no https://bugzilla.mozilla.org/show_bug.cgi?id=1519483"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=202475"
                 nodejs="16"
                 babel="no"></feature-support>
