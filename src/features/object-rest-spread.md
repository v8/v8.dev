---
title: 'Object rest and spread properties'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2017-06-06
tags:
  - ECMAScript
  - ES2018
description: 'This article explains how object rest and spread properties work in JavaScript, and revisits array rest and spread elements.'
tweet: '890269994688315394'
---
Before discussing _object rest and spread properties_, let’s take a trip down memory lane and remind ourselves of a very similar feature.

## ES2015 array rest and spread elements { #array-rest-spread }

Good ol’ ECMAScript 2015 introduced _rest elements_ for array destructuring assignment and _spread elements_ for array literals.

```js
// Rest elements for array destructuring assignment:
const primes = [2, 3, 5, 7, 11];
const [first, second, ...rest] = primes;
console.log(first); // 2
console.log(second); // 3
console.log(rest); // [5, 7, 11]

// Spread elements for array literals:
const primesCopy = [first, second, ...rest];
console.log(primesCopy); // [2, 3, 5, 7, 11]
```

<feature-support chrome="47"
                 firefox="16"
                 safari="8"
                 nodejs="6"
                 babel="yes"></feature-support>

## ES2018: object rest and spread properties 🆕 { #object-rest-spread }

So what’s new, then? Well, [a proposal](https://github.com/tc39/proposal-object-rest-spread) enables rest and spread properties for object literals, too.

```js
// Rest properties for object destructuring assignment:
const person = {
    firstName: 'Sebastian',
    lastName: 'Markbåge',
    country: 'USA',
    state: 'CA',
};
const { firstName, lastName, ...rest } = person;
console.log(firstName); // Sebastian
console.log(lastName); // Markbåge
console.log(rest); // { country: 'USA', state: 'CA' }

// Spread properties for object literals:
const personCopy = { firstName, lastName, ...rest };
console.log(personCopy);
// { firstName: 'Sebastian', lastName: 'Markbåge', country: 'USA', state: 'CA' }
```

Spread properties offer a more elegant alternative to [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign) in many situations:

```js
// Shallow-clone an object:
const data = { x: 42, y: 27, label: 'Treasure' };
// The old way:
const clone1 = Object.assign({}, data);
// The new way:
const clone2 = { ...data };
// Either results in:
// { x: 42, y: 27, label: 'Treasure' }

// Merge two objects:
const defaultSettings = { logWarnings: false, logErrors: false };
const userSettings = { logErrors: true };
// The old way:
const settings1 = Object.assign({}, defaultSettings, userSettings);
// The new way:
const settings2 = { ...defaultSettings, ...userSettings };
// Either results in:
// { logWarnings: false, logErrors: true }
```

However, there are some subtle differences in how spreading handles setters:

1. `Object.assign()` triggers setters; spread doesn’t.
1. You can stop `Object.assign()` from creating own properties via inherited read-only properties, but not the spread operator.

[Axel Rauschmayer’s write-up](http://2ality.com/2016/10/rest-spread-properties.html#spread-defines-properties-objectassign-sets-them) explains these gotchas in more detail.

<feature-support chrome="60"
                 firefox="55"
                 safari="11.1"
                 nodejs="8.6"
                 babel="yes"></feature-support>
