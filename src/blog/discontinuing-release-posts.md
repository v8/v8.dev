---
title: 'Discontinuing release blog posts'
author: 'Shu-yu Guo ([@shu_](https://twitter.com/_shu))'
avatars:
 - 'shu-yu-guo'
date: 2022-06-17
tags:
 - release
description: 'V8 to discontinue release blog posts in favor of Chrome release schedule and feature blog posts.'
tweet: '1537857497825824768'
---

Historically, there has been a blog post for each new release branch of V8. You may have noticed there has not been a release blog post since v9.9. From v10.0 onward, we are discontinuing release blog posts for each new branch. But don’t worry, all the information you were used to getting via release blog posts are still available! Read on to see where to find that information going forward.

## Release schedule and current version

Were you reading the release blog posts to determine the most up-to-date release of V8?

V8 is on Chrome's release schedule. For the most current stable release of V8, please consult the [Chrome release roadmap](https://chromestatus.com/roadmap).

Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git main branch immediately before a Chrome Beta milestone. Such branches are in beta and become releases in coordination with the [Chrome release roadmap](https://chromestatus.com/roadmap).

To find a particular V8 branch for a Chrome version:

1. Take the Chrome version and divide by 10 to get the V8 version. For example, Chrome 102 is V8 10.2.
1. For a version number X.Y, its branch can be found at the URL of the following form:

```
https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/X.Y
```

For example, the 10.2 branch can be found at <https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/10.2>.

For more on version numbers and branches, please see [our detailed article](https://v8.dev/docs/version-numbers).

For a V8 version X.Y, developers with an active V8 checkout can use `git checkout -b X.Y -t branch-heads/X.Y` to experiment with the new features in that version.

## New JavaScript or WebAssembly features

Were you reading the release blog posts to find out what new JavaScript or WebAssembly features were implemented behind a flag or were turned on by default?

Please consult the [Chrome release roadmap](https://chromestatus.com/roadmap), which lists new features and their milestones for each release.

Note that [the separate, deep-dive feature articles](/features) may be published before or after the feature has been implemented in V8.

## Notable performance improvements

Were you reading the release blog posts to learn about notable performance improvements?

Going forward, we will write independent blog posts for performance improvements that we wish to call out, as we have done so in the past for improvements like [Sparkplug](https://v8.dev/blog/sparkplug).

## API changes

Were you reading the release blog posts to learn about API changes?

To see the list of commits that modified the V8 API between an earlier version A.B and a later version X.Y, please use `git log branch-heads/A.B..branch-heads/X.Y include/v8\*.h` in an active V8 checkout.
