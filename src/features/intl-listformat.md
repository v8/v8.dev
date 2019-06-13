---
title: '`Intl.ListFormat`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias)) and Frank Tang'
avatars:
  - 'mathias-bynens'
  - 'frank-tang'
date: 2018-12-18
tags:
  - Intl
  - Node.js 12
  - io19
description: 'The Intl.ListFormat API enables localized formatting of lists without sacrificing performance.'
tweet: '1074966915557351424'
---
Modern web applications often use lists consisting of dynamic data. For example, a photo viewer app might display something like:

> This photo includes **Ada, Edith, _and_ Grace**.

A text-based game might have a different kind of list:

> Choose your superpower: **invisibility, psychokinesis, _or_ empathy**.

Since each language has different list formatting conventions and words, implementing a localized list formatter is non-trivial. Not only does this require a list of all the words (such as “and” or “or” in the above examples) for each language you want to support — in addition you need to encode the exact formatting conventions for all those languages! [The Unicode CLDR](http://cldr.unicode.org/translation/lists) provides this data, but to use it in JavaScript, it has to be embedded and shipped alongside the other library code. This unfortunately increases the bundle size for such libraries, which negatively impacts load times, parse/compile cost, and memory consumption.

The brand new `Intl.ListFormat` API shifts that burden to the JavaScript engine, which can ship the locale data and make it directly available to JavaScript developers. `Intl.ListFormat` enables localized formatting of lists without sacrificing performance.

## Usage examples

The following example shows how to create a list formatter for conjunctions using the English language:

```js
const lf = new Intl.ListFormat('en');
lf.format(['Frank']);
// → 'Frank'
lf.format(['Frank', 'Christine']);
// → 'Frank and Christine'
lf.format(['Frank', 'Christine', 'Flora']);
// → 'Frank, Christine, and Flora'
lf.format(['Frank', 'Christine', 'Flora', 'Harrison']);
// → 'Frank, Christine, Flora, and Harrison'
```

Disjunctions (“or” in English) are supported as well through the optional `options` parameter:

```js
const lf = new Intl.ListFormat('en', { type: 'disjunction' });
lf.format(['Frank']);
// → 'Frank'
lf.format(['Frank', 'Christine']);
// → 'Frank or Christine'
lf.format(['Frank', 'Christine', 'Flora']);
// → 'Frank, Christine, or Flora'
lf.format(['Frank', 'Christine', 'Flora', 'Harrison']);
// → 'Frank, Christine, Flora, or Harrison'
```

Here’s an example of using a different language (Chinese, with language code `zh`):

```js
const lf = new Intl.ListFormat('zh');
lf.format(['永鋒']);
// → '永鋒'
lf.format(['永鋒', '新宇']);
// → '永鋒和新宇'
lf.format(['永鋒', '新宇', '芳遠']);
// → '永鋒、新宇和芳遠'
lf.format(['永鋒', '新宇', '芳遠', '澤遠']);
// → '永鋒、新宇、芳遠和澤遠'
```

The `options` parameter enables more advanced usage. Here’s an overview of the various options and their combinations, and how they correspond to the list patterns defined by [UTS#35](https://unicode.org/reports/tr35/tr35-general.html#ListPatterns):

:::table-wrapper
| Type                  | Options                                   | Description                                                                                     | Examples                         |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| standard (or no type) | `{}` (default)                            | A typical “and” list for arbitrary placeholders                                                 | `'January, February, and March'` |
| or                    | `{ type: 'disjunction' }`                 | A typical “or” list for arbitrary placeholders                                                  | `'January, February, or March'`  |
| unit                  | `{ type: 'unit' }`                        | A list suitable for wide units                                                                  | `'3 feet, 7 inches'`             |
| unit-short            | `{ type: 'unit', style: 'short' }`        | A list suitable for short units                                                                 | `'3 ft, 7 in'`                   |
| unit-narrow           | `{ type: 'unit', style: 'narrow' }`       | A list suitable for narrow units, where space on the screen is very limited                     | `'3′ 7″'`                        |
:::

Note that in many languages (such as English) there may not be a difference among many of these lists. In others, the spacing, the length or presence of a conjunction, and the separators may change.

## Conclusion

As the `Intl.ListFormat` API becomes more widely available, you’ll find libraries dropping their dependency on hardcoded CLDR databases in favor of the native list formatting functionality, thereby improving load-time performance, parse- and compile-time performance, run-time performance, and memory usage.

## `Intl.ListFormat` support { #support }

<feature-support chrome="72 /blog/v8-release-72#intl.listformat"
                 firefox="no"
                 safari="no"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="no"></feature-support>
