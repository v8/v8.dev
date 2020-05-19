---
title: '`String.prototype.replaceAll`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-11-11
tags:
  - ECMAScript
description: 'JavaScript now has first-class support for global substring replacement through the new `String.prototype.replaceAll` API.'
tweet: '1193917549060280320'
---
If you’ve ever dealt with strings in JavaScript, chances are you came across the `String#replace` method. `String.prototype.replace(searchValue, replacement)` returns a string with some matches replaced, based on the parameters you specify:

```js
'abc'.replace('b', '_');
// → 'a_c'

'🍏🍋🍊🍓'.replace('🍏', '🥭');
// → '🥭🍋🍊🍓'
```

A common use case is replacing _all_ instances of a given substring. However, `String#replace` doesn’t directly address this use case. When `searchValue` is a string, only the first occurrence of the substring gets replaced:

```js
'aabbcc'.replace('b', '_');
// → 'aa_bcc'

'🍏🍏🍋🍋🍊🍊🍓🍓'.replace('🍏', '🥭');
// → '🥭🍏🍋🍋🍊🍊🍓🍓'
```

To work around this, developers often turn the search string into a regular expression with the global (`g`) flag. This way, `String#replace` does replace _all_ matches:

```js
'aabbcc'.replace(/b/g, '_');
// → 'aa__cc'

'🍏🍏🍋🍋🍊🍊🍓🍓'.replace(/🍏/g, '🥭');
// → '🥭🥭🍋🍋🍊🍊🍓🍓'
```

As a developer, it’s annoying to have to do this string-to-regexp conversion if all you really want is a global substring replacement. More importantly, this conversion is error-prone, and a common source of bugs! Consider the following example:

```js
const queryString = 'q=query+string+parameters';

queryString.replace('+', ' ');
// → 'q=query string+parameters' ❌
// Only the first occurrence gets replaced.

queryString.replace(/+/, ' ');
// → SyntaxError: invalid regular expression ❌
// As it turns out, `+` is a special character within regexp patterns.

queryString.replace(/\+/, ' ');
// → 'q=query string+parameters' ❌
// Escaping special regexp characters makes the regexp valid, but
// this still only replaces the first occurrence of `+` in the string.

queryString.replace(/\+/g, ' ');
// → 'q=query string parameters' ✅
// Escaping special regexp characters AND using the `g` flag makes it work.
```

Turning a string literal like `'+'` into a global regular expression is not just a matter of removing the `'` quotes, wrapping it into `/` slashes, and appending the `g` flag — we must escape any characters that have a special meaning in regular expressions. This is easy to forget, and hard to get right, since JavaScript doesn’t offer a built-in mechanism to escape regular expression patterns.

An alternate workaround is to combine `String#split` with `Array#join`:

```js
const queryString = 'q=query+string+parameters';
queryString.split('+').join(' ');
// → 'q=query string parameters'
```

This approach avoids any escaping but comes with the overhead of splitting the string into an array of parts only to glue it back together.

Clearly, none of these workarounds are ideal. Wouldn’t it be nice if a basic operation such as global substring replacement would be straightforward in JavaScript?

## `String.prototype.replaceAll`

The new `String#replaceAll` method solves these problems and provides a straightforward mechanism to perform global substring replacement:

```js
'aabbcc'.replaceAll('b', '_');
// → 'aa__cc'

'🍏🍏🍋🍋🍊🍊🍓🍓'.replaceAll('🍏', '🥭');
// → '🥭🥭🍋🍋🍊🍊🍓🍓'

const queryString = 'q=query+string+parameters';
queryString.replaceAll('+', ' ');
// → 'q=query string parameters'
```

For consistency with the pre-existing APIs in the language, `String.prototype.replaceAll(searchValue, replacement)` behaves exactly like `String.prototype.replace(searchValue, replacement)`, with the following two exceptions:

1. If `searchValue` is a string, then `String#replace` only replaces the first occurrence of the substring, while `String#replaceAll` replaces _all_ occurrences.
1. If `searchValue` is a non-global RegExp, then `String#replace` replaces only a single match, similar to how it behaves for strings. `String#replaceAll` on the other hand throws an exception in this case, since this is probably a mistake: if you really want to “replace all” matches, you’d use a global regular expression; if you only want to replace a single match, you can use `String#replace`.

The important piece of new functionality lies in that first item. `String.prototype.replaceAll` enriches JavaScript with first-class support for global substring replacement, without the need for regular expressions or other workarounds.

## `String.prototype.replaceAll` support { #support }

An experimental implementation of `String.prototype.replaceAll` is available in V8 v8.0 behind the `--harmony-string-replaceall` flag.

<feature-support chrome="85 https://bugs.chromium.org/p/v8/issues/detail?id=9801"
                 firefox="77 https://bugzilla.mozilla.org/show_bug.cgi?id=1608168#c8"
                 safari="13.1 https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/"
                 nodejs="no"
                 babel="yes"></feature-support>
