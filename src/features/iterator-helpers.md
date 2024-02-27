---
title: 'Iterator helpers'
author: 'Rezvan Mahdavi Hezaveh'
avatars:
  - ''
date: 2024-02-13
tags:
  - ECMAScript
description: 'Interfaces that help with general usage and consumption of iterators.'
tweet: ''
---

Look for more real life examples for iterators. Look at devtools code base. For-of examples (for of iter.map(..)). You are talking to developers

Section with problems, web compat. At the end, tell which browsers ship it.

https://2ality.com/2022/12/iterator-helpers.html
https://blog.delpuppo.net/iterate-like-a-pro-mastering-javascript-iterators-for-effortless-code 

What APIs return iterators? Try to find something

Una Kravets -> email or message. Ask about the examples



V8 shipped iterator helpers in v12.2. The introduced helpers are as follow:

## .map(mapperFn)

`map` takes a mapper function as an argument. This helper returns an iterator of values with the mapper function applied to the original iterator values.

```javascript
function* gen() {
  yield 42;
  yield 43;
}

const iter = gen();
const mapIterator = iter.map((x, i) => { 
return x + 2; 
});

mapIterator.next()
// {value: 44, done: false }
mapIterator.next()
// {value: 45, done: false }
mapIterator.next()
// {value: undefined, done: true }

```

## .filter(filtererFn)

`filter` takes a filter function as an argument. This helper returns an iterator of values from the original iterator that pass the filter function.

```javascript
function* gen() {
  yield 42;
  yield 43;
}

const iter = gen();
const filterIterator = iter.filter((x, i) => { 
return x%2 == 0; 
});

filterIterator.next()
// {value: 42, done: false }
filterIterator.next()
// {value: undefined, done: true }
```

## .take(limit)

`take` takes a an integer as an argument. This helper returns an iterator of values from the original iterator from 0 until the limit.

```javascript
// Sellect all elements with class = "example" from a webpage document and create an iterator form it
const items = document.querySelectorAll('.example');

// Log text context of the first two elements.
for (const item of items.values().take(2)) {
    console.log(item.textContext);
}
```

```javascript
function* gen() {
  yield 42;
  yield 43;
}

const iter = gen();
const takeIterator = iter.take(1);

takeIterator.next()
// {value: 42, done: false }
takeIterator.next()
// {value: undefined, done: true }
```

## .drop(limit)

`drop` takes a an integer as an argument. This helper returns an iterator of values from the original iterator after the limit.


```javascript
// Sellect all elements with class = "example" from a webpage document and create an iterator form it
const items = document.querySelectorAll('.example');
const iterator = items[Symbol.iterator]();

// Log text context of the elements after the first element.
for (const item of iterator.value().drop(1)) {
    console.log(item.textContext);
}
```

```javascript
function* gen() {
  yield 42;
  yield 43;
}

const iter = gen();
const dropIterator = iter.drop(1);

dropIterator.next()
// {value: 43, done: false }
dropIterator.next()
// {value: undefined, done: true }
```

## .flatMap(mapperFn)

`flatMap` takes a mapper function as an argument. This helper returns an iterator of flat values of the iterators produced by applying the mapper function to the original iterator values.

```javascript
const iter = ['It\'s Sunny in', '', 'California'].values();
const flatMapIterator = iter.flatMap(value => value.split(' ').values());

flatMapIterator.next()
// {value: 'It\'s', done: false}
flatMapIterator.next()
// {value: 'Sunny', done: false}
flatMapIterator.next()
// {value: 'in', done: false}
flatMapIterator.next()
// {value: '', done: false}
flatMapIterator.next()
// {value: 'California', done: false}
flatMapIterator.next()
// {value: undefined, done: true}
```

## .reduce(reducer [, initialValue ])

`reduce` takes a reducer function and an optional initial value. This helper returns ``one'' value as a result of applying the reducer function to every item of the iterator while keeping track of the last result of applying th reducer. The initial value will be used as the last result of applying reducer for applying it to the first item of the iterator.

```javascript

```

## .toArray()
`toArray` returns an Array 

```javascript

```

## .forEach(fn)

```javascript

```

## .some(fn)

```javascript

```

## .every(fn)

```javascript

```

## .find(fn)

```javascript

```

## Iterator.from(object)

```javascript

```
