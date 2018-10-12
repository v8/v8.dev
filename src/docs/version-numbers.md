---
title: 'V8’s version numbering scheme'
---
V8 version numbers are of the form `x.y.z.w`, where:

- `x.y` is the Chromium milestone divided by 10 (e.g. M60 → `6.0`)
- `z` is automatically bumped whenever there’s a new [LKGR](https://www.chromium.org/glossary#TOC-Acronyms) (typically a few times per day)
- `w` is bumped for manually backmerged patches after a branch point

If `w` is `0`, it’s omitted from the version number. E.g. v5.9.211 (instead of “v5.9.211.0”) gets bumped up to v5.9.211.1 after backmerging a patch.

## Which V8 version should I use?

Embedders of V8 should generally use *the head of the branch corresponding to the minor version of V8 that ships in Chrome*.

### Finding the minor version of V8 corresponding to the latest stable Chrome

To find out what version this is,

1. Go to <https://omahaproxy.appspot.com/>
2. Find the latest stable Chrome version in the table
3. Check the `v8_version` column (to the right) on the same row

Example: at the time of this writing, the site indicates that for `mac`/`stable`, the Chrome release version is 59.0.3071.86, which corresponds to V8 version 5.9.211.31.

### Finding the head of the corresponding branch

V8’s version-related branches do not appear in the online repository at <https://chromium.googlesource.com/v8/v8.git>; instead only tags appear. To find the head of that branch, go to the URL in this form:

```
https://chromium.googlesource.com/v8/v8.git/+/branch-heads/<minor-version>
```

Example: for the V8 minor version 5.9 found above, we go to <https://chromium.googlesource.com/v8/v8.git/+/branch-heads/5.9>, finding a commit titled “Version 5.9.211.33”. Thus, the version of V8 that embedders should use at the time of this writing is **5.9.211.33**.

**Caution:** You should *not* simply find the numerically-greatest tag corresponding to the above minor V8 version, as sometimes those are not supported, e.g. they are tagged before deciding where to cut minor releases. Such versions do not receive backports or similar.

Example: the V8 tags `5.9.212`, `5.9.213`, `5.9.214`, `5.9.214.1`, …, and `5.9.223` are abandoned, despite being numerically greater than the **branch head** of 5.9.211.33.

### Checking out the head of the corresponding branch

If you have the source already, you can check out the head somewhat directly. If you’ve retrieved the source using `depot_tools` then you should be able to do

```bash
git branch --remotes | grep branch-heads/
```

to list the relevant branches. You'll want to check out the one corresponding to the minor V8 version you found above, and use that. The tag that you end up on is the appropriate V8 version for you as the embedder.

If you did not use `depot_tools`, edit `.git/config` and add the line below to the `[remote "origin"]` section:

```
fetch = +refs/branch-heads/*:refs/remotes/branch-heads/*
```

Example: for the V8 minor version 5.9 found above, we can do:

```bash
$ git checkout branch-heads/5.9
HEAD is now at 8c3db649d8... Version 5.9.211.33
```
