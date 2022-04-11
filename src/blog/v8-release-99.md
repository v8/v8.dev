---
title: 'V8 release v9.9'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser)), at his 99%'
avatars:
 - 'ingvar-stepanyan'
date: 2022-01-31
tags:
 - release
description: 'V8 release v9.9 brings new internationalization APIs.'
tweet: '1488190967727411210'
---
Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git main immediately before a Chrome Beta milestone. Today we’re pleased to announce our newest branch, [V8 version 9.9](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/9.9), which is in beta until its release in coordination with Chrome 99 Stable in several weeks. V8 v9.9 is filled with all sorts of developer-facing goodies. This post provides a preview of some of the highlights in anticipation of the release.

## JavaScript

### Intl.Locale extensions

In v7.4 we launched the [`Intl.Locale` API](https://v8.dev/blog/v8-release-74#intl.locale). With v9.9, we added seven new properties to the `Intl.Locale` object: `calendars`, `collations`, `hourCycles`, `numberingSystems`, `timeZones`, `textInfo`, and `weekInfo`.

The `calendars`, `collations`, `hourCycles`, `numberingSystems`, and `timeZones` property of `Intl.Locale` return an array of preferred identifiers of those in common use, designed to be use with other `Intl` API:

```js
const arabicEgyptLocale = new Intl.Locale('ar-EG')
// ar-EG
arabicEgyptLocale.calendars
// ['gregory', 'coptic', 'islamic', 'islamic-civil', 'islamic-tbla']
arabicEgyptLocale.collations
// ['compat', 'emoji', 'eor']
arabicEgyptLocale.hourCycles
// ['h12']
arabicEgyptLocale.numberingSystems
// ['arab']
arabicEgyptLocale.timeZones
// ['Africa/Cairo']
```

The `textInfo` property of `Intl.Locale` returns an object to specify the information related to text. Currently it only has one property, `direction`, to indicate default directionality for text in the locale. It is designed to be used for [HTML `dir` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir) and [CSS `direction` property](https://developer.mozilla.org/en-US/docs/Web/CSS/direction). It indicates the ordering of characters - `ltr` (left-to-right) or `rtl` (right-to-left):

```js
arabicEgyptLocale.textInfo
// { direction: 'rtl' }
japaneseLocale.textInfo
// { direction: 'ltr' }
chineseTaiwanLocale.textInfo
// { direction: 'ltr' }
```

The `weekInfo` property of `Intl.Locale` returns an object to specify the information related to week. The `firstDay` property in the return object is a number, ranging from 1 to 7, indicating which day of the week is considered the first day, for calendar purposes. 1 specifies Monday, 2 - Tuesday, 3 - Wednesday, 4 - Thursday, 5 - Friday, 6 - Saturday, and 7 - Sunday. The `minimalDays` property in the return object is the minimum days required in the first week of a month or year, for calendar purposes. The `weekend` property in the return object is an array of integers, usually with two elements, encoded the same as `firstDay`. It indicates which days of the week are considered as part of the 'weekend', for calendar purposes. Notice that the number of days in the weekend are different in each locale and may not be contiguous.

```js
arabicEgyptLocale.weekInfo
// {firstDay: 6, weekend: [5, 6], minimalDays: 1}
// First day of the week is Saturday. Weekend is Friday and Saturday.
// The first week of a month or a year is a week which has at least 1
// day in that month or year.
```

### Intl Enumeration

In v9.9, we added a new function [`Intl.supportedValuesOf(code)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf) that returns the array of supported identifiers in v8 for the Intl APIs. The supported `code` values are `calendar`, `collation`, `currency`,`numberingSystem`, `timeZone`, and `unit`. The information in this new method is designed to allow web developers to easily discover which value is supported by the implementation.

```js
Intl.supportedValuesOf('calendar')
// ['buddhist', 'chinese', 'coptic', 'dangi', ...]

Intl.supportedValuesOf('collation')
// ['big5han', 'compat', 'dict', 'emoji', ...]

Intl.supportedValuesOf('currency')
// ['ADP', 'AED', 'AFA', 'AFN', 'ALK', 'ALL', 'AMD', ...]

Intl.supportedValuesOf('numberingSystem')
// ['adlm', 'ahom', 'arab', 'arabext', 'bali', ...]

Intl.supportedValuesOf('timeZone')
// ['Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', ...]

Intl.supportedValuesOf('unit')
// ['acre', 'bit', 'byte', 'celsius', 'centimeter', ...]
```

## V8 API

Please use `git log branch-heads/9.8..branch-heads/9.9 include/v8\*.h` to get a list of the API changes.

Developers with an active V8 checkout can use `git checkout -b 9.9 -t branch-heads/9.9` to experiment with the new features in V8 v9.9. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
