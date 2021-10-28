---
title: 'Error causes'
author: 'Victor Gomes ([@VictorBFG](https://twitter.com/VictorBFG))'
avatars:
  - 'victor-gomes'
date: 2021-07-07
tags:
  - ECMAScript
description: 'JavaScript now supports error causes.'
tweet: '1412774651558862850'
---

Imagine you have a function that is calling two separate work loads `doSomeWork` and `doMoreWork`. Both functions can throw the same kind of errors, but you need to handle them in different ways.

Catching the error and throwing it with additional contextual information is a common approach to this problem, for example:

```js
function doWork() {
  try {
    doSomeWork();
  } catch (err) {
    throw new CustomError('Some work failed', err);
  }
  doMoreWork();
}

try {
  doWork();
} catch (err) {
  // Is |err| coming from |doSomeWork| or |doMoreWork|?
}
```

Unfortunately the above solution is laborious, since one needs to create its own `CustomError`. And, even worse, no developer tool is capable of providing helpful diagnosing messages to unexpected exceptions, since there is no consensus on how to properly represent these errors.

What has been missing so far is a standard way to chain errors. JavaScript now supports error causes. An additional options parameter can be added to the `Error` constructor with a `cause` property, the value of which will be assigned to the error instances. Errors can then easily be chained.

```js
function doWork() {
  try {
    doSomeWork();
  } catch (err) {
    throw new Error('Some work failed', { cause: err });
  }
  try {
    doMoreWork();
  } catch (err) {
    throw new Error('More work failed', { cause: err });
  }
}

try {
  doWork();
} catch (err) {
  switch(err.message) {
    case 'Some work failed':
      handleSomeWorkFailure(err.cause);
      break;
    case 'More work failed':
      handleMoreWorkFailure(err.cause);
      break;
  }
}
```

This feature is available in V8 v9.3.

## Error causes support { #support }

<feature-support chrome="93 https://chromium-review.googlesource.com/c/v8/v8/+/2784681"
                 firefox="91 https://bugzilla.mozilla.org/show_bug.cgi?id=1679653"
                 safari="15 https://bugs.webkit.org/show_bug.cgi?id=223302"
                 nodejs="no"
                 babel="no"></feature-support>
