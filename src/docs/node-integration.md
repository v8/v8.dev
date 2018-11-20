---
title: 'What to do if your CL broke the Node.js integration build'
---
[Node.js master](https://github.com/nodejs/node) uses V8 stable or beta. For additional integration, the V8 team builds Node with [V8 master](https://chromium.googlesource.com/v8/v8.git), i.e., with a V8 version from today. We provide integration bots for [Linux](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8%20Linux64%20-%20node.js%20integration), [Windows](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8%20Win64%20-%20node.js%20integration), and [Mac](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8%20Mac64%20-%20node.js%20integration). For each successful build, the integration bot provides an *Archive link* from which you can download a Node executable (click on the `Build #` and search for `Archive`).

If the [`v8_node_linux64_rel` bot](https://ci.chromium.org/p/v8/builders/luci.v8.try/v8_node_linux64_rel) fails on the V8 Commit Queue, there is either a legitimate problem with your CL (fix it) or [Node](https://github.com/v8/node/) must be modified. If the Node tests failed, search for “Not OK” in the log files. **This document describes how to reproduce the problem locally and how to make changes to [V8’s Node fork](https://github.com/v8/node/) if your V8 CL causes the build to fail.**

*Note: Patches in V8’s fork are usually cherry-picked by the person who updates V8 in [Node](https://github.com/nodejs/node) (usually several weeks or month later). If you merged a fix to V8’s Node fork, there’s nothing else you need to do.*

## Reproduce locally

Clone V8’s Node repository and check out the <abbr title="last known good revision">lkgr</abbr> branch.

```bash
git clone git@github.com:v8/node.git
git checkout -b vee-eight-lkgr origin/vee-eight-lkgr
```

Or, if you already have a Node checkout, add `v8/node` as remote:

```bash
cd $NODE
git remote add v8-fork git@github.com:v8/node.git
git checkout -b vee-eight-lkgr v8-fork/vee-eight-lkgr
```

Apply your patch, i.e., replace `node/deps/v8` with a copy of `v8` (lkgr branch) and build Node.

```bash
$V8/tools/node/update_node.py $V8 $NODE
cd $NODE
./configure --build-v8-with-gn && make -j48 test
```

You can run single tests.

```bash
./node test/parallel/test-that-you-want.js
```

For debug builds, set `v8_optimized_debug` in `common.gypi` to `true` and run:

```bash
./configure --debug --build-v8-with-gn && make -j48 test
```

To run the debug binary, run `./node_g` rather than `./node`.

## Make changes to Node.js

If you need to change something in [Node](https://github.com/v8/node/) so your CL doesn’t break the [build](https://ci.chromium.org/p/v8/builders/luci.v8.ci/V8%20Linux64%20-%20node.js%20integration) anymore, do the following. **You need a GitHub account for this**.

### Get the Node sources

Fork [V8’s Node repository on GitHub](https://github.com/v8/node/) (click the fork button). Clone your Node repository and check out the lkgr branch.

```bash
git clone git@github.com:your_user_name/node.git
```

If you already have a checkout of your fork of Node, you do not fork the repo. Instead, add `v8/node` as remote:

```bash
cd $NODE
git remote add v8-fork git@github.com:v8/node.git
git checkout -b vee-eight-lkgr v8-fork/vee-eight-lkgr
```

Make sure you have the correct branch and check that the current version builds and runs. Then create a new branch for your fix.

```bash
git checkout vee-eight-lkgr
./configure --build-v8-with-gn && make -j48 test
git checkout -b fix-something
```

### Apply your patch

Replace `node/deps/v8` with a copy of v8 (lkgr branch) and build Node.

```bash
$V8/tools/node/update_node.py $V8 $NODE
cd $NODE
./configure --build-v8-with-gn && make -j48 test
```

The ninja build is quite a bit faster, but does not offer a `test` target.

```bash
./configure --build-v8-with-gn && autoninja -C out/Release
tools/test.py
```

### Contribute fixes to Node

Make your changes to Node (not to `deps/v8`) and commit them.

```bash
git commit -m 'subsystem: fix something'
```

*Note: if you make several commits, please squash them into one and format according to [Node’s guidelines](https://github.com/nodejs/node/blob/master/CONTRIBUTING.md#commit-guidelines). GitHub’s review works differently than V8 Chromium and your commit messages will end up in Node exactly how you wrote them locally. (It doesn’t matter what you type in the PR message.) It’s OK to force-push onto your `fix-something` branch.*

Build and run the tests again. Double check that your formatting looks like the rest of the file.

```bash
./configure --build-v8-with-gn && make -j48 test
make lint
git push origin fix-something
```

Once you have pushed the fixes to your repository, open a Pull Request on GitHub. This sends an email to the [V8 node-js team](https://github.com/orgs/v8/teams/node-js). They will review and merge your PR. Once the PR is merged, you can run the CQ for your V8 commit again and land it. If you have specific questions, ping the [V8 node-js team](https://github.com/orgs/v8/teams/node-js) maintainers.
