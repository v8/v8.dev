---
title: 'Optional `catch` binding'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2018-03-27
tags:
  - ECMAScript
  - ES2019
description: 'In ES2019, catch can now be used without a parameter.'
tweet: '956209997808939008'
---
The `catch` clause of `try` statements used to require a binding:

```js
try {
  doSomethingThatMightThrow();
} catch (exception) {
  //     ^^^^^^^^^
  // We must name the binding, even if we don’t use it!
  handleException();
}
```

In ES2019, `catch` can now be [used without a parameter](https://tc39.es/proposal-optional-catch-binding/). This is useful if you don’t have a need for the `exception` object in the code that handles the exception.

```js
try {
  doSomethingThatMightThrow();
} catch { // → No binding!
  handleException();
}
```

## Optional `catch` binding support { #support }

<feature-support chrome="66 /blog/v8-release-66#optional-catch-binding"
                 firefox="58 https://bugzilla.mozilla.org/show_bug.cgi?id=1380881"
                 safari="yes https://trac.webkit.org/changeset/220068/webkit"
                 nodejs="8"
                 babel="yes"></feature-support>
