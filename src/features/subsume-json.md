---
title: 'Subsume JSON a.k.a. JSON ⊂ ECMAScript'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-08-14
tags:
  - ES2019
description: 'JSON is now a syntactic subset of ECMAScript.'
tweet: '1161649929904885762'
---
With [the _JSON ⊂ ECMAScript_ proposal](https://github.com/tc39/proposal-json-superset), JSON becomes a syntactic subset of ECMAScript. If you’re surprised that this wasn’t already the case, you’re not alone!

## The old ES2018 behavior { #old }

In ES2018, ECMAScript string literals couldn’t contain unescaped U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR characters, because they are considered to be line terminators even in that context:

```js
// A string containing a raw U+2028 character.
const LS = ' ';
// → ES2018: SyntaxError

// A string containing a raw U+2029 character, produced by `eval`:
const PS = eval('"\u2029"');
// → ES2018: SyntaxError
```

This is problematic because JSON strings _can_ contain these characters. As a result, developers had to implement specialized post-processing logic when embedding valid JSON into ECMAScript programs to handle these characters. Without such logic, the code would have subtle bugs, or even [security issues](#security)!

## The new behavior { #new }

In ES2019, string literals can now contain raw U+2028 and U+2029 characters, removing the confusing mismatch between ECMAScript and JSON.

```js
// A string containing a raw U+2028 character.
const LS = ' ';
// → ES2018: SyntaxError
// → ES2019: no exception

// A string containing a raw U+2029 character, produced by `eval`:
const PS = eval('"\u2029"');
// → ES2018: SyntaxError
// → ES2019: no exception
```

This small improvement greatly simplifies the mental model for developers (one less edge case to remember!), and reduces the need for specialized post-processing logic when embedding valid JSON into ECMAScript programs.

## Embedding JSON into JavaScript programs { #embedding-json }

As a result of this proposal, `JSON.stringify` can now be used to generate valid ECMAScript string literals, object literals, and array literals. And because of the separate [_well-formed `JSON.stringify`_ proposal](/features/well-formed-json-stringify), these literals can safely be represented in UTF-8 and other encodings (which is helpful if you’re trying to write them to a file on disk). This is super useful for metaprogramming use cases, like dynamically creating JavaScript source code and writing it to disk.

Here’s an example of creating a valid JavaScript program embedding a given data object, taking advantage of the JSON grammar now being a subset of ECMAScript:

```js
// A JavaScript object (or array, or string) representing some data.
const data = {
  LineTerminators: '\n\r  ',
  // Note: the string contains 4 characters: '\n\r\u2028\u2029'.
};

// Turn the data into its JSON-stringified form. Thanks to JSON ⊂
// ECMAScript, the output of `JSON.stringify` is guaranteed to be
// a syntactically valid ECMAScript literal:
const jsObjectLiteral = JSON.stringify(data);

// Create a valid ECMAScript program that embeds the data as an object
// literal.
const program = `const data = ${ jsObjectLiteral };`;
// → 'const data = {"LineTerminators":"…"};'
// (Additional escaping is needed if the target is an inline <script>.)

// Write a file containing the ECMAScript program to disk.
saveToDisk(filePath, program);
```

The above script produces the following code, which evaluates to an equivalent object:

```js
const data = {"LineTerminators":"\n\r  "};
```

## Embedding JSON into JavaScript programs with `JSON.parse` { #embedding-json-parse }

As explained in [_the cost of JSON_](/blog/cost-of-javascript-2019#json), instead of inlining the data as a JavaScript object literal, like so:

```js
const data = { foo: 42, bar: 1337 }; // 🐌
```

…the data can be represented in JSON-stringified form, and then JSON-parsed at runtime, for improved performance in the case of large objects (10 kB+):

```js
const data = JSON.parse('{"foo":42,"bar":1337}'); // 🚀
```

Here’s an example implementation:

```js
// A JavaScript object (or array, or string) representing some data.
const data = {
  LineTerminators: '\n\r  ',
  // Note: the string contains 4 characters: '\n\r\u2028\u2029'.
};

// Turn the data into its JSON-stringified form.
const json = JSON.stringify(data);

// Now, we want to insert the JSON into a script body as a JavaScript
// string literal per https://v8.dev/blog/cost-of-javascript-2019#json,
// escaping special characters like `"` in the data.
// Thanks to JSON ⊂ ECMAScript, the output of `JSON.stringify` is
// guaranteed to be a syntactically valid ECMAScript literal:
const jsStringLiteral = JSON.stringify(json);
// Create a valid ECMAScript program that embeds the JavaScript string
// literal representing the JSON data within a `JSON.parse` call.
const program = `const data = JSON.parse(${ jsStringLiteral });`;
// → 'const data = JSON.parse("…");'
// (Additional escaping is needed if the target is an inline <script>.)

// Write a file containing the ECMAScript program to disk.
saveToDisk(filePath, program);
```

The above script produces the following code, which evaluates to an equivalent object:

```js
const data = JSON.parse("{\"LineTerminators\":\"\\n\\r  \"}");
```

[Google’s benchmark comparing `JSON.parse` with JavaScript object literals](https://github.com/GoogleChromeLabs/json-parse-benchmark) leverages this technique in its build step. The Chrome DevTools “copy as JS” functionality has been [simplified significantly](https://chromium-review.googlesource.com/c/chromium/src/+/1464719/9/third_party/blink/renderer/devtools/front_end/elements/DOMPath.js) by adopting a similar technique.

## A note on security { #security }

JSON ⊂ ECMAScript reduces the mismatch between JSON and ECMAScript in the case of string literals specifically. Since string literals can occur within other JSON-supported data structures such as objects and arrays, it also addresses those cases, as the above code examples show.

However, U+2028 and U+2029 are still treated as line terminator characters in other parts of the ECMAScript grammar. This means there are still cases where it’s unsafe to inject JSON into JavaScript programs. Consider this example, where a server injects some user-supplied content into an HTML response after running it through `JSON.stringify()`:

```ejs
<script>
  // Debug info:
  // User-Agent: <%= JSON.stringify(ua) %>
</script>
```

Note that the result of `JSON.stringify` is injected into a single-line comment within the script.

When used like in the above example, `JSON.stringify()` is guaranteed to return a single line. The problem is that what constitutes a “single line” [differs between JSON and ECMAScript](https://speakerdeck.com/mathiasbynens/hacking-with-unicode?slide=136). If `ua` contains an unescaped U+2028 or U+2029 character, we break out of the single-line comment and execute the rest of `ua` as JavaScript source code:

```html
<script>
  // Debug info:
  // User-Agent: "User-supplied string<U+2028>  alert('XSS');//"
</script>
<!-- …is equivalent to: -->
<script>
  // Debug info:
  // User-Agent: "User-supplied string
  alert('XSS');//"
</script>
```

:::note
**Note:** In the above example, the raw unescaped U+2028 character is represented as `<U+2028>` to make it easier to follow.
:::

JSON ⊂ ECMAScript doesn’t help here, since it only impacts string literals — and in this case, `JSON.stringify`’s output is injected in a position where it does not produce a JavaScript string literal directly.

Unless special post-processing for those two characters is introduced, the above code snippet presents a cross-site scripting vulnerability (XSS)!

:::note
**Note:** It’s crucially important to post-process user-controlled input to escape any special character sequences, depending on the context. In this particular case, we’re injecting into a `<script>` tag, so we must (also) [escape `</script`, `<script`, and `<!-​-`](https://mathiasbynens.be/notes/etago#recommendations).
:::

## JSON ⊂ ECMAScript support { #support }

<feature-support chrome="66 /blog/v8-release-66#json-ecmascript"
                 firefox="yes"
                 safari="yes"
                 nodejs="10"
                 babel="yes https://github.com/babel/babel/tree/master/packages/babel-plugin-proposal-json-strings"></feature-support>
