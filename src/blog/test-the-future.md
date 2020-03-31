---
title: 'Help us test the future of V8!'
author: 'Daniel Clifford ([@expatdanno](https://twitter.com/expatdanno)), Original Munich V8 Brewer'
date: 2017-02-14 13:33:37
tags:
  - internals
description: 'Preview V8’s new compiler pipeline with Ignition and TurboFan in Chrome Canary today!'
---
The V8 team is currently working on a new default compiler pipeline that will help us bring future speedups to [real-world JavaScript](/blog/real-world-performance). You can preview the new pipeline in Chrome Canary today to help us verify that there are no surprises when we roll out the new configuration for all Chrome channels.

The new compiler pipeline uses the [Ignition interpreter](/blog/ignition-interpreter) and [TurboFan compiler](/docs/turbofan) to execute all JavaScript (in place of the classic pipeline which consisted of the Full-codegen and Crankshaft compilers). A random subset of Chrome Canary and Chrome Developer channel users are already testing the new configuration. However, anyone can opt-in to the new pipeline (or revert to the old one) by flipping a flag in about:flags.

You can help test the new pipeline by opting-in and using it with Chrome on your favorite web sites. If you are a web developer, please test your web applications with the new compiler pipeline. If you notice a regression in stability, correctness, or performance, please [report the issue to the V8 bug tracker](https://bugs.chromium.org/p/v8/issues/entry?template=Bug%20report%20for%20the%20new%20pipeline).

## How to enable the new pipeline

### In Chrome 58

1. Install the latest [Beta](https://www.google.com/chrome/browser/beta.html)
2. Open the URL `about:flags` in Chrome
3. Search for "**Experimental JavaScript Compilation Pipeline**" and set it to "**Enabled**"

![](/_img/test-the-future/58.png)

### In Chrome 59.0.3056 and above

1. Install the latest Canary [Canary](https://www.google.com/chrome/browser/canary.html) or [Dev](https://www.google.com/chrome/browser/desktop/index.html?extra=devchannel)
2. Open the URL `about:flags` in Chrome
3. Search for "**Classic JavaScript Compilation Pipeline**" and set it to "**Disabled**"

![](/_img/test-the-future/59.png)

The standard value is "**Default**", which means that either the new **or** the classic pipeline is active depending on the A/B test configuration.

## How to report problems

Please let us know if your browsing experience changes significantly when using the new pipeline over the default pipeline. If you are a web developer, please test the performance of the new pipeline on your (mobile) web application to see how it is affected. If you discover that your web application is behaving strange (or tests are failing), please let us know:

1. Ensure that you have correctly enabled the new pipeline as outlined in the previous section.
2. [Create a bug on V8's bug tracker](https://bugs.chromium.org/p/v8/issues/entry?template=Bug%20report%20for%20the%20new%20pipeline).
3. Attach sample code which we can use to reproduce the problem.
