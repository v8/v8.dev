---
title: 'V8 release v6.0'
author: 'the V8 team'
date: 2017-06-09 13:33:37
tags:
  - release
---
Every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s Git master immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 6.0](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/6.0), which will be in beta until it is released in coordination with Chrome 60 Stable in several weeks. V8 6.0 is filled with all sorts of developer-facing goodies. We’d like to give you a preview of some of the highlights in anticipation of the release.

## SharedArrayBuffers

V8 6.0 introduces support for [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), a low-level mechanism to share memory between JavaScript workers and synchronize control flow across workers. SharedArrayBuffers give JavaScript access to shared memory, atomics, and futexes. SharedArrayBuffers also unlock the ability to port threaded applications to the web via asm.js or WebAssembly.

For a brief, low-level tutorial, see the spec [tutorial page](https://github.com/tc39/ecmascript_sharedmem/blob/master/TUTORIAL.md) or consult the [Emscripten documentation](https://kripken.github.io/emscripten-site/docs/porting/pthreads.html) for porting pthreads.

## Object rest/spread properties

This release introduces rest properties for object destructuring assignment and spread properties for object literals. Object rest/spread properties are Stage 3 ES.next features.

Spread properties also offer a terse alternative to `Object.assign()` in many situations.

```js
// Rest properties for object destructuring assignment:
const person = {
  firstName: 'Sebastian',
  lastName: 'Markbåge',
  country: 'USA',
  state: 'CA',
};
const { firstName, lastName, ...rest } = person;
console.log(firstName); // Sebastian
console.log(lastName); // Markbåge
console.log(rest); // { country: 'USA', state: 'CA' }

// Spread properties for object literals:
const personCopy = { firstName, lastName, ...rest };
console.log(personCopy);
// { firstName: 'Sebastian', lastName: 'Markbåge', country: 'USA', state: 'CA' }
```

For more information, see [our explainer on object rest and spread properties](/features/object-rest-spread).

## ES2015 Performance

V8 v6.0 continues to improve performance of ES2015 features. This release contains optimizations to language feature implementations that overall result in a roughly 10% improvement in V8’s [ARES-6](http://browserbench.org/ARES-6/) score.

## V8 API

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document is regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 6.0 -t branch-heads/6.0` to experiment with the new features in V8 6.0. Alternatively you can [subscribe to Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
