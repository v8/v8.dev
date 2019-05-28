---
title: '`Intl.Locale`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias))'
avatars:
  - 'mathias-bynens'
date: 2019-05-20
tags:
  - Intl
  - Node.js 12
  - io19
tweet: 'TODO'
---
When dealing with [internationalization APIs](/features/tags/intl), it’s common to pass strings representing locale IDs to the various `Intl` constructors, such as `'en'` for English. [The new `Intl.Locale` API](https://github.com/tc39/proposal-intl-locale) offers a more powerful mechanism to deal with such locales.

It enables easily extracting locale-specific preferences such as not only the language, but also the calendar, the numbering system, the hour cycle, the region, and so on.

```js
const locale = new Intl.Locale('es-419-u-hc-h12', {
  calendar: 'gregory'
});
locale.language;
// → 'es'
locale.calendar;
// → 'gregory'
locale.hourCycle;
// → 'h12'
locale.region;
// → '419'
locale.toString();
// → 'es-419-u-ca-gregory-hc-h12'
```

## `Intl.Locale` support { #support }

<feature-support chrome="74 /blog/v8-release-74#intl.locale"
                 firefox="no"
                 safari="no"
                 nodejs="12 https://twitter.com/mathias/status/1120700101637353473"
                 babel="no"></feature-support>
