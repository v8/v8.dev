---
title: 'What to do if your CL broke the Node.js integration build'
---

[Node.js master](https://github.com/nodejs/node) uses V8 stable or beta. For additional integration, the V8 team builds Node with [V8 master](https://chromium.googlesource.com/v8/v8.git), i.e., with a V8 version from today. We provide integration bots for [Linux](https://ci.chromium.org/p/node-ci/builders/ci/Node-CI%20Linux64/), [Windows](https://ci.chromium.org/p/node-ci/builders/ci/Node-CI%20Win64/), and [Mac](https://ci.chromium.org/p/node-ci/builders/ci/Node-CI%20Mac64/).

If the [`node_ci_linux64_rel` bot](https://ci.chromium.org/p/node-ci/builders/try/node_ci_linux64_rel/) fails on the V8 Commit Queue, there is either a legitimate problem with your CL (fix it) or [Node](https://github.com/v8/node/) must be modified. If the Node tests failed, search for “Not OK” in the log files. **This document describes how to reproduce the problem locally and how to make changes to [V8’s Node fork](https://github.com/v8/node/) if your V8 CL causes the build to fail.**

## Source

Follow the [instructions](https://chromium.googlesource.com/v8/node-ci) at the node-ci repository to check out source.

## Test changes to V8

V8 is set up as a DEPS dependency of node-ci. You may want to apply changes to V8 for testing or to reproduce failures. To do so, add your main V8 checkout as remote:

```bash
cd v8
git remote add v8 <your-v8-dir>/.git
git fetch v8
git checkout v8/<your-branch>
cd ..
```

Remember to run gclient hooks before compiling.

```bash
gclient runhooks
JOBS=4 make test
```

## Make changes to Node.js

Node.js is also set up as a `DEPS` dependency of node-ci. You may want to apply changes to Node.js to fix breakages that V8 changes may cause. V8 tests against a [fork of Node.js](https://github.com/v8/node). You need a GitHub account to make changes to that fork.

### Get the Node sources

Fork [V8’s Node.js repository on GitHub](https://github.com/v8/node/) (click the fork button) unless you already did previously.

Add your both your fork and V8’s fork as remotes to the existing checkout:

```bash
git remote add v8 http://github.com/v8/node
git remote add <your-user-name> http://github.com//<your-user-name>/node
git fetch
git checkout node-ci-<sync-date>
git checkout -b make-changes
```

Make your changes to the Node.js checkout, and commit them. Then push the changes to GitHub and create a pull request against the branch `node-ci-<sync-date>`.

Note: `<sync-date>` is the date we sync'ed with upstream Node.js. Choose the latest date.

```bash
git push <your-user-name> make-changes
```

Once the pull request has been merged to V8’s fork of Node.js, you need to update node-ci’s `DEPS` file, and create a CL.

```bash
git checkout -b update-deps
gclient setdep --var=node_revision=`(cd node && git rev-parse make-changes)`
git add DEPS
git commit -m 'Update Node'
git cl upload
```
