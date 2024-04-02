---
title: 'Iterator helpers'
author: 'Rezvan Mahdavi Hezaveh'
avatars:
  - 'rezvan-mahdavi-hezaveh'
date: 2024-03-27
tags:
  - ECMAScript
description: 'Interfaces that help with general usage and consumption of iterators.'
tweet: ''
---

*Iterator helpers* are a collection of new methods on Iterator prototype that help in general use of iterators. Since these helper methods are on the iterator prototype, any object that has `Iterator.prototype` on its prototype chain (e.g. array iterators) will get the methods. In the following subsections, we explain iterator helpers. All the provided examples are working in a blog archive page that includes list of blog posts, illustrating how iterator helpers are helpful for finding and manupulating posts. You can try them on [V8 blog page](https://v8.dev/blog)!


## .map(mapperFn)

`map` takes a mapper function as an argument. This helper returns an iterator of values with the mapper function applied to the original iterator values.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Get the list of posts, return a list of their text content (titles) and log them.
for (const post of posts.values().map((x) => x.textContent)) {
  console.log(post);
}
```

## .filter(filtererFn)

`filter` takes a filter function as an argument. This helper returns an iterator of values from the original iterator for which the filter function returned a truthy value.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Filter blog posts that includes `V8` in their text content (titles) and log them.
for (const post of posts.values().filter((x) => x.textContent.includes('V8'))) {
  console.log(post);
} 
```

## .take(limit)

`take` takes a an integer as an argument. This helper returns an iterator of values from the original iterator, up to `limit` values.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Select 10 recent blog posts and log them.
for (const post of posts.values().take(10)) {
  console.log(post);
}
```

## .drop(limit)

`drop` takes a an integer as an argument. This helper returns an iterator of values from the original iterator, starting with the value after the `limit` values.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Drop 10 recent blog posts and log the rest of them.
for (const post of posts.values().drop(10)) {
  console.log(post);
}
```

## .flatMap(mapperFn)

`flatMap` takes a mapper function as an argument. This helper returns an iterator of the values of the iterators produced by applying the mapper function to the original iterator values. That is, the iterators returned by the mapper function are flattened into the iterator returned by this helper.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Get list of tags of the blog posts and log them. Each post can have more than
// one tag.
for (const tag of posts.values().flatMap((x) => x.querySelectorAll('.tag').values())) {
    console.log(tag.textContent);
}
```

## .reduce(reducer [, initialValue ])

`reduce` takes a reducer function and an optional initial value. This helper returns one value as a result of applying the reducer function to every value of the iterator while keeping track of the last result of applying the reducer. The initial value is used as the starting point for the reducer function when it processes the first value of the iterator.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Get list of tags for all posts.
const tagLists = posts.values().flatMap((x) => x.querySelectorAll('.tag').values());

// Get text context for each tag in the list.
const tags = tagLists.map((x) => x.textContent);

// Counts posts with security tag.
const count = tags.reduce((sum , value) => sum + (value === 'security' ? 1 : 0), 0);
console.log(count);
```

## .toArray()

`toArray` returns an array from iterator values. 

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Create an array from the list of 10 recent blog posts.
const arr = posts.values().take(10).toArray();
```

## .forEach(fn)

`forEach` takes a function as an argument and is applied on each element of the iterator. This helper is called for its side effect and returns `undefined`.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Get the dates that at least one blog post is published and log them.
const dates = new Set();
const forEach = posts.values().forEach((x) => dates.add(x.querySelector('time')));
console.log(dates);
```

## .some(fn)

`some` takes a predicate function as an argument. This helper returns `true` if any iterator element returns true when the function is applied to it. The iterator is consumed after `some` is called.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Find out if text content (title) of any blog post includes the `Iterators`
// keyword.
posts.values().some((x) => x.textContent.includes('Iterators'));
```

## .every(fn)

`every` takes a predicate function as an argument. This helper returns `true` if every iterator element returns true when the function is applied to it. The iterator is consumed after `every` is called.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Find out if text content (title) of all blog post includes the `V8` keyword.
posts.values().every((x) => x.textContent.includes('V8'));
```

## .find(fn)

`find` takes a predicate function as an argument. This helper returns the first value of the iterator for which the function returns a truthy value, or `undefined` if no value of the iterator does.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// Log the text content (title) of the recent blog post includes `V8` keyword.
console.log(posts.values().find((x) => x.textContent.includes('V8')).textContent);
```

## Iterator.from(object)

`from` is a static method and takes an object as an argument. If the `object` is already an instance of Iterator, the helper returns it directly. If the `object` has `Symbol.iterator`, which means it is an iterable, its `Symbol.iterator` method is called to get the iterator and the helper returns it. Otherwise, a new `Iterator` object (that inherit from `Iterator.prototype` and has `next()` and `return()` methods) is created that wraps the `object` and is returned by this helper.

```javascript
// Select the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('li:not(header li)');

// First create an iterator from the posts. Then, log the text content (title) of 
// the recent blog post that includes the `V8` keyword.
console.log(Iterator.from(posts).find((x) => x.textContent.includes('V8')).textContent);
```

## Availability

Iterator helpers are shipped in V8 v12.2.

## Iterator helpers support

<feature-support chrome="122 https://chromestatus.com/feature/5102502917177344"
                 firefox="no https://bugzilla.mozilla.org/show_bug.cgi?id=1568906"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=248650" 
                 nodejs="no"
                 babel="yes https://github.com/zloirock/core-js#iterator-helpers"></feature-support>
