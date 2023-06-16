---
title: 'RegExp `v` flag with set notation and properties of strings'
author: 'Mark Davis ([@mark_e_davis](https://twitter.com/mark_e_davis)), Markus Scherer, and Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mark-davis'
  - 'markus-scherer'
  - 'mathias-bynens'
date: 2022-06-27
tags:
  - ECMAScript
description: 'The new RegExp `v` flag enables `unicodeSets` mode, unlocking support for extended character classes, including Unicode properties of strings, set notation, and improved case-insensitive matching.'
tweet: '1541419838513594368'
---
JavaScript has supported regular expressions since ECMAScript 3 (1999). Sixteen years later, ES2015 introduced [Unicode mode (the `u` flag)](https://mathiasbynens.be/notes/es6-unicode-regex), [sticky mode (the `y` flag)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky#description), and [the `RegExp.prototype.flags` getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/flags). Another three years later, ES2018 introduced [`dotAll` mode (the `s` flag)](https://mathiasbynens.be/notes/es-regexp-proposals#dotAll), [lookbehind assertions](https://mathiasbynens.be/notes/es-regexp-proposals#lookbehinds), [named capture groups](https://mathiasbynens.be/notes/es-regexp-proposals#named-capture-groups), and [Unicode character property escapes](https://mathiasbynens.be/notes/es-unicode-property-escapes). And in ES2020, [`String.prototype.matchAll`](https://v8.dev/features/string-matchall) made it easier to work with regular expressions. JavaScript regular expressions have come a long way, and are still improving.

The latest example of this is [the new `unicodeSets` mode, enabled using the `v` flag](https://github.com/tc39/proposal-regexp-v-flag). This new mode unlocks support for _extended character classes_, including the following features:

- [Unicode properties of strings](/features/regexp-v-flag#unicode-properties-of-strings)
- [set notation + string literal syntax](/features/regexp-v-flag#set-notation)
- [improved case-insensitive matching](/features/regexp-v-flag#ignoreCase)

This article dives into each of these. But first things first — here’s how to use the new flag:

```js
const re = /…/v;
```

The `v` flag can be combined with existing regular expression flags, with one notable exception. The `v` flag enables all the good parts of the `u` flag, but with additional features and improvements — some of which are backwards-incompatible with the `u` flag. Crucially, `v` is a completely separate mode from `u` rather than a complementary one. For this reason, the `v` and `u` flags cannot be combined — trying to use both flags on the same regular expression results in an error. The only valid options are: either use `u`, or use `v`, or use neither `u` nor `v`. But since `v` is the most feature-complete option, that choice is easily made…

Let’s dig into the new functionality!

## Unicode properties of strings

The Unicode Standard assigns various properties and property values to every symbol. For example, to get the set of symbols that are used in the Greek script, search the Unicode database for symbols whose `Script_Extensions` property value includes `Greek`.

ES2018 Unicode character property escapes make it possible to access these Unicode character properties natively in ECMAScript regular expressions. For example, the pattern `\p{Script_Extensions=Greek}` matches every symbol that is used in the Greek script:

```js
const regexGreekSymbol = /\p{Script_Extensions=Greek}/u;
regexGreekSymbol.test('π');
// → true
```

By definition, Unicode character properties expand to a set of code points, and can thus be transpiled as a character class containing the code points they match individually. For example, `\p{ASCII_Hex_Digit}` is equivalent to `[0-9A-Fa-f]`: it only ever matches a single Unicode character/code point at a time. In some situations, this is insufficient:

```js
// Unicode defines a character property named “Emoji”.
const re = /^\p{Emoji}$/u;

// Match an emoji that consists of just 1 code point:
re.test('⚽'); // '\u26BD'
// → true ✅

// Match an emoji that consists of multiple code points:
re.test('👨🏾‍⚕️'); // '\u{1F468}\u{1F3FE}\u200D\u2695\uFE0F'
// → false ❌
```

In the above example, the regular expression doesn’t match the 👨🏾‍⚕️ emoji because it happens to consist of multiple code points, and `Emoji` is a Unicode _character_ property.

Luckily, the Unicode Standard also defines several [properties of strings](https://www.unicode.org/reports/tr18/#domain_of_properties). Such properties expand to a set of strings, each of which contains one or more code points. In regular expressions, properties of strings translate to a set of alternatives. To illustrate this, imagine a Unicode property that applies to the strings `'a'`, `'b'`, `'c'`, `'W'`, `'xy'`, and `'xyz'`. This property translates to either of the following regular expression patterns (using alternation): `xyz|xy|a|b|c|W` or `xyz|xy|[a-cW]`. (Longest strings first, so that a prefix like `'xy'` does not hide a longer string like `'xyz'`.) Unlike existing Unicode property escapes, this pattern can match multi-character strings. Here’s an example of a property of strings in use:

```js
const re = /^\p{RGI_Emoji}$/v;

// Match an emoji that consists of just 1 code point:
re.test('⚽'); // '\u26BD'
// → true ✅

// Match an emoji that consists of multiple code points:
re.test('👨🏾‍⚕️'); // '\u{1F468}\u{1F3FE}\u200D\u2695\uFE0F'
// → true ✅
```

This code snippet refers to the property of strings `RGI_Emoji`, which Unicode defines as “the subset of all valid emoji (characters and sequences) recommended for general interchange”. With this, we can now match emoji regardless of how many code points they consist of under the hood!

The `v` flag enables support for the following Unicode properties of strings from the get-go:

- `Basic_Emoji`
- `Emoji_Keycap_Sequence`
- `RGI_Emoji_Modifier_Sequence`
- `RGI_Emoji_Flag_Sequence`
- `RGI_Emoji_Tag_Sequence`
- `RGI_Emoji_ZWJ_Sequence`
- `RGI_Emoji`

This list of supported properties might grow in the future as the Unicode Standard defines additional properties of strings. Although all current properties of strings happen to be emoji-related, future properties of strings might serve entirely different use cases.

:::note
**Note:** Although properties of strings are currently gated on the new `v` flag, [we plan to eventually make them available in `u` mode as well](https://github.com/tc39/proposal-regexp-v-flag/issues/49).
:::

## Set notation + string literal syntax { #set-notation }

When working with `\p{…}` escapes (be it character properties or the new properties of strings) it can be useful to perform difference/subtraction or intersection. With the `v` flag, character classes can now be nested, and those set operations can now be performed within them rather than with adjacent lookahead or lookbehind assertions or lengthy character classes expressing the computed ranges.

### Difference/subtraction with `--` { #difference }

The syntax `A--B` can be used to match strings _in `A` but not in `B`_, a.k.a. difference/subtraction.

For example, what if you want to match all Greek symbols except for the letter `π`? With set notation, solving this is trivial:

```js
/[\p{Script_Extensions=Greek}--π]/v.test('π'); // → false
```

By using `--` for difference/subtraction, the regular expression engine does the hard work for you while keeping your code readable and maintainable.

What if instead of a single character, we want to subtract the set of characters `α`, `β`, and `γ`? No problem — we can use a nested character class and subtract its contents:

```js
/[\p{Script_Extensions=Greek}--[αβγ]]/v.test('α'); // → false
/[\p{Script_Extensions=Greek}--[α-γ]]/v.test('β'); // → false
```

Another example is matching non-ASCII digits, for example to convert them to ASCII digits later on:

```js
/[\p{Decimal_Number}--[0-9]]/v.test('𑜹'); // → true
/[\p{Decimal_Number}--[0-9]]/v.test('4'); // → false
```

Set notation can also be used with the new properties of strings:

```js
// Note: 🏴󠁧󠁢󠁳󠁣󠁴󠁿 consists of 7 code points.

/^\p{RGI_Emoji_Tag_Sequence}$/v.test('🏴󠁧󠁢󠁳󠁣󠁴󠁿'); // → true
/^[\p{RGI_Emoji_Tag_Sequence}--\q{🏴󠁧󠁢󠁳󠁣󠁴󠁿}]$/v.test('🏴󠁧󠁢󠁳󠁣󠁴󠁿'); // → false
```

This example matches any RGI emoji tag sequence _except_ for the flag of Scotland. Note the use of `\q{…}`, which is another new piece of syntax for string literals within character classes. For example, `\q{a|bc|def}` matches the strings `a`, `bc`, and `def`. Without `\q{…}` it wouldn’t be possible to subtract hardcoded multi-character strings.

### Intersection with `&&` { #intersection }

The `A&&B` syntax matches strings that are _in both `A` and `B`_, a.k.a. intersection. This lets you do things like matching Greek letters:

```js
const re = /[\p{Script_Extensions=Greek}&&\p{Letter}]/v;
// U+03C0 GREEK SMALL LETTER PI
re.test('π'); // → true
// U+1018A GREEK ZERO SIGN
re.test('𐆊'); // → false
```

Matching all ASCII white space:

```js
const re = /[\p{White_Space}&&\p{ASCII}]/v;
re.test('\n'); // → true
re.test('\u2028'); // → false
```

Or matching all Mongolian numbers:

```js
const re = /[\p{Script_Extensions=Mongolian}&&\p{Number}]/v;
// U+1817 MONGOLIAN DIGIT SEVEN
re.test('᠗'); // → true
// U+1834 MONGOLIAN LETTER CHA
re.test('ᠴ'); // → false
```

### Union

Matching strings that are _in A or in B_ was previously already possible for single-character strings by using a character class like `[\p{Letter}\p{Number}]`. With the `v` flag, this functionality becomes more powerful, since it can now be combined with properties of strings or string literals as well:

```js
const re = /^[\p{Emoji_Keycap_Sequence}\p{ASCII}\q{🇧🇪|abc}xyz0-9]$/v;

re.test('4️⃣'); // → true
re.test('_'); // → true
re.test('🇧🇪'); // → true
re.test('abc'); // → true
re.test('x'); // → true
re.test('4'); // → true
```

The character class in this pattern combines:

- a property of strings (`\p{Emoji_Keycap_Sequence}`)
- a character property (`\p{ASCII}`)
- string literal syntax for the multi-code point strings `🇧🇪` and `abc`
- classic character class syntax for lone characters `x`, `y`, and `z`
- classic character class syntax for the character range from `0` to `9`

Another example is matching all commonly-used flag emoji, regardless of whether they’re encoded as a two-letter ISO code (`RGI_Emoji_Flag_Sequence`) or as a special-cased tag sequence (`RGI_Emoji_Tag_Sequence`):

```js
const reFlag = /[\p{RGI_Emoji_Flag_Sequence}\p{RGI_Emoji_Tag_Sequence}]/v;
// A flag sequence, consisting of 2 code points (flag of Belgium):
reFlag.test('🇧🇪'); // → true
// A tag sequence, consisting of 7 code points (flag of England):
reFlag.test('🏴󠁧󠁢󠁥󠁮󠁧󠁿'); // → true
// A flag sequence, consisting of 2 code points (flag of Switzerland):
reFlag.test('🇨🇭'); // → true
// A tag sequence, consisting of 7 code points (flag of Wales):
reFlag.test('🏴󠁧󠁢󠁷󠁬󠁳󠁿'); // → true
```

## Improved case-insensitive matching { #ignoreCase }

The ES2015 `u` flag suffers from [confusing case-insensitive matching behavior](https://github.com/tc39/proposal-regexp-v-flag/issues/30). Consider the following two regular expressions:

```js
const re1 = /\p{Lowercase_Letter}/giu;
const re2 = /[^\P{Lowercase_Letter}]/giu;
```

The first pattern matches all lowercase letters. The second pattern uses `\P` instead of `\p` to match all characters except lowercase letters, but is then wrapped in a negated character class (`[^…]`). Both regular expressions are made case-insensitive by setting the `i` flag (`ignoreCase`).

Intuitively, you might expect both regular expressions to behave the same. In practice, they behave very differently:

```js
const re1 = /\p{Lowercase_Letter}/giu;
const re2 = /[^\P{Lowercase_Letter}]/giu;

const string = 'aAbBcC4#';

string.replaceAll(re1, 'X');
// → 'XXXXXX4#'

string.replaceAll(re2, 'X');
// → 'aAbBcC4#''
```

The new `v` flag has less surprising behavior. With the `v` flag instead of the `u` flag, both patterns behave the same:

```js
const re1 = /\p{Lowercase_Letter}/giv;
const re2 = /[^\P{Lowercase_Letter}]/giv;

const string = 'aAbBcC4#';

string.replaceAll(re1, 'X');
// → 'XXXXXX4#'

string.replaceAll(re2, 'X');
// → 'XXXXXX4#'
```

More generally, the `v` flag makes `[^\p{X}]` ≍ `[\P{X}]` ≍ `\P{X}` and `[^\P{X}]` ≍ `[\p{X}]` ≍ `\p{X}`, whether the `i` flag is set or not.

## Further reading

[The proposal repository](https://github.com/tc39/proposal-regexp-v-flag) contains more details and background around these features and their design decisions.

As part of our work on these JavaScript features, we went beyond “just” proposing specification changes to ECMAScript. We upstreamed the definition of “properties of strings” to [Unicode UTS#18](https://unicode.org/reports/tr18/#Notation_for_Properties_of_Strings) so that other programming languages can implement similar functionality in a unified manner. We’re also [proposing a change to the HTML Standard](https://github.com/whatwg/html/pull/7908) with the goal of enabling these new features in the `pattern` attribute as well.

## RegExp `v` flag support { #support }

V8 v11.0 (Chrome 110) offers experimental support for this new functionality via the `--harmony-regexp-unicode-sets` flag. V8 v12.0 (Chrome 112) has the new features enabled by default. Babel also supports transpiling the `v` flag — [try out the examples from this article in the Babel REPL](https://babeljs.io/repl#?code_lz=MYewdgzgLgBATgUxgXhgegNoYIYFoBmAugGTEbC4AWhhaAbgNwBQTaaMAKpQJYQy8xKAVwDmSQCgEMKHACeMIWFABbJQjBRuYEfygBCVmlCRYCJSABW3FOgA6ABwDeAJQDiASQD6AUTOWAvvTMQA&presets=stage-3)! The support table below links to tracking issues you can subscribe to for updates.

<feature-support chrome="112 https://bugs.chromium.org/p/v8/issues/detail?id=11935"
                 firefox="116 https://bugzilla.mozilla.org/show_bug.cgi?id=regexp-v-flag"
                 safari="17 https://bugs.webkit.org/show_bug.cgi?id=regexp-v-flag"
                 nodejs="20"
                 babel="7.17.0 https://babeljs.io/blog/2022/02/02/7.17.0"></feature-support>
