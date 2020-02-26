---
title: 'V8 release v8.1'
author: 'Dominik Inführ, international(ization) man of mystery'
avatars:
  - 'dominik-infuehr'
date: 2020-02-25
tags:
  - release
description: 'V8 v8.1 features improved internationalization support through the new Intl.DisplayNames API.'
---

Every six weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 8.1](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.1), which is in beta until its release in coordination with Chrome 81 Stable in several weeks. V8 v8.1 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### `Intl.DisplayNames`

The new `Intl.DisplayNames` API lets programmers display translated names of languages, regions, scripts, and currencies with ease.

```js
const zhLanguageNames = new Intl.DisplayNames(['zh-Hant'], { type: 'language' });
const enRegionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const itScriptNames = new Intl.DisplayNames(['it'], { type: 'script' });
const deCurrencyNames = new Intl.DisplayNames(['de'], {type: 'currency'});

zhLanguageNames.of('fr');
// → '法文'
enRegionNames.of('US');
// → 'United States'
itScriptNames.of('Latn');
// → 'latino'
deCurrencyNames.of('JPY');
// → 'Japanischer Yen'
```

Shift the burden of translation data maintenance to the runtime today! See [our feature explainer](https://v8.dev/features/intl-displaynames) for details on the full API and more examples.

## V8 API

Please use `git log branch-heads/8.0..branch-heads/8.1 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 8.1 -t branch-heads/8.1` to experiment with the new features in V8 v8.1. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
