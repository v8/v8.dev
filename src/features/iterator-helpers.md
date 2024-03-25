---
title: 'Iterator helpers'
author: 'Rezvan Mahdavi Hezaveh'
avatars:
  - 'rezvan-mahdavi-hezaveh'
date: 2024-03-13
tags:
  - ECMAScript
description: 'Interfaces that help with general usage and consumption of iterators.'
tweet: ''
---

V8 shipped a collection of new methods on Iterator prototype (*Iterator helpers*) that help in general use of iterators in v12.2. The introduced helpers are as follow:


## .map(mapperFn)

`map` takes a mapper function as an argument. This helper returns an iterator of values with the mapper function applied to the original iterator values.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Get the list of posts, return a list of their text content and log them.
for (const post of posts.values().map((x) => { return x.textContent})) {
  console.log(post);
}
```

## .filter(filtererFn)

`filter` takes a filter function as an argument. This helper returns an iterator of values from the original iterator that pass the filter function.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Filter blog posts that includes `V8` in their text content and log them.
for (const post of posts.values().filter((x) => { return x.textContent.includes('V8')})) {
  console.log(post);
} 
```

## .take(limit)

`take` takes a an integer as an argument. This helper returns an iterator of values from the original iterator from 0 until the limit.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Select 10 recent blog posts and log them.
for (const post of posts.values().take(10)) {
  console.log(post);
}
```

## .drop(limit)

`drop` takes a an integer as an argument. This helper returns an iterator of values from the original iterator after the limit.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Drop 10 recent blog posts and log the rest of them.
for (const post of posts.values().drop(10)) {
  console.log(post);
}
```

## .flatMap(mapperFn)

`flatMap` takes a mapper function as an argument. This helper returns an iterator of flat values of the iterators produced by applying the mapper function to the original iterator values.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Get list of tags of the blog posts and log them. Each post can have more than one tag.
for (const tag of posts.values().flatMap((x) => x.querySelectorAll('.tag').values())) {
    console.log(tag.textContent);
}
```

## .reduce(reducer [, initialValue ])

`reduce` takes a reducer function and an optional initial value. This helper returns ``one'' value as a result of applying the reducer function to every item of the iterator while keeping track of the last result of applying th reducer. The initial value will be used as the last result of applying reducer for applying it to the first item of the iterator.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Get list of tags for all posts.
const tagLists = posts.values().flatMap((x) => x.querySelectorAll('.tag').values());

// Get text context for each tag in the list.
const tags = tags.map((x) => {return x.textContent});

// Counts posts with security tag.
const count = tags.reduce((sum , value) => { return sum + (value == 'security' ? 1: 0);}, 0);
```

## .toArray()
`toArray` returns an array form iterator values. 

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Create an array from the list of 10 recent blog posts.
const arr = posts.values().take(10).toArray();
```

## .forEach(fn)
`forEach` takes a function as an argument and is applied on each element of the itarator. This helper returns undefined.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Get the dates that at least one blog post is published and log them.
const dates = new Set();
const forEach = posts.values().forEach((x) => dates.add(x.querySelector('time')));
console.log(dates);
```

## .some(fn)
`some` takes a predicate function as an argument. This helper returns `true` if any iterator element returns true when the function is applied to it. Iterator is consumed after `.some` is called.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Find out if text content of any blog post includes `Iteartors` keyword.
posts.values().some(x => x.textContent.includes('Iterators'));
```

## .every(fn)
`every` takes a predicate function as an argument. This helper returns `true` if every iterator element returns true when the function is applied to it. Iterator is consumed after `.every` is called.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Find out if text content of all blog post includes `V8` keyword.
posts.values().every(x => x.textContent.includes('V8'));
```

## .find(fn)
`find` takes a predicate function as an argument. This helper returns the first element of the iterator that matches function, or `undefined` if no element of the iterator matches function.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// Log the text content of the recent blog post includes `V8` keyword.
console.log(posts.values().find(x => x.textContent.includes('V8')).textContent);
```

## Iterator.from(object)
`from` is a static method and takes an object as an argument. This helper returns an iterator wrapped around the object.

```javascript
// Sellect the list of blog posts from a blog archive page.
const posts = document.querySelectorAll('.post');

// First create an ietrator from the posts. Then, log the text content of the recent blog post includes `V8` keyword.
console.log(Iterator.from(posts).find(x => x.textContent.includes('V8')).textContent);
```

## Import attribute support

<feature-support chrome="122 https://chromestatus.com/feature/5102502917177344"
                 firefox="no https://bugzilla.mozilla.org/show_bug.cgi?id=1568906"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=248650" 
                 nodejs="no"
                 babel="no"></feature-support>
