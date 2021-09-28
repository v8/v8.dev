---
title: '`Intl.DisplayNames`'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu)) and Frank Tang'
avatars:
  - 'shu-yu-guo'
  - 'frank-tang'
date: 2020-02-13
tags:
  - Intl
  - Node.js 14
description: 'The Intl.DisplayNames API enables localized names of languages, regions, scripts, and currencies.'
tweet: '1232333889005334529'
---
Web applications that reach a global audience need to show the display names of languages, regions, scripts, and currencies in many different languages. The translations of those names require data, which is available in the [Unicode CLDR](http://cldr.unicode.org/translation/). Packaging the data as part of the application incurs a cost on developer time. Users are likely to prefer consistent translations of language and region names, and keeping that data up to date with the world's geopolitical happenings requires constant maintenance.

Luckily, most JavaScript runtimes already ship and keep up-to-date that very same translation data. The new `Intl.DisplayNames` API gives JavaScript developers direct access to those translations, allowing applications to more easily display localized names.

## Usage examples

The following example shows how to create an `Intl.DisplayNames` object to get region names in English using [ISO-3166 2-letter country codes](https://www.iso.org/iso-3166-country-codes.html).

```js
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
regionNames.of('US');
// → 'United States'
regionNames.of('BA');
// → 'Bosnia & Herzegovina'
regionNames.of('MM');
// → 'Myanmar (Burma)'
```

The following example gets language names in Traditional Chinese using [Unicode's language identifier grammar](http://unicode.org/reports/tr35/#Unicode_language_identifier).

```js
const languageNames = new Intl.DisplayNames(['zh-Hant'], { type: 'language' });
languageNames.of('fr');
// → '法文'
languageNames.of('zh');
// → '中文'
languageNames.of('de');
// → '德文'
```

The following example gets currency names in Simplified Chinese using [ISO-4217 3-letter currency codes](https://www.iso.org/iso-4217-currency-codes.html). In languages that have distinct singular and plural forms, the currency names are singular. For plural forms, [`Intl.NumberFormat`](https://v8.dev/features/intl-numberformat) may be used.

```js
const currencyNames = new Intl.DisplayNames(['zh-Hans'], {type: 'currency'});
currencyNames.of('USD');
// → '美元'
currencyNames.of('EUR');
// → '欧元'
currencyNames.of('JPY');
// → '日元'
currencyNames.of('CNY');
// → '人民币'
```

The following example shows the final supported type, scripts, in English, using [ISO-15924 4-letter script codes](http://unicode.org/iso15924/iso15924-codes.html).

```js
const scriptNames = new Intl.DisplayNames(['en'], { type: 'script' });
scriptNames.of('Latn');
// → 'Latin'
scriptNames.of('Arab');
// → 'Arabic'
scriptNames.of('Kana');
// → 'Katakana'
```

For more advanced usage, the second `options` parameter also supports the `style` property. The `style` property corresponds to the width of the display name and may be either `"long"`, `"short"`, or `"narrow"`. The values for different styles do not always differ. The default is `"long"`.

```js
const longLanguageNames = new Intl.DisplayNames(['en'], { type: 'language' });
longLanguageNames.of('en-US');
// → 'American English'
const shortLanguageNames = new Intl.DisplayNames(['en'], { type: 'language', style: 'short' });
shortLanguageNames.of('en-US');
// → 'US English'
const narrowLanguageNames = new Intl.DisplayNames(['en'], { type: 'language', style: 'narrow' });
narrowLanguageNames.of('en-US');
// → 'US English'
```

## Full API

The full API for `Intl.DisplayNames` is as follows.

```js
Intl.DisplayNames(locales, options)
Intl.DisplayNames.prototype.of( code )
```

The constructor is consistent with other `Intl` APIs. Its first argument is a [list of locales](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation), and its second parameter is an `options` parameter that takes `localeMatcher`, `type`, and `style` properties.

The `"localeMatcher"` property is treated the same as in [other `Intl` APIs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation). The `type` property may be `"region"`, `"language"`, `"currency"`, or `"script"`. The `style` property may be `"long"`, `"short"`, or `"narrow"`, with `"long"` being the default.

`Intl.DisplayNames.prototype.of( code )` expects the following formats depending on the `type` of how the instance is constructed.

- When `type` is `"region"`, `code` must be either an [ISO-3166 2-letter country code](https://www.iso.org/iso-3166-country-codes.html) or a [UN M49 3-digit region code](https://unstats.un.org/unsd/methodology/m49/).
- When `type` is `"language"`, `code` must be conform to [Unicode's language identifier grammar](https://unicode.org/reports/tr35/#Unicode_language_identifier).
- When `type` is `"currency"`, `code` must be a [ISO-4217 3-letter currency code](https://www.iso.org/iso-4217-currency-codes.html).
- When `type` is `"script"`, `code` must be a [ISO-15924 4-letter script code](https://unicode.org/iso15924/iso15924-codes.html).

## Conclusion

Like other `Intl` APIs, as `Intl.DisplayNames` become more widely available, libraries and applications will opt to drop packaging and shipping their own translation data in favor of using the native functionality.

## `Intl.DisplayNames` support { #support }

<feature-support chrome="81 /blog/v8-release-81#intl.displaynames"
                 firefox="86 https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/86#javascript"
                 safari="14 https://bugs.webkit.org/show_bug.cgi?id=209779"
                 nodejs="14 https://medium.com/@nodejs/node-js-version-14-available-now-8170d384567e"
                 babel="no"></feature-support>
