---
title: 'Faster releases'
author: 'Ingvar Stepanyan ([@RReverser](https://twitter.com/RReverser))'
avatars:
  - 'ingvar-stepanyan'
date: 2021-03-04
description: 'Speeding up V8’s release cycle'
tweet: '1367546733643919370'
---
In order to ship new features and bug fixes faster to its users, Chrome is [speeding up its release cycle](https://developer.chrome.com/blog/faster-release-cycle/).

In order to match Chrome’s new release cadence, V8 will also start to tag a major release branch every 4 weeks (instead of the previous 6). Every second major release branch will also be maintained for 8 weeks for embedders who prefer to stay on a less frequent update schedule.

To learn more about the motivation and the details, check out [the Chromium blog post](https://blog.chromium.org/2021/03/speeding-up-release-cycle.html).

This change will start rolling out in Q3 of 2021, tentatively targeting Chrome 94 / V8 v9.4 as the launch milestone.

For releases that contain interesting changes in terms of language support or optimizations, we’ll continue publishing blog posts on v8.dev to keep developers and embedders up-to-date.
