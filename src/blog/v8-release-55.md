---
title: 'V8 release v5.5'
author: 'the V8 team'
date: 2016-10-24 13:33:37
tags:
  - release
description: 'V8 v5.5 comes with reduced memory consumption and increased support for ECMAScript language features.'
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 5.5](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.5), which will be in beta until it is released in coordination with Chrome 55 Stable in several weeks. V8 v5.5 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release.

## Language features

### Async functions

In v5.5, V8 ships JavaScript ES2017 [async functions](https://developers.google.com/web/fundamentals/getting-started/primers/async-functions), which makes it easier to write code that uses and creates Promises. Using async functions, waiting for a Promise to resolve is as simple as typing await before it and proceeding as if the value were synchronously available - no callbacks required. See [this article](https://developers.google.com/web/fundamentals/getting-started/primers/async-functions) for an introduction.

Here’s an example function which fetches a URL and returns the text of the response, written in a typical asynchronous, Promise-based style.

```js
function logFetch(url) {
  return fetch(url)
    .then(response => response.text())
    .then(text => {
      console.log(text);
    }).catch(err => {
      console.error('fetch failed', err);
    });
}
```

Here’s the same code rewritten to remove callbacks, using async functions.

```js
async function logFetch(url) {
  try {
    const response = await fetch(url);
    console.log(await response.text());
  } catch (err) {
    console.log('fetch failed', err);
  }
}
```

## Performance improvements

V8 v5.5 delivers a number of key improvements in memory footprint.

### Memory

Memory consumption is an important dimension in the JavaScript virtual machine performance trade-off space. Over the last few releases, the V8 team analyzed and significantly reduced the memory footprint of several websites that were identified as representative of modern web development patterns. V8 5.5 reduces Chrome’s overall memory consumption by up to 35% on **low-memory devices** (compared to V8 5.3 in Chrome 53) due to reductions in the V8 heap size and zone memory usage. Other device segments also benefit from the zone memory reductions. Please have a look at the [dedicated blog post](/blog/optimizing-v8-memory) to get a detailed view.

## V8 API

Please check out our [summary of API changes](https://docs.google.com/document/d/1g8JFi8T_oAE_7uAri7Njtig7fKaPDfotU6huOa1alds/edit). This document is regularly updated a few weeks after each major release.

### V8 inspector migrated

The V8 inspector was migrated from Chromium to V8. The inspector code now fully resides in the [V8 repository](https://chromium.googlesource.com/v8/v8/+/master/src/inspector/).

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 5.5 -t branch-heads/5.5` to experiment with the new features in V8 5.5. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
