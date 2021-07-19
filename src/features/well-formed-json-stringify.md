---
title: 'Well-formed `JSON.stringify`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2018-09-11
tags:
  - ECMAScript
  - ES2019
description: 'JSON.stringify now outputs escape sequences for lone surrogates, making its output valid Unicode (and representable in UTF-8).'
---
`JSON.stringify` was previously specified to return ill-formed Unicode strings if the input contains any lone surrogates:

```js
JSON.stringify('\uD800');
// → '"�"'
```

[The “well-formed `JSON.stringify`” proposal](https://github.com/tc39/proposal-well-formed-stringify) changes `JSON.stringify` so it outputs escape sequences for lone surrogates, making its output valid Unicode (and representable in UTF-8):

```js
JSON.stringify('\uD800');
// → '"\\ud800"'
```

Note that `JSON.parse(stringified)` still produces the same results as before.

This feature is a small fix that was long overdue in JavaScript. It’s one less thing to worry about as a JavaScript developer. In combination with [_JSON ⊂ ECMAScript_](/features/subsume-json), it enables safely embedding JSON-stringified data as literals into JavaScript programs, and writing the generated code to disk in any Unicode-compatible encoding (e.g. UTF-8). This is super useful for [metaprogramming use cases](/features/subsume-json#embedding-json).

## Feature support { #support }

<feature-support chrome="72 /blog/v8-release-72#well-formed-json.stringify"
                 firefox="64"
                 safari="12.1"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="yes https://github.com/zloirock/core-js#ecmascript-json"></feature-support>
