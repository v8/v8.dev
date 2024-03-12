---
title: 'WebAssembly JSPI is going to origin trial'
description: 'We explain the start of the origin trial for JSPI'
author: 'Francis McCabe, Thibaud Michaud, Ilya Rezvov, Brendan Dahl'
date: 2024-03-06
tags:
  - WebAssembly
---
WebAssembly’s JavaScript Promise Integration (JSPI) API is entering an origin trial, with Chrome release M123. What that means is that you can test whether you and your users can benefit from this new API.

JSPI is an API that allows so-called sequential code – that has been compiled to WebAssembly – to access Web APIs that are _asynchronous_. Many Web APIs are crafted in terms of JavaScript `Promise`s: instead of immediately performing the requested operation they return a `Promise` to do so. When the action is finally performed, the browser’s task runner invokes any callbacks with the Promise. JSPI hooks into this architecture to allow a WebAssembly application to be suspended when the `Promise` is returned and resumed when the `Promise` is resolved.

You can find out more about JSPI and how to use it [here](https://v8.dev/blog/jspi) and the specification itself is [here](https://github.com/WebAssembly/js-promise-integration).

## Requirements

Apart from registering for an origin trial, you will also need to generate the appropriate WebAssembly and JavaScript. If you are using Emscripten, then this is straightforward. You should ensure that you are using at least version 3.1.47.

## Registering for the origin trial

JSPI is still pre-release; it is going through a standardization process and will not be fully released until we get to phase 4 of that process. To use it today, you can set a flag in the Chrome browser; or, you can apply for an origin trial token that will allow your users to access it without having to set the flag themselves.

To register you can go [here](https://developer.chrome.com/origintrials/#/register_trial/1603844417297317889), make sure to follow the registration signup process. To find out more about origin trials in general, [this](https://developer.chrome.com/docs/web-platform/origin-trials) is a good starting place.

## Some potential caveats

There have been some [discussions](https://github.com/WebAssembly/js-promise-integration/issues) in the WebAssembly community about some aspects of the JSPI API. As a result, there are some changes indicated, which will take time to fully work their way through the system. We anticipate that these changes will be *soft launched*: we will share the changes as they become available, however, the existing API will be maintained until at least the end of the origin trial.

In addition, there are some known issues that are unlikely to be fully addressed during the origin trial period:

For applications that intensively create spawned-off computations, the performance of a wrapped sequence (i.e., using JSPI to access an asynchronous API) may suffer. This is because the resources used when creating the wrapped call are not cached between calls; we rely on garbage collection to clear up the stacks that are created.
We currently allocate a fixed size stack for each wrapped call. This stack is necessarily large in order to accommodate complex applications. However, it also means that an application that has a large number of simple wrapped calls _in flight_ may experience memory pressure.

Neither of these issues are likely to impede experimentation with JSPI; we expect them to be addressed before JSPI is officially released.

## Feedback

Since JSPI is a standards-track effort, we prefer that any issues and feedback be shared [here](https://github.com/WebAssembly/js-promise-integration/issues). However, bug reports can be raised at the standard Chrome bug reporting [site](https://issues.chromium.org/new). If you suspect a problem with code generation, use [this](https://github.com/emscripten-core/emscripten/issues) to report an issue.

Finally, we would like to hear about any benefits that you uncovered. Use the [issue tracker](https://github.com/WebAssembly/js-promise-integration/issues) to share your experience.
