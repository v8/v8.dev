---
title: '`Object.fromEntries`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias)), JavaScript whisperer'
avatars:
  - 'mathias-bynens'
date: 2019-06-18
tags:
  - ECMAScript
  - ES2019
  - io19
description: 'Object.fromEntries is a useful addition to the built-in JavaScript library that complements Object.entries.'
tweet: '1140993821897121796'
---
`Object.fromEntries` is a useful addition to the built-in JavaScript library. Before explaining what it does, it helps to understand the pre-existing `Object.entries` API.

## `Object.entries`

The `Object.entries` API has been around for a while.

<feature-support chrome="54"
                 firefox="47"
                 safari="10.1"
                 nodejs="7"
                 babel="yes"></feature-support>

For each key-value pair in an object, `Object.entries` gives you an array where the first element is the key, and the second element is the value.

`Object.entries` is especially useful in combination with `for`-`of`, as it enables you to very elegantly iterate over all key-value pairs in an object:

```js
const object = { x: 42, y: 50 };
const entries = Object.entries(object);
// → [['x', 42], ['y', 50]]

for (const [key, value] of entries) {
  console.log(`The value of ${key} is ${value}.`);
}
// Logs:
// The value of x is 42.
// The value of y is 50.
```

Unfortunately, there’s no easy way to go from the entries result back to an equivalent object… until now!

## `Object.fromEntries`

The new `Object.fromEntries` API performs the inverse of `Object.entries`. This makes it easy to reconstruct an object based on its entries:

```js
const object = { x: 42, y: 50 };
const entries = Object.entries(object);
// → [['x', 42], ['y', 50]]

const result = Object.fromEntries(entries);
// → { x: 42, y: 50 }
```

One common use case is transforming objects. You can now do this by iterating over its entries, and then using array methods you might already be familiar with:

```js
const object = { x: 42, y: 50, abc: 9001 };
const result = Object.fromEntries(
  Object.entries(object)
    .filter(([ key, value ]) => key.length === 1)
    .map(([ key, value ]) => [ key, value * 2 ])
);
// → { x: 84, y: 100 }
```

In this example, we’re `filter`ing the object to only get keys of length `1`, that is, only the keys `x` and `y`, but not the key `abc`. We then `map` over the remaining entries and return an updated key-value pair for each. In this example, we double each value by multiplying it by `2`. The end result is a new object, with only properties `x` and `y`, and the new values.

## Objects vs. maps

JavaScript also supports `Map`s, which are often a more suitable data structure than regular objects. So in code that you have full control over, you might be using maps instead of objects. However, as a developer, you do not always get to choose the representation. Sometimes the data you’re operating on comes from an external API or from some library function that gives you an object instead of a map.

`Object.entries` made it easy to convert objects into maps:

```js
const object = { language: 'JavaScript', coolness: 9001 };

// Convert the object into a map:
const map = new Map(Object.entries(object));
```

The inverse is equally useful: even if your code is using maps, you might need to serialize your data at some point, for example to turn it into JSON to send an API request. Or maybe you need to pass the data to another library that expects an object instead of a map. In these cases, you need to create an object based on the map data. `Object.fromEntries` makes this trivial:

```js
// Convert the map back into an object:
const objectCopy = Object.fromEntries(map);
// → { language: 'JavaScript', coolness: 9001 }
```

With both `Object.entries` and `Object.fromEntries` in the language, you can now easily convert between maps and objects.

### Warning: beware of data loss { #data-loss }

When converting maps into plain objects like in the above example, there’s a implicit assumption that each key stringifies uniquely. If this assumption does not hold, data loss occurs:

```js
const map = new Map([
  [{}, 'a'],
  [{}, 'b'],
]);
Object.fromEntries(map);
// → { '[object Object]': 'b' }
// Note: the value 'a' is nowhere to be found, since both keys
// stringify to the same value of '[object Object]'.
```

Before using `Object.fromEntries` or any other technique to convert a map into a object, make sure the map’s keys produce unique `toString` results.

## `Object.fromEntries` support { #support }

<feature-support chrome="73 /blog/v8-release-73#object.fromentries"
                 firefox="63"
                 safari="12.1"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="yes"></feature-support>
