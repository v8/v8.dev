---
title: 'V8 at the BlinkOn 6 conference'
author: 'the V8 team'
date: 2016-07-21 13:33:37
tags:
  - presentations
---
BlinkOn is a biannual meeting of Blink, V8, and Chromium contributors. BlinkOn 6 was held in Munich on June 16 and June 17. The V8 team gave a number of presentations on architecture, design, performance initiatives, and language implementation.

The V8 BlinkOn talks are embedded below.

## Real-world JavaScript performance

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/xCx4uC7mn6Y" width="640" height="360"></iframe>
  </div>
</figure>

- Length: 31:41
- [Slides](https://docs.google.com/presentation/d/14WZkWbkvtmZDEIBYP5H1GrbC9H-W3nJSg3nvpHwfG5U/edit)

Outlines the history of how V8 measures JavaScript performance, the different eras of benchmarking, and a new technique to measure page loads across real-world, popular websites with detailed breakdowns of time per V8 component.

## Ignition: an interpreter for V8

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/r5OWCtuKiAk" width="640" height="360"></iframe>
  </div>
</figure>

- Length: 36:39
- [Slides](https://docs.google.com/presentation/d/1OqjVqRhtwlKeKfvMdX6HaCIu9wpZsrzqpIVIwQSuiXQ/edit)

Introduces V8’s new Ignition interpreter, explaining the architecture of the engine as a whole, and how Ignition affects memory usage and startup performance.

## How we measure and optimize for RAIL in V8’s GC

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/VITAyGT-CJI" width="640" height="360"></iframe>
  </div>
</figure>

- Length: 27:11
- [Slides](https://docs.google.com/presentation/d/15EQ603eZWAnrf4i6QjPP7S3KF3NaL3aAaKhNUEatVzY/edit)

Explains how V8 uses the Response, Animation, Idle, Loading (RAIL) metrics to target low-latency garbage collection and the recent optimizations we’ve made to reduce jank on mobile.

## ECMAScript 2015 and beyond

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/KrGOzEwqRDA" width="640" height="360"></iframe>
  </div>
</figure>

- Length: 28:52
- [Slides](https://docs.google.com/presentation/d/1o1wld5z0BM8RTqXASGYD3Rvov8PzrxySghmrGTYTgw0/edit)

Provides an update on the implementation of new language features in V8, how those features integrate with the web platform, and the standards process which continues to evolve the ECMAScript language.

## Tracing wrappers from V8 to Blink (lightning talk)

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/PMDRfYw4UYQ?start=3204" width="640" height="360"></iframe>
  </div>
</figure>

- Length: 2:31
- [Slides](https://docs.google.com/presentation/d/1I6leiRm0ysSTqy7QWh33Gfp7_y4ngygyM2tDAqdF0fI/edit)

Highlights tracing wrappers between V8 and Blink objects and how they help prevent memory leaks and reduce latency.
