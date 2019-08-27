---
title: 'Revised `Function.prototype.toString`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2018-03-25
tags:
  - ECMAScript
  - ES2019
description: 'Function.prototype.toString now returns exact slices of source code text, including whitespace and comments.'
---
[`Function.prototype.toString()`](https://tc39.es/Function-prototype-toString-revision/) now returns exact slices of source code text, including whitespace and comments. Here’s an example comparing the old and the new behavior:

```js
// Note the comment between the `function` keyword
// and the function name, as well as the space following
// the function name.
function /* a comment */ foo () {}

// Previously, in V8:
foo.toString();
// → 'function foo() {}'
//             ^ no comment
//                ^ no space

// Now:
foo.toString();
// → 'function /* comment */ foo () {}'
```

## Optional `catch` binding support { #support }

<feature-support chrome="66 /blog/v8-release-66#function-tostring"
                 firefox="yes"
                 safari="no"
                 nodejs="8"
                 babel="no"></feature-support>
