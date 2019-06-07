---
title: 'Stable `Array.prototype.sort`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-05-16
tags:
  - ECMAScript
  - ES2019
  - io19
tweet: '1036626116654637057'
---
Let’s say you have an array of dogs, where each dog has a name and a rating. (If this sounds like a weird example, you should know that there’s a Twitter account that specializes in exactly this… Don’t ask!)

```js
// Note how the array is pre-sorted alphabetically by `name`.
const doggos = [
  { name: 'Abby',    rating: 12 },
  { name: 'Bandit',  rating: 13 },
  { name: 'Choco',   rating: 14 },
  { name: 'Daisy',   rating: 12 },
  { name: 'Elmo',    rating: 12 },
  { name: 'Falco',   rating: 13 },
  { name: 'Ghost',   rating: 14 },
];
// Sort the dogs by `rating` in descending order.
// (This updates `doggos` in place.)
doggos.sort((a, b) => b.rating - a.rating);
```

The array is pre-sorted alphabetically by name. To sort by rating instead (so we get the highest-rated dogs first), we use `Array#sort`, passing in a custom callback that compares the ratings. This is the result that you’d probably expect:

```js
[
  { name: 'Choco',   rating: 14 },
  { name: 'Ghost',   rating: 14 },
  { name: 'Bandit',  rating: 13 },
  { name: 'Falco',   rating: 13 },
  { name: 'Abby',    rating: 12 },
  { name: 'Daisy',   rating: 12 },
  { name: 'Elmo',    rating: 12 },
]
```

The dogs are sorted by rating, but within each rating, they’re still sorted alphabetically by name. For example, Choco and Ghost have the same rating of 14, but Choco appears before Ghost in the sort result, because that’s the order they had in the original array as well.

To get this result however, the JavaScript engine can’t just use _any_ sorting algorithm — it has to be a so-called “stable sort”. For a long time, the JavaScript spec didn’t require sort stability for `Array#sort`, and instead left it up to the implementation. And because this behavior was unspecified, you could also get this sort result, where Ghost now suddenly appears before Choco:

```js
[
  { name: 'Ghost',   rating: 14 }, // 😢
  { name: 'Choco',   rating: 14 }, // 😢
  { name: 'Bandit',  rating: 13 },
  { name: 'Falco',   rating: 13 },
  { name: 'Abby',    rating: 12 },
  { name: 'Daisy',   rating: 12 },
  { name: 'Elmo',    rating: 12 },
]
```

In other words, JavaScript developers could not rely on sort stability. In practice, the situation was even more infuriating, since some JavaScript engines would use a stable sort for short arrays and an unstable sort for larger arrays. This was really confusing, as developers would test their code, see a stable result, but then suddenly get an unstable result in production when the array was slightly bigger.

But there’s some good news. We [proposed a spec change](https://github.com/tc39/ecma262/pull/1340) that makes `Array#sort` stable, and it was accepted. All major JavaScript engines now implement a stable `Array#sort`. It’s just one less thing to worry about as a JavaScript developer. Nice!

(Oh, and [we did the same thing for `TypedArray`s](https://github.com/tc39/ecma262/pull/1433): that sort is now stable as well.)

## Feature support { #support }

### Stable `Array.prototype.sort` { #support-stable-array-sort }

<feature-support chrome="70 /blog/v8-release-70#javascript-language-features"
                 firefox="yes"
                 safari="yes"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="no"></feature-support>

### Stable `%TypedArray%.prototype.sort` { #support-stable-typedarray-sort }

<feature-support chrome="74 https://bugs.chromium.org/p/v8/issues/detail?id=8567"
                 firefox="67 https://bugzilla.mozilla.org/show_bug.cgi?id=1290554"
                 safari="yes"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="no"></feature-support>
