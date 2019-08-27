---
title: '`Promise.prototype.finally`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2017-10-23
tags:
  - ECMAScript
  - ES2018
description: 'Promise.prototype.finally enables registering a callback to be invoked when a promise is settled (i.e. either fulfilled or rejected).'
tweet: '922459978857824261'
---
`Promise.prototype.finally` enables registering a callback to be invoked when a promise is _settled_ (i.e. either fulfilled or rejected).

Imagine you want to fetch some data to show on the page. Oh, and you want to show a loading spinner when the request starts, and hide it when the request completes. When something goes wrong, you show an error message instead.

```js
const fetchAndDisplay = ({ url, element }) => {
  showLoadingSpinner();
  fetch(url)
    .then((response) => response.text())
    .then((text) => {
      element.textContent = text;
      hideLoadingSpinner();
    })
    .catch((error) => {
      element.textContent = error.message;
      hideLoadingSpinner();
    });
};

fetchAndDisplay({
  url: someUrl,
  element: document.querySelector('#output')
});
```

If the request succeeds, we display the data. If something goes wrong, we display an error message instead.

In either case we need to call `hideLoadingSpinner()`. Until now, we had no choice but to duplicate this call in both the `then()` and the `catch()` block. With `Promise.prototype.finally`, we can do better:

```js
const fetchAndDisplay = ({ url, element }) => {
  showLoadingSpinner();
  fetch(url)
    .then((response) => response.text())
    .then((text) => {
      element.textContent = text;
    })
    .catch((error) => {
      element.textContent = error.message;
    })
    .finally(() => {
      hideLoadingSpinner();
    });
};
```

Not only does this reduce code duplication, it also separates the success/error handling phase and the cleanup phase more clearly. Neat!

Currently, the same thing is possible with `async`/`await`, and without `Promise.prototype.finally`:

```js
const fetchAndDisplay = async ({ url, element }) => {
  showLoadingSpinner();
  try {
    const response = await fetch(url);
    const text = await response.text();
    element.textContent = text;
  } catch (error) {
    element.textContent = error.message;
  } finally {
    hideLoadingSpinner();
  }
};
```

Since [`async` and `await` are strictly better](https://mathiasbynens.be/notes/async-stack-traces), our recommendation remains to use them instead of vanilla promises. That said, if you prefer vanilla promises for some reason, `Promise.prototype.finally` can help make your code simpler and cleaner.

## `Promise.prototype.finally` support { #support }

<feature-support chrome="63 /blog/v8-release-63"
                 firefox="58"
                 safari="11.1"
                 nodejs="10"
                 babel="no"></feature-support>
