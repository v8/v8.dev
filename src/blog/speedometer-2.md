---
title: 'Chrome welcomes Speedometer 2.0!'
author: 'the Blink and V8 teams'
date: 2018-01-24 13:33:37
tags:
  - benchmarks
description: 'An overview of the performance improvements we’ve made so far in Blink and V8 based on Speedometer 2.0.'
tweet: '956232641736421377'
---
Ever since its initial release of Speedometer 1.0 in 2014, the Blink and V8 teams have been using the benchmark as a proxy for real-world use of popular JavaScript frameworks and we achieved considerable speedups on this benchmark. We verified independently that these improvements translate to real user benefits by measuring against real-world websites and observed that improvements of page load times of popular websites also improved the Speedometer score.

JavaScript has rapidly evolved in the meantime, adding many new language features with ES2015 and later standards. The same is true for the frameworks themselves, and as such Speedometer 1.0 has become outdated over time. Hence using Speedometer 1.0 as an optimization indicator raises the risk of not measuring newer code patterns that are actively used.

The Blink and V8 teams welcome [the recent release of the updated Speedometer 2.0 benchmark](https://webkit.org/blog/8063/speedometer-2-0-a-benchmark-for-modern-web-app-responsiveness/). Applying the original concept to a list of contemporary frameworks, transpilers and ES2015 features makes the benchmark a prime candidate for optimizations again. Speedometer 2.0 is a great addition to [our real-world performance benchmarking tool belt](/blog/real-world-performance).

## Chrome’s mileage so far

The Blink and V8 teams have already completed a first round of improvements, underlying the importance of this benchmark to us and continuing our journey of focusing on real-world performance. Comparing Chrome 60 from July 2017 with the latest Chrome 64 we have achieved about a 21% improvement on the total score (runs per minute) on a mid-2016 Macbook Pro (4 core, 16GB RAM).

![Comparison of Speedometer 2 scores between Chrome 60 and 64](/_img/speedometer-2/scores.png)

Let’s zoom into the individual Speedometer 2.0 line items. We doubled the performance of the React runtime by improving [`Function.prototype.bind`](https://chromium.googlesource.com/v8/v8/+/808dc8cff3f6530a627ade106cbd814d16a10a18). Vanilla-ES2015, AngularJS, Preact, and VueJS improved by 19%–42% due to [speeding up the JSON parsing](https://chromium-review.googlesource.com/c/v8/v8/+/700494) and various other performance fixes. The jQuery-TodoMVC app’s runtime was reduced by improvements to Blink’s DOM implementation, including [more lightweight form controls](https://chromium.googlesource.com/chromium/src/+/f610be969095d0af8569924e7d7780b5a6a890cd) and [tweaks to our HTML parser](https://chromium.googlesource.com/chromium/src/+/6dd09a38aaae9c15adf5aad966f761f180bf1cef). Additional tweaking of V8’s inline caches in combination with the optimizing compiler yielded improvements across the board.

![Score improvements for each Speedometer 2 subtest from Chrome 60 to 64](/_img/speedometer-2/improvements.png)

A significant change over Speedometer 1.0 is the calculation of the final score. Previously the average of all scores favoured working only on the slowest line items. When looking at the absolute times spent in each line item we see for instance that the EmberJS-Debug version takes roughly 35 times as long as the fastest benchmark. Hence to improve the overall score focusing on EmberJS-Debug has the highest potential.

![](/_img/speedometer-2/time.png)

Speedometer 2.0 uses the geometric mean for the final score, favouring equal investments into each framework. Let us consider our recent 16.5% improvement of Preact from above. It would be rather unfair to forgo the 16.5% improvement just because of its minor contribution to the total time.

We are looking forward to bring further performance improvements to Speedometer 2.0 and through that to the whole web. Stay tuned for more performance high-fives.
