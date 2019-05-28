---
title: '`String.prototype.matchAll`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-02-02
tags:
  - ECMAScript
  - ES2020
  - io19
---
It’s common to repeatedly apply the same regular expression on a string to get all the matches. To some extent, this is already possible today by using the `String#match` method.

In this example, we find all words that consist of hexadecimal digits only, and then log each match:

```js
const string = 'Magic hex numbers: DEADBEEF CAFE';
const regex = /\b\p{ASCII_Hex_Digit}+\b/gu;
for (const match of string.match(regex)) {
  console.log(match);
}

// Output:
//
// 'DEADBEEF'
// 'CAFE'
```

However, this only gives you the _substrings_ that match. Usually, you don’t just want the substrings, you also want additional information such as the index of each substring, or the capturing groups within each match.

It’s already possible to achieve this by writing your own loop, and keeping track of the match objects yourself, but it’s a little annoying and not very convenient:

```js
const string = 'Magic hex numbers: DEADBEEF CAFE';
const regex = /\b\p{ASCII_Hex_Digit}+\b/gu;
let match;
while (match = regex.exec(string)) {
  console.log(match);
}

// Output:
//
// [ 'DEADBEEF', index: 19, input: 'Magic hex numbers: DEADBEEF CAFE' ]
// [ 'CAFE',     index: 28, input: 'Magic hex numbers: DEADBEEF CAFE' ]
```

The new `String#matchAll` API makes this easier than ever before: you can now write a simple `for`-`of` loop to get all the match objects.

```js
const string = 'Magic hex numbers: DEADBEEF CAFE';
const regex = /\b\p{ASCII_Hex_Digit}+\b/gu;
for (const match of string.matchAll(regex)) {
  console.log(match);
}

// Output:
//
// [ 'DEADBEEF', index: 19, input: 'Magic hex numbers: DEADBEEF CAFE' ]
// [ 'CAFE',     index: 28, input: 'Magic hex numbers: DEADBEEF CAFE' ]
```

`String#matchAll` is especially useful for regular expressions with capture groups. It gives you the full information for each individual match, including capturing groups.

```js
const string = 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev';
const regex = /\b(?<owner>[a-z0-9]+)\/(?<repo>[a-z0-9\.]+)\b/g;
for (const match of string.matchAll(regex)) {
  console.log(`${match[0]} at ${match.index} with '${match.input}'`);
  console.log(`→ owner: ${match.groups.owner}`);
  console.log(`→ repo: ${match.groups.repo}`);
}

// Output:
//
// tc39/ecma262 at 23 with 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev'
// → owner: tc39
// → repo: ecma262
// v8/v8.dev at 36 with 'Favorite GitHub repos: tc39/ecma262 v8/v8.dev'
// → owner: v8
// → repo: v8.dev
```

The general idea is that you just write a simple `for`-`of` loop, and `String#matchAll` takes care of the rest for you.

## `String.prototype.matchAll` support { #support }

<feature-support chrome="73 /blog/v8-release-73#string.prototype.matchall"
                 firefox="67"
                 safari="no"
                 nodejs="12"
                 babel="yes"></feature-support>
