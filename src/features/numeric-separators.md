---
title: 'Numeric separators'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-05-28
tags:
  - ECMAScript
  - io19
description: 'JavaScript now supports underscores as separators in numeric literals, increasing readability and maintainability of source code.'
tweet: '1129073383931559936'
---
Large numeric literals are difficult for the human eye to parse quickly, especially when there are lots of repeating digits:

```js
1000000000000
   1019436871.42
```

To improve readability, [a new JavaScript language feature](https://github.com/tc39/proposal-numeric-separator) enables underscores as separators in numeric literals. So, the above can now be rewritten to group the digits per thousand, for example:

```js
1_000_000_000_000
    1_019_436_871.42
```

Now it’s easier to tell that the first number is a trillion, and the second number is in the order of 1 billion.

Numeric separators help improve readability for all kinds of numeric literals:

```js
// A decimal integer literal with its digits grouped per thousand:
1_000_000_000_000
// A decimal literal with its digits grouped per thousand:
1_000_000.220_720
// A binary integer literal with its bits grouped per octet:
0b01010110_00111000
// A binary integer literal with its bits grouped per nibble:
0b0101_0110_0011_1000
// A hexadecimal integer literal with its digits grouped by byte:
0x40_76_38_6A_73
// A BigInt literal with its digits grouped per thousand:
4_642_473_943_484_686_707n
```

They even work for octal integer literals (although [I can’t think of an example](https://github.com/tc39/proposal-numeric-separator/issues/44) where separators provide value for such literals):

```js
// A numeric separator in an octal integer literal: 🤷‍♀️
0o123_456
```

Note that JavaScript also has a legacy syntax for octal literals without the explicit `0o` prefix. For example, `017 === 0o17`. This syntax is not supported in strict mode or within modules, and it should not be used in modern code. Accordingly, numeric separators are not supported for these literals. Use `0o17`-style literals instead.

## Support for numeric separators { #support }

<feature-support chrome="75 /blog/v8-release-75#numeric-separators"
                 firefox="no"
                 safari="no"
                 nodejs="12.5.0 https://nodejs.org/en/blog/release/v12.5.0/"
                 babel="yes https://babeljs.io/docs/en/babel-plugin-proposal-numeric-separator"></feature-support>
