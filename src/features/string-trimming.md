---
title: '`String.prototype.trimStart` and `String.prototype.trimEnd`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2018-03-26
tags:
  - ECMAScript
  - ES2019
description: 'ES2019 introduces String.prototype.trimStart() and String.prototype.trimEnd().'
---
ES2019 introduces [`String.prototype.trimStart()` and `String.prototype.trimEnd()`](https://github.com/tc39/proposal-string-left-right-trim):

```js
const string = '  hello world  ';
string.trimStart();
// → 'hello world  '
string.trimEnd();
// → '  hello world'
string.trim(); // ES5
// → 'hello world'
```

This functionality was previously available through the non-standard `trimLeft()` and `trimRight()` methods, which remain as aliases of the new methods for backward compatibility.

```js
const string = '  hello world  ';
string.trimStart();
// → 'hello world  '
string.trimLeft();
// → 'hello world  '
string.trimEnd();
// → '  hello world'
string.trimRight();
// → '  hello world'
string.trim(); // ES5
// → 'hello world'
```

## `String.prototype.trim{Start,End}` support { #support }

<feature-support chrome="66 /blog/v8-release-66#string-trimming"
                 firefox="61"
                 safari="12"
                 nodejs="8"
                 babel="yes"></feature-support>
