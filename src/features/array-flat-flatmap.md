---
title: '`Array.prototype.flat` and `Array.prototype.flatMap`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-06-11
tags:
  - ECMAScript
  - ES2019
  - io19
tweet: '1138457106380709891'
---
## `Array.prototype.flat` { #flat }

The array in this example is several levels deep: it contains an array which in turn contains another array.

```js
const array = [1, [2, [3]]];
//            ^^^^^^^^^^^^^ outer array
//                ^^^^^^^^  inner array
//                    ^^^   innermost array
```

`Array#flat` returns a flattened version of a given array.

```js
array.flat();
// → [1, 2, [3]]

// …is equivalent to:
array.flat(1);
// → [1, 2, [3]]
```

The default depth is `1`, but you can pass any number to recursively flatten up to that depth. To keep flattening recursively until the result contains no more nested arrays, we pass `Infinity`.

```js
// Flatten recursively until the array contains no more nested arrays:
array.flat(Infinity);
// → [1, 2, 3]
```

Why is this method known as `Array.prototype.flat` and not `Array.prototype.flatten`? [Read our #SmooshGate write-up to find out!](https://developers.google.com/web/updates/2018/03/smooshgate)

## `Array.prototype.flatMap` { #flatMap }

Here’s another example. We have a `duplicate` function that takes a value, and returns an array that contains that value twice. If we apply `duplicate` to each value in an array, we end up with a nested array.

```js
const duplicate = (x) => [x, x];

[2, 3, 4].map(duplicate);
// → [[2, 2], [3, 3], [4, 4]]
```

You can then call `flat` on the result to flatten the array:

```js
[2, 3, 4].map(duplicate).flat(); // 🐌
// → [2, 2, 3, 3, 4, 4]
```

Since this pattern is so common in functional programming, there’s now a dedicated `flatMap` method for it.

```js
[2, 3, 4].flatMap(duplicate); // 🚀
// → [2, 2, 3, 3, 4, 4]
```

`flatMap` is a little bit more efficient compared to doing a `map` followed by a `flat` separately.

## `Array#{flat,flatMap}` support { #support }

<feature-support chrome="69 /blog/v8-release-69#javascript-language-features"
                 firefox="62"
                 safari="12"
                 nodejs="11"
                 babel="yes"></feature-support>
