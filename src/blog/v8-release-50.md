---
title: 'V8 release v5.0'
author: 'the V8 team'
date: 2016-03-15 13:33:37
tags:
  - release
---
The first step in the V8 [release process](/docs/release-process) is a new branch from the git master immediately before Chromium branches for a Chrome Beta milestone (roughly every six weeks). Our newest release branch is [V8 5.0](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/5.0), which will remain in beta until we release a stable build in conjunction with Chrome 50 Stable. Here’s a highlight of the new developer-facing features in this version of V8.

:::note
**Note:** The version number 5.0 does not carry semantic significance or mark a major release (as opposed to a minor release).
:::

## Improved ECMAScript 2015 (ES6) support

V8 v5.0 contains a number of ES2015 features related to regular expression (regex) matching.

### RegExp Unicode flag

The [RegExp Unicode flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#Parameters), `u`, switches on a new Unicode mode for regular expression matching. The Unicode flag treats patterns and regex strings as a series of Unicode codepoints. It also exposes new syntax for Unicode codepoint escapes.

```js
/😊{2}/.test('😊😊');
// false

/😊{2}/u.test('😊😊');
// true

/\u{76}\u{38}/u.test('v8');
// true

/\u{1F60A}/u.test('😊');
// true
```

The `u` flag also makes the `.` atom (also known as the single character matcher) match any Unicode symbol rather than just the characters in the Basic Multilingual Plane (BMP).

```js
const string = 'the 🅛 train';

/the\s.\strain/.test(string);
// false

/the\s.\strain/u.test(string);
// true
```

### RegExp customization hooks

ES2015 includes hooks for RegExp subclasses to change the semantics of matching. Subclasses can override methods named `Symbol.match`, `Symbol.replace`, `Symbol.search`, and `Symbol.split` in order to change how RegExp subclasses behave with respect to `String.prototype.match` and similar methods.

## Performance improvements in ES2015 and ES5 features

Release 5.0 also brings a few notable performance improvements to already implemented ES2015 and ES5 features.

The implementation of rest parameters is 8-10x faster than that of the previous release, making it more efficient to gather large numbers of arguments into a single array after a function call. `Object.keys`, useful for iterating over an object’s enumerable properties in the same order returned by `for`-`in`, is now approximately 2x faster.

## V8 API

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://code.google.com/p/v8-wiki/wiki/UsingGit) can use `git checkout -b 5.0 -t branch-heads/5.0` to experiment with the new features in V8 5.0. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
