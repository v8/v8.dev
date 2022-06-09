---
title: 'Release blog posts to be limited to notable releases'
author: 'Shu-yu Guo ([@shu_](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2022-06-10
tags:
  - release
description: 'V8 to only have blog posts for releases if new features, notable performance improvements, or API changes are present'
---

Historically, there has been a blog post for each new release branch of V8. You may have noticed there has not been a release blog post since v9.9. From v10.0 onward, for each new branch, release blog posts will be published only if that branch includes new JavaScript or WebAssembly features, notable performance improvements, API changes, or other developer-facing changes.

## Release schedule

Every four weeks, we create a new branch of V8 as part of our [release process](https://v8.dev/docs/release-process). Each version is branched from V8’s Git main branch immediately before a Chrome Beta milestone. Such branches are in beta and become releases in coordination with the [Chrome release schedule](https://chromestatus.com/roadmap).

For the most current stable release, please also consult the [Chrome release schedule](https://chromestatus.com/roadmap).

To find a particular V8 branch for a Chrome version:

1. Take the Chrome version and divide by 10 to get the V8 version. For example, Chrome 102 is V8 10.2.
1. For a version number X.Y, its branch can be found at the URL of the following form:

```
https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/X.Y
```

For example, the 10.2 branch is at <https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/10.2>.

For more on version numbers and branches, please see [our detailed article](https://v8.dev/docs/version-numbers).

## Trying out beta branches

For a V8 version X.Y, developers with an active V8 checkout can use `git checkout -b X.Y -t branch-heads/X.Y` to experiment with the new features in that version. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html).
