---
title: 'Promise combinators'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-06-12
tags:
  - ECMAScript
  - ES2020
  - ES2021
  - io19
  - Node.js 16
description: 'There are four promise combinators in JavaScript: Promise.all, Promise.race, Promise.allSettled, and Promise.any.'
tweet: '1138819493956710400'
---
Since the introduction of promises in ES2015, JavaScript has supported exactly two promise combinators: the static methods `Promise.all` and `Promise.race`.

Two new proposals are currently making their way through the standardization process: `Promise.allSettled`, and `Promise.any`. With those additions, there’ll be a total of four promise combinators in JavaScript, each enabling different use cases.

Here’s an overview of the four combinators:

:::table-wrapper
| name                                        | description                                     | status                                                          |
| ------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| [`Promise.allSettled`](#promise.allsettled) | does not short-circuit                          | [added in ES2020 ✅](https://github.com/tc39/proposal-promise-allSettled) |
| [`Promise.all`](#promise.all)               | short-circuits when an input value is rejected  | added in ES2015 ✅                                              |
| [`Promise.race`](#promise.race)             | short-circuits when an input value is settled   | added in ES2015 ✅                                              |
| [`Promise.any`](#promise.any)               | short-circuits when an input value is fulfilled | [added in ES2021 ✅](https://github.com/tc39/proposal-promise-any)        |
:::

Let’s take a look at an example use case for each combinator.

## `Promise.all`

<feature-support chrome="32"
                 firefox="29"
                 safari="8"
                 nodejs="0.12"
                 babel="yes https://github.com/zloirock/core-js#ecmascript-promise"></feature-support>

`Promise.all` lets you know when either all input promises have fulfilled or when one of them rejects.

Imagine the user clicks a button and you want to load some stylesheets so you can render a completely new UI. This program kicks off an HTTP request for each stylesheet in parallel:

```js
const promises = [
  fetch('/component-a.css'),
  fetch('/component-b.css'),
  fetch('/component-c.css'),
];
try {
  const styleResponses = await Promise.all(promises);
  enableStyles(styleResponses);
  renderNewUi();
} catch (reason) {
  displayError(reason);
}
```

You only want to start rendering the new UI once _all_ requests succeeded. If something goes wrong, you want to instead display an error message as soon as possible, without waiting for other any other work to finish.

In such a case, you could use `Promise.all`: you want to know when all promises are fulfilled, _or_ as soon as one of them rejects.

## `Promise.race`

<feature-support chrome="32"
                 firefox="29"
                 safari="8"
                 nodejs="0.12"
                 babel="yes https://github.com/zloirock/core-js#ecmascript-promise"></feature-support>

`Promise.race` is useful if you want to run multiple promises, and either…

1. do something with the first successful result that comes in (in case one of the promises fulfills), _or_
1. do something as soon as one of the promises rejects.

That is, if one of the promises rejects, you want to preserve that rejection to treat the error case separately. The following example does exactly that:

```js
try {
  const result = await Promise.race([
    performHeavyComputation(),
    rejectAfterTimeout(2000),
  ]);
  renderResult(result);
} catch (error) {
  renderError(error);
}
```

We kick off a computationally expensive task that might take a long time, but we race it against a promise that rejects after 2 seconds. Depending on the first promise to fulfill or reject, we either render the computed result, or the error message, in two separate code paths.

## `Promise.allSettled`

<feature-support chrome="76"
                 firefox="71 https://bugzilla.mozilla.org/show_bug.cgi?id=1549176"
                 safari="13"
                 nodejs="12.9.0 https://nodejs.org/en/blog/release/v12.9.0/"
                 babel="yes https://github.com/zloirock/core-js#ecmascript-promise"></feature-support>

`Promise.allSettled` gives you a signal when all the input promises are _settled_, which means they’re either _fulfilled_ or _rejected_. This is useful in cases where you don’t care about the state of the promise, you just want to know when the work is done, regardless of whether it was successful.

For example, you can kick off a series of independent API calls and use `Promise.allSettled` to make sure they’re all completed before doing something else, like removing a loading spinner:

```js
const promises = [
  fetch('/api-call-1'),
  fetch('/api-call-2'),
  fetch('/api-call-3'),
];
// Imagine some of these requests fail, and some succeed.

await Promise.allSettled(promises);
// All API calls have finished (either failed or succeeded).
removeLoadingIndicator();
```

## `Promise.any`

<feature-support chrome="85 https://bugs.chromium.org/p/v8/issues/detail?id=9808"
                 firefox="79 https://bugzilla.mozilla.org/show_bug.cgi?id=1568903"
                 safari="14 https://bugs.webkit.org/show_bug.cgi?id=202566"
                 nodejs="16"
                 babel="yes https://github.com/zloirock/core-js#ecmascript-promise"></feature-support>

`Promise.any` gives you a signal as soon as one of the promises fulfills. This is similar to `Promise.race`, except `any` doesn’t reject early when one of the promises rejects.

```js
const promises = [
  fetch('/endpoint-a').then(() => 'a'),
  fetch('/endpoint-b').then(() => 'b'),
  fetch('/endpoint-c').then(() => 'c'),
];
try {
  const first = await Promise.any(promises);
  // Any of the promises was fulfilled.
  console.log(first);
  // → e.g. 'b'
} catch (error) {
  // All of the promises were rejected.
  console.assert(error instanceof AggregateError);
  // Log the rejection values:
  console.log(error.errors);
  // → [
  //     <TypeError: Failed to fetch /endpoint-a>,
  //     <TypeError: Failed to fetch /endpoint-b>,
  //     <TypeError: Failed to fetch /endpoint-c>
  //   ]
}
```

This code example checks which endpoint responds the fastest, and then logs it. Only if _all_ of the requests fail do we end up in the `catch` block, where we can then handle the errors.

`Promise.any` rejections can represent multiple errors at once. To support this at the language-level, a new error type called `AggregateError` is introduced. In addition to its basic usage in the above example, `AggregateError` objects can also be programmatically constructed, just like the other error types:

```js
const aggregateError = new AggregateError([errorA, errorB, errorC], 'Stuff went wrong!');
```
