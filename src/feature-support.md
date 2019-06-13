---
title: 'Feature support'
permalink: /features/support/
layout: layouts/base.njk
---
# JavaScript/Wasm feature support

[Our JavaScript and WebAssembly language feature explainers](/features) often include feature support listings like the following:

<feature-support chrome="71"
                 firefox="65"
                 safari="12"
                 nodejs="12"
                 babel="yes"></feature-support>

A feature without any support would look like this:

<feature-support chrome="no"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>

For cutting-edge features, it’s common to see mixed support across environments:

<feature-support chrome="no"
                 firefox="yes"
                 safari="yes"
                 nodejs="no"
                 babel="yes"></feature-support>

The goal is to provide a quick overview of a feature’s maturity not just in V8 and Chrome, but across the wider JavaScript ecosystem. Note that this is not limited to native implementations in actively-developed JavaScript VMs such as V8, but also includes tooling support, represented using the [Babel](https://babeljs.io/) icon here.

The Babel entry covers various meanings:

- For syntactic language features such as [class fields](/features/class-fields), it refers to transpilation support.
- For language features that are new APIs such as [`Promise.allSettled`](/features/promise-combinators#promise.allsettled), it refers to polyfill support. (Babel offers polyfills through [the core-js project](https://github.com/zloirock/core-js).)

The Chrome logo represents V8, Chromium, and any Chromium-based browsers.
