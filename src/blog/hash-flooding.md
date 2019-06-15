---
title: 'About that hash flooding vulnerability in Node.js…'
author: 'Yang Guo ([@hashseed](https://twitter.com/hashseed))'
avatars:
  - 'yang-guo'
date: 2017-08-11 13:33:37
tags:
  - security
---
Early July this year, Node.js released a [security update](https://nodejs.org/en/blog/vulnerability/july-2017-security-releases/) for all currently maintained branches to address a hash flooding vulnerability. This intermediate fix comes at the cost of a significant startup performance regression. In the meantime, V8 has implemented a solution which avoids the performance penalty.

In this post, we want to give some background and history on the vulnerability and the eventual solution.

## Hash flooding attack

Hash tables are one of the most important data structures in computer science. They are widely used in V8, for example to store an object’s properties. On average, inserting a new entry is very efficient at [𝒪(1)](https://en.wikipedia.org/wiki/Big_O_notation). However, hash collisions could lead to a worst case of 𝒪(n). That means that inserting n entries can take up to 𝒪(n²).

In Node.js, [HTTP headers](https://nodejs.org/api/http.html#http_response_getheaders) are represented as JavaScript objects. Pairs of header name and values are stored as object properties. With cleverly prepared HTTP requests, an attacker could perform a denial-of-service attack. A Node.js process would become unresponsive, being busy with worst-case hash table insertions.

This attack has been disclosed as early as [December of 2011](https://events.ccc.de/congress/2011/Fahrplan/events/4680.en.html), and shown to affect a wide range of programming languages. How come it took this long for V8 and Node.js to finally address this issue?

In fact, very soon after the disclosure, V8 engineers worked with the Node.js community on a [mitigation](https://github.com/v8/v8/commit/81a0271004833249b4fe58f7d64ae07e79cffe40). From Node.js v0.11.8 onwards, this issue had been addressed. The fix introduced a so-called _hash seed value_. The hash seed is randomly chosen at startup and used to seed every hash value in a particular V8 instance. Without the knowledge of the hash seed, an attacker has a hard time to hit the worst-case, let alone come up with an attack that targets all Node.js instances.

This is part of the [commit](https://github.com/v8/v8/commit/81a0271004833249b4fe58f7d64ae07e79cffe40) message of the fix:

> This version only solves the issue for those that compile V8 themselves or those that do not use snapshots. A snapshot-based precompiled V8 will still have predictable string hash codes.

This version only solves the issue for those that compile V8 themselves or those that do not use snapshots. A snapshot-based precompiled V8 will still have predictable string hash codes.

## Startup snapshot

Startup snapshots are a mechanism in V8 to dramatically speed up both engine startup and creating new contexts (i.e. via the [vm module](https://nodejs.org/api/vm.html) in Node.js). Instead of setting up initial objects and internal data structures from scratch, V8 deserializes from an existing snapshot. An up-to-date build of V8 with snapshot starts up in less than 3ms, and requires a fraction of a millisecond to create a new context. Without the snapshot, startup takes more than 200ms, and a new context more than 10ms. This is a difference of two orders of magnitude.

We covered how any V8 embedder can take advantage of startup snapshots in [a previous post](/blog/custom-startup-snapshots).

A pre-built snapshot contains hash tables and other hash-value-based data structures. Once initialized from snapshot, the hash seed can no longer be changed without corrupting these data structures. A Node.js release that bundles the snapshot has a fixed hash seed, making the mitigation ineffective.

That is what the explicit warning in the commit message was about.

## Almost fixed, but not quite

Fast-forward to 2015, a Node.js [issue](https://github.com/nodejs/node/issues/1631) reports that creating a new context has regressed in performance. Unsurprisingly, this is because the startup snapshot has been disabled as part of the mitigation. But by that time not everyone participating in the discussion was aware of the [reason](https://github.com/nodejs/node/issues/528#issuecomment-71009086).

As explained in this [post](/blog/math-random), V8 uses a pseudo-random number generator to generate Math.random results. Every V8 context has its own copy of the random number generate state. This is to prevent Math.random results from being predictable across contexts.

The random number generator state is seeded from an external source right after the context is created. It does not matter whether the context is created from scratch, or deserialized from snapshot.

Somehow, the random number generator state has been [confused](https://github.com/nodejs/node/issues/1631#issuecomment-100044148) with the hash seed. As result, a pre-built snapshot started being part of the official release since [io.js v2.0.2](https://github.com/nodejs/node/pull/1679).

## Second attempt

It was not until May 2017, during some internal discussions between V8, [Google’s Project Zero](https://googleprojectzero.blogspot.com/), and Google’s Cloud Platform, when we realized that Node.js was still vulnerable to hash flooding attacks.

The initial response came from our colleagues [Ali](https://twitter.com/ofrobots) and [Myles](https://twitter.com/MylesBorins) from the team behind [Google Cloud Platform's Node.js offerings](https://cloud.google.com/nodejs/). They worked with the Node.js community to [disable startup snapshot](https://github.com/nodejs/node/commit/eff636d8eb7b009c40fb053802c169ba1417293d) by default, again. This time around, they also added a [test case](https://github.com/nodejs/node/commit/9fedc1f09648ff7cebed65883966f5647686a38a).

But we did not want to leave it at that. Disabling startup snapshot has [significant](https://github.com/nodejs/node/issues/14229) performance impacts. Over the years, we have added many new [language](/blog/high-performance-es2015)  [features](/blog/webassembly-browser-preview) and [sophisticated](/blog/launching-ignition-and-turbofan)  [optimizations](/blog/speeding-up-regular-expressions) to V8. Some of these additions made starting up from scratch even more expensive. Immediately after the security release, we started working on a long-term solution. The goal is to be able to [re-enable startup snapshot](https://github.com/nodejs/node/issues/14171) without becoming vulnerable to hash flooding.

From [proposed solutions](https://docs.google.com/document/d/1br7T3jk5JAJSYaT8eZdQlqrPTDRClheGpRU1-BpY1ss/edit), we chose and implemented the most pragmatic one. After deserializing from snapshot, we would choose a new hash seed. Affected data structures are then rehashed to ensure consistency.

As it turns out, in an ordinary startup snapshot few data structures are actually affected. And to our delight, [rehashing hash tables](https://github.com/v8/v8/commit/0e8e0030775518b69eb8522823ea3754e6bddc69) have been made easy in V8 in the meantime. The overhead this adds is insignificant.

The patch to re-enable startup snapshot has been [merged](https://github.com/nodejs/node/commit/2ae2874ae7dfec2c55b5d390d25b6eed9932f78d) [into](https://github.com/nodejs/node/commit/14e4254f68f71a6afaf3ebe16794172b08e68d7b) Node.js. It is part of the recent Node.js v8.3.0 [release](https://medium.com/the-node-js-collection/node-js-8-3-0-is-now-available-shipping-with-the-ignition-turbofan-execution-pipeline-aa5875ad3367).
