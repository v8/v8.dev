---
title: 'V8 release v4.9'
author: 'the V8 team'
date: 2016-01-26 13:33:37
tags:
  - release
---
Roughly every six weeks, we create a new branch of V8 as part of our [release process](/docs/release-process). Each version is branched from V8’s git master immediately before Chrome branches for a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 4.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/4.9), which will be in beta until it is released in coordination with Chrome 49 Stable. V8 4.9 is filled with all sorts of developer-facing goodies, so we’d like to give you a preview of some of the highlights in anticipation of the release in several weeks.

## 91% ECMAScript 2015 (ES6) support

In V8 release 4.9 we shipped more JavaScript ES2015 features than in any other previous release, bringing us to 91% completion as measured by the [Kangax compatibility table](https://kangax.github.io/compat-table/es6/) (as of January 26). V8 now supports destructuring, default parameters, Proxy objects, and the Reflect API. Release 4.9 also makes block level constructs such as `class` and `let` available outside of strict mode and adds support for the sticky flag on regular expressions and customizable `Object.prototype.toString` output.

### Destructuring

Variable declarations, parameters, and assignments now support [destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment) of objects and arrays via patterns. For example:

```js
let o = {a: [1, 2, 3], b: {p: 4}, c: {q: 5}};
let {a: [x, y], b: {p}, c, d} = o;            // x=1, y=2, p=4, c={q: 5}
[x, y] = [y, x];                              // x=2, y=1
function f({a, b}) { return [a, b] }
f({a: 4})                                     // [4, undefined]
```

Array patterns can contain rest patterns that are assigned the remainder of the array:

```js
let [x, y, ...r] = [1, 2, 3, 4];              // x=1, y=2, r=[3,4]
```

Furthermore, pattern elements can be given default values, which are used in case the respective property has no match:

```js
let {a: x, b: y = x} = {a: 4};                // x=4, y=4
let [x, y = 0, z = 0] = [1, 2];               // x=1, y=2, z=0
```

Destructuring can be used to make accessing data from objects and arrays more compact.

### Proxies & Reflect

After years of development, V8 now ships with a complete implementation of [proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), up-to-date with the ES2015 spec. Proxies are a powerful mechanism for virtualizing objects and functions through a set of developer-provided hooks to customize property accesses. In addition to object virtualization, proxies can be used to implement interception, add validation for property setting, simplify debugging and profiling, and unlock advanced abstractions like [membranes](http://tvcutsem.github.io/js-membranes/).

To proxy an object, you must create a handler placeholder object that defines various traps and apply it to the target object which the proxy virtualizes:

```js
let target = {};
let handler = {
  get(target, name="world") {
    return `Hello, ${name}!`;
  }
};

let foo = new Proxy(target, handler);
foo.bar  // "Hello, bar!"
```

The Proxy object is accompanied by the Reflect module, which defines suitable defaults for all proxy traps:

```js
let debugMe = new Proxy({}, {
  get(target, name, receiver) {
    console.log(`Debug: get called for field: ${name}`);
    return Reflect.get(target, name, receiver);
  },
  set(target, name, value, receiver) {
    console.log(`Debug: set called for field: ${name}, and value: ${value}`);
    return Reflect.set(target, name, value, receiver);
  }
});

debugMe.name = "John Doe";
// Debug: set called for field: name, and value: John Doe
let title = `Mr. ${debugMe.name}`; // "Mr. John Doe"
// Debug: get called for field: name
```

For more information on the usage of Proxies and the Reflect API, see the examples section of the [MDN Proxy page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#Examples) and look out for our upcoming Proxies article on the [Web Fundamentals blog](https://developers.google.com/web/updates/).

### Default Parameters

In ES5 and below, optional parameters in function definitions required boilerplate code to check whether parameters were undefined:

```js
function sublist(list, start, end) {
  if (typeof start === "undefined") start = 0;
  if (typeof end === "undefined") end = list.length;
  ...
}
```

ES2015 now allows function parameters to have [default values](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), providing for clearer and more succinct function definitions:

```js
function sublist(list, start = 0, end = list.length) { ... }
sublist([1, 2, 3], 1)  // sublist([1, 2, 3], 1, 3)
```

Default parameters and destructuring can be combined, of course:

```js
function vector([x, y, z] = []) { ... }
```

### Classes & lexical declarations in sloppy mode

V8 has supported lexical declarations (`let`, `const`, block-local `function`) and classes since versions 4.1 and 4.2 respectively, but so far strict mode has been required in order to use them. As of V8 release 4.9, all of these features are now enabled outside of strict mode as well, per the ES2015 spec. This makes prototyping in the DevTools Console much easier, although we encourage developers in general to upgrade to strict mode for new code.

### Regular expressions

V8 now supports the new [sticky flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky) on regular expressions. The sticky flag toggles whether searches in strings start from the beginning of the string (normal) or from the `lastIndex` property (sticky). This behavior is useful for efficiently parsing arbitrarily long input strings with many different regular expressions. To enable sticky searching, add the `y` flag to a regex: (e.g. `var regex = /foo/y;` ).

### Customizable Object.prototype.toString output

Using `Symbol.toStringTag`, user-defined types can now return customized output when passed to `Object.prototype.toString` (either directly or as a result of string coercion):

```js
class Custom {
  get [Symbol.toStringTag]() {
    return "Custom"
  }
}
Object.prototype.toString.call(new Custom)  // "[object Custom]"
String(new Custom)                          // "[object Custom]"
```

## Improved Math.random()

V8 v4.9 includes an improvement in the implementation of `Math.random()`. [As announced last month](/blog/math-random), we switched V8’s PRNG algorithm to [xorshift128+](http://vigna.di.unimi.it/ftp/papers/xorshiftplus.pdf) in order to provide higher-quality pseudo-randomness.

## V8 API

Please check out our [summary of API changes](http://bit.ly/v8-api-changes). This document gets regularly updated a few weeks after each major release.

Developers with an [active V8 checkout](https://code.google.com/p/v8-wiki/wiki/UsingGit) can use `git checkout -b 4.9 -t branch-heads/4.9` to experiment with the new features in V8 v4.9. Alternatively you can subscribe to [Chrome's Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
