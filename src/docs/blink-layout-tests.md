---
title: 'Blink web tests (a.k.a. layout tests)'
---
We continuously run [Blink’s web tests (formerly known as “layout tests”)](https://chromium.googlesource.com/chromium/src/+/master/docs/testing/web_tests.md) on our [FYI waterfall](https://ci.chromium.org/p/v8/g/fyi/console?branch=master) to prevent integration problems with Chromium.

On test failures, the bots compare the results of V8 Tip-of-Tree with Chromium’s pinned V8 version, to only flag newly introduced V8 problems (with false positives < 5%). Blame assignment is trivial as the [Linux release](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8-Blink%20Linux%2064) bot tests all revisions.

Commits with newly introduced failures are normally reverted to unblock auto-rolling into Chromium. In case you break layout tests and the changes are expected, follow this procedure:

1. Land a Chromium change setting `[ Failure Pass ]` for the changed tests ([more](https://chromium.googlesource.com/chromium/src/+/master/docs/testing/web_test_expectations.md#How-to-rebaseline)).
1. Land your V8 CL and wait 1-2 days until it cycles into Chromium.
1. Switch `[ Failure Pass ]` to `[ NeedsRebaseline ]` in Chromium. Tests will be automatically rebaselined.

Please associate all CLs with a `BUG=…`.
