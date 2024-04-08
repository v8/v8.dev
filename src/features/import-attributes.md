---
title: 'Import attributes'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2024-01-31
tags:
  - ECMAScript
description: 'Import attributes: the evolution of import assertions'
tweet: ''
---

## Previously

V8 shipped the [import assertions](https://chromestatus.com/feature/5765269513306112) feature in v9.1. This feature allowed module import statements to include additional information by using the `assert` keyword. This additional information is currently used to import JSON and CSS modules inside JavaScript modules.

## Import attributes

Since then, import assertions has evolved into [import attributes](https://github.com/tc39/proposal-import-attributes). The point of the feature remains the same: to allow module import statements to include additional information.

The most important difference is that import assertions had assert-only semantics, while import attributes has more relaxed semantics. Assert-only semantics means that the additional information has no effect on _how_ a module is loaded, only on _whether_ it is loaded. For example, a JSON module is always loaded as JSON module by virtue of its MIME type, and the `assert { type: 'json' }` clause can only cause loading to fail if the requested module's MIME type is not `application/json`.

However, assert-only semantics had a fatal flaw. On the web, the shape of HTTP requests differs depending on the type of resource that is requested. For example, the [`Accept` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) affects the MIME type of the response, and the [`Sec-Fetch-Dest` metadata header](https://web.dev/articles/fetch-metadata) affects whether the web server accepts or rejects the request. Because an import assertion could not affect _how_ to load a module, it was not able to change the shape of the HTTP request. The type of the resource that is being requested also affects which [Content Security Policies](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) are used: import assertions could not correctly work with the security model of the web.

Import attributes relaxes the assert-only semantics to allow the attributes to affect how a module is loaded. In other words, import attributes can generate HTTP requests that contains the appropriate `Accept` and `Sec-Fetch-Dest` headers. To match the syntax to the new semantics, the old `assert` keyword is updated to `with`:

```javascript
// main.mjs
//
// New 'with' syntax.
import json from './foo.json' with { type: 'json' };
console.log(json.answer); // 42
```

## Dynamic `import()`

Similarly, [dynamic `import()`](https://v8.dev/features/dynamic-import#dynamic) is similarly updated to accept a `with` option.

```javascript
// main.mjs
//
// New 'with' option.
const jsonModule = await import('./foo.json', {
  with: { type: 'json' }
});
console.log(jsonModule.default.answer); // 42
```

## Availability of `with`

Import attributes is enabled by default in V8 v12.3.

## Deprecation and eventual removal of `assert`

The `assert` keyword is deprecated as of V8 v12.3 and is planned to be removed by v12.6. Please use `with` instead of `assert`! Use of the `assert` clause will print a warning to the console urging use of `with` instead.

## Import attribute support

<feature-support chrome="123 https://chromestatus.com/feature/5205869105250304"
                 firefox="no"
                 safari="17.2 https://developer.apple.com/documentation/safari-release-notes/safari-17_2-release-notes"
                 nodejs="20.10 https://nodejs.org/docs/latest-v20.x/api/esm.html#import-attributes"
                 babel="yes https://babeljs.io/blog/2023/05/26/7.22.0#import-attributes-15536-15620"></feature-support>
