---
title: '`Intl.NumberFormat`'
author: 'Mathias Bynens ([@mathias](https://twitter.com/mathias)) and Shane F. Carr'
avatars:
  - 'mathias-bynens'
  - 'shane-carr'
date: 2019-08-08
tags:
  - Intl
  - io19
description: 'Intl.NumberFormat enables locale-aware number formatting.'
tweet: '1159476407329873920'
---
You might already be familiar with the `Intl.NumberFormat` API, as it’s been supported across modern environments for a while now.

<feature-support chrome="24"
                 firefox="29"
                 safari="10"
                 nodejs="0.12"
                 babel="yes"></feature-support>

In its most basic form, `Intl.NumberFormat` lets you create a reusable formatter instance that supports locale-aware number formatting. Just like other `Intl.*Format` APIs, a formatter instance supports both a `format` and a `formatToParts` method:

```js
const formatter = new Intl.NumberFormat('en');
formatter.format(987654.321);
// → '987,654.321'
formatter.formatToParts(987654.321);
// → [
// →   { type: 'integer', value: '987' },
// →   { type: 'group', value: ',' },
// →   { type: 'integer', value: '654' },
// →   { type: 'decimal', value: '.' },
// →   { type: 'fraction', value: '321' }
// → ]
```

**Note:** Although much of the `Intl.NumberFormat` functionality can be achieved using `Number.prototype.toLocaleString`, `Intl.NumberFormat` is often the better choice, since it enables creating a re-usable formatter instance which tends to be [more efficient](/blog/v8-release-76#localized-bigint).

Recently, the `Intl.NumberFormat` API gained some new capabilities.

## `BigInt` support

In addition to `Number`s, `Intl.NumberFormat` can now also format [`BigInt`s](/features/bigint):

```js
const formatter = new Intl.NumberFormat('fr');
formatter.format(12345678901234567890n);
// → '12 345 678 901 234 567 890'
formatter.formatToParts(123456n);
// → [
// →   { type: 'integer', value: '123' },
// →   { type: 'group', value: ' ' },
// →   { type: 'integer', value: '456' }
// → ]
```

<feature-support chrome="76 /blog/v8-release-76#localized-bigint"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>

## Units of measurement { #units }

`Intl.NumberFormat` currently supports the following so-called _simple units_:

- angle: `degree`
- area: `acre`, `hectare`
- concentration: `percent`
- digital: `bit`, `byte`, `kilobit`, `kilobyte`, `megabit`, `megabyte`, `gigabit`, `gigabyte`, `terabit`, `terabyte`, `petabyte`
- duration: `millisecond`, `second`, `minute`, `hour`, `day`, `week`, `month`, `year`
- length: `millimeter`, `centimeter`, `meter`, `kilometer`, `inch`, `foot`, `yard`, `mile`, `mile-scandinavian`
- mass: `gram`,  `kilogram`, `ounce`, `pound`, `stone`
- temperature: `celsius`, `fahrenheit`
- volume: `liter`, `milliliter`, `gallon`, `fluid-ounce`

To format numbers with localized units, use the `style` and `unit` options:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'kilobyte',
});
formatter.format(1.234);
// → '1.234 kB'
formatter.format(123.4);
// → '123.4 kB'
```

Note that over time, support for more units may be added. Please refer to the spec for [the latest up-to-date list](https://tc39.es/proposal-unified-intl-numberformat/section6/locales-currencies-tz_proposed_out.html#table-sanctioned-simple-unit-identifiers).

The above simple units can be combined into arbitrary numerator and denominator pairs to express compound units such as “liters per acre” or “meters per second”:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'meter-per-second',
});
formatter.format(299792458);
// → '299,792,458 m/s'
```

<feature-support chrome="77"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>

## Compact, scientific, and engineering notation { #notation }

_Compact notation_ uses locale-specific symbols to represent large numbers. It is a more human-friendly alternative to scientific notation:

```js
{
  // Test standard notation.
  const formatter = new Intl.NumberFormat('en', {
    notation: 'standard', // This is the implied default.
  });
  formatter.format(1234.56);
  // → '1,234.56'
  formatter.format(123456);
  // → '123,456'
  formatter.format(123456789);
  // → '123,456,789'
}

{
  // Test compact notation.
  const formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
  });
  formatter.format(1234.56);
  // → '1.2K'
  formatter.format(123456);
  // → '123K'
  formatter.format(123456789);
  // → '123M'
}
```

:::note
**Note:** By default, compact notation rounds to the nearest integer, but always keeps 2 significant digits. You can set any of `{minimum,maximum}FractionDigits` or `{minimum,maximum}SignificantDigits` to override that behavior.
:::

`Intl.NumberFormat` can also format numbers in [scientific notation](https://en.wikipedia.org/wiki/Scientific_notation):

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'meter-per-second',
  notation: 'scientific',
});
formatter.format(299792458);
// → '2.998E8 m/s'
```

[Engineering notation](https://en.wikipedia.org/wiki/Engineering_notation) is supported as well:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'meter-per-second',
  notation: 'engineering',
});
formatter.format(299792458);
// → '299.792E6 m/s'
```

<feature-support chrome="77"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>

## Sign display { #sign }

In certain situations (such as presenting deltas) it helps to explicitly display the sign, even when the number is positive. The new `signDisplay` option enables this:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'percent',
  signDisplay: 'always',
});
formatter.format(-12.34);
// → '-12.34%'
formatter.format(12.34);
// → '+12.34%'
formatter.format(0);
// → '+0%'
formatter.format(-0);
// → '-0%'
```

To prevent showing the sign when the value is `0`, use `signDisplay: 'exceptZero'`:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'percent',
  signDisplay: 'exceptZero',
});
formatter.format(-12.34);
// → '-12.34%'
formatter.format(12.34);
// → '+12.34%'
formatter.format(0);
// → '0%'
// Note: -0 still displays with a sign, as you’d expect:
formatter.format(-0);
// → '-0%'
```

For currency, the `currencySign` option enables the _accounting format_, which enables a locale-specific format for negative currency amounts; for example, wrapping the amount in parentheses:

```js
const formatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
  currencySign: 'accounting',
});
formatter.format(-12.34);
// → '($12.34)'
formatter.format(12.34);
// → '+$12.34'
formatter.format(0);
// → '$0.00'
formatter.format(-0);
// → '($0.00)'
```

<feature-support chrome="77"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>

## More info

The relevant [spec proposal](https://github.com/tc39/proposal-unified-intl-numberformat) has more information and examples, including guidance on how to feature-detect each individual `Intl.NumberFormat` feature.
