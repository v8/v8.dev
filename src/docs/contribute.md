---
title: 'Contributing to V8'
---
The information on this page explains how to contribute to V8. Be sure to read the whole thing before sending us a contribution.

## Get the code

See [Checking out the V8 source code](/docs/source-code).

## Before you contribute

### Ask on V8’s mailing list for guidance

Before you start working on a larger V8 contribution, you should get in touch with us first through [the V8 contributor mailing list](https://groups.google.com/group/v8-dev) so we can help out and possibly guide you. Coordinating up front makes it much easier to avoid frustration later on.

### Sign the CLA

Before we can use your code you have to sign the [Google Individual Contributor License Agreement](https://cla.developers.google.com/about/google-individual), which you can do online. This is mainly because you own the copyright to your changes, even after your contribution becomes part of our codebase, so we need your permission to use and distribute your code. We also need to be sure of various other things, for instance that you’ll tell us if you know that your code infringes on other people’s patents. You don’t have to do this until after you’ve submitted your code for review and a member has approved it, but you will have to do it before we can put your code into our codebase.

Contributions made by corporations are covered by a different agreement than the one above, the [Software Grant and Corporate Contributor License Agreement](https://cla.developers.google.com/about/google-corporate).

Sign them online [here](https://cla.developers.google.com/).

## Submit your code

The source code of V8 follows the [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html) so you should familiarize yourself with those guidelines. Before submitting code you must pass all our [tests](/docs/test), and have to successfully run the presubmit checks:

```bash
tools/presubmit.py
```

The presubmit script uses a linter from Google, `cpplint.py`. External contributors can get this from [here](https://raw.githubusercontent.com/google/styleguide/gh-pages/cpplint/cpplint.py) and place it in their path.

### Upload to V8’s codereview tool

All submissions, including submissions by project members, require review. We use the same code-review tools and process as the Chromium project. In order to submit a patch, you need to get the [`depot_tools`](https://dev.chromium.org/developers/how-tos/install-depot-tools) and follow these instructions on [requesting a review](https://dev.chromium.org/developers/contributing-code) (using your V8 workspace instead of a Chromium workspace).

### Look out for breakage or regressions

Before submitting your code please check [the buildbot console](https://build.chromium.org/p/client.v8/console) to see that the columns are mostly green before checking in your changes — otherwise you will not know if your changes break the build or not. When your change is committed, watch [the buildbot console](https://build.chromium.org/p/client.v8/console) until the bots turn green after your change.
