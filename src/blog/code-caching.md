---
title: 'Code caching'
author: 'Yang Guo ([@hashseed](https://twitter.com/hashseed)), Software Engineer'
avatars:
  - 'yang-guo'
date: 2015-07-27 13:33:37
tags:
  - internals
---
V8 uses [just-in-time compilation](https://en.wikipedia.org/wiki/Just-in-time_compilation) (JIT) to execute JavaScript code. This means that immediately prior to running a script, it has to be parsed and compiled — which can cause considerable overhead. As we [announced recently](https://blog.chromium.org/2015/03/new-javascript-techniques-for-rapid.html), code caching is a technique that lessens this overhead. When a script is compiled for the first time, cache data is produced and stored. The next time V8 needs to compile the same script, even in a different V8 instance, it can use the cache data to recreate the compilation result instead of compiling from scratch. As a result the script is executed much sooner.

Code caching has been available since V8 version 4.2 and not limited to Chrome alone. It is exposed through V8’s API, so that every V8 embedder can take advantage of it. The [test case](https://chromium.googlesource.com/v8/v8.git/+/4.5.56/test/cctest/test-api.cc#21090) used to exercise this feature serves as an example of how to use this API.

When a script is compiled by V8, cache data can be produced to speed up later compilations by passing `v8::ScriptCompiler::kProduceCodeCache` as an option. If the compilation succeeds, the cache data is attached to the source object and can be retrieved via `v8::ScriptCompiler::Source::GetCachedData`. It can then be persisted for later, for example by writing it to disk.

During later compilations, the previously produced cache data can be attached to the source object and passed `v8::ScriptCompiler::kConsumeCodeCache` as an option. This time, code will be produced much faster, as V8 bypasses compiling the code and deserializes it from the provided cache data.

Producing cache data comes at a certain computational and memory cost. For this reason, Chrome only produces cache data if the same script is seen at least twice within a couple of days. This way Chrome is able to turn script files into executable code twice as fast on average, saving users valuable time on each subsequent page load.
