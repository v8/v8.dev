---
title: 'Implementing and shipping JavaScript/WebAssembly language features'
description: 'This document explains the process for implementing and shipping JavaScript or WebAssembly language features in V8.'
---
In general, V8 follows the [Blink Intent process for already-defined consensus-based standards](https://www.chromium.org/blink/launching-features/#process-existing-standard) for JavaScript and WebAssembly language features. V8-specific errata are laid out below. Please follow the Blink Intent process, unless the errata tells you otherwise.

If you have any questions on this topic for JavaScript features, please email syg@chromium.org and v8-dev@googlegroups.com.

For WebAssembly features, please email gdeepti@chromium.org and v8-dev@googlegroups.com.

## Errata

### JavaScript features usually wait until Stage 3+ { #stage3plus }

As a rule of thumb, V8 waits to implement JavaScript feature proposals until they advance to [Stage 3 or later in TC39](https://tc39.es/process-document/). TC39 has its own consensus process, and Stage 3 or later signals explicit consensus among TC39 delegates, including all browser vendors, that a feature proposal is ready to implement. This external consensus process means Stage 3+ features do not need to send Intent emails other than Intent to Ship.

### TAG review { #tag }

For smaller JavaScript or WebAssembly features, a TAG review is not required, as TC39 and the Wasm CG already provide significant technical oversight. If the feature is large or cross-cutting (e.g., requires changes to other Web Platform APIs or modifications to Chromium), TAG review is recommended.

### Both V8 and blink flags are required { #flags }

When implementing a feature, both a V8 flag and a blink `base::Feature` are required.

Blink features are required so that Chrome can turn off features without distributing new binaries in emergency situations. This is usually implemented in [`gin/gin_features.h`](https://source.chromium.org/chromium/chromium/src/+/main:gin/gin_features.h), [`gin/gin_features.cc`](https://source.chromium.org/chromium/chromium/src/+/main:gin/gin_features.cc), and [`gin/v8_initializer.cc`](https://source.chromium.org/chromium/chromium/src/+/main:gin/v8_initializer.cc),

### Fuzzing is required to ship { #fuzzing }

JavaScript and WebAssembly features must be fuzzed, and all fuzz bugs must be fixed, before they can be shipped.

For code-complete JavaScript features, start fuzzing by moving the feature flag to the `JAVASCRIPT_STAGED_FEATURES_BASE` macro in [`src/flags/flag-definitions.h`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/flags/flag-definitions.h).

For WebAssembly, see the [WebAssembly shipping checklist](/docs/wasm-shipping-checklist).

### Instead of WPT, Test262 and WebAssembly spec tests are sufficient { #tests }

Adding Web Platform Tests (WPT) is not required, as JavaScript and WebAssembly language features have their own interoperable test repositories that are run by multiple implementations. Feel free to add some though, if you think it is beneficial.

For JavaScript features, explicit correctness tests in [Test262](https://github.com/tc39/test262) are required. Note that tests in the [staging directory](https://github.com/tc39/test262/blob/main/CONTRIBUTING.md#staging) suffice.

For WebAssembly features, explicit correctness tests in the [WebAssembly Spec Test repo](https://github.com/WebAssembly/spec/tree/master/test) are required.

### Who to CC { #cc }

**Every** “intent to `$something`” email (e.g. “intent to implement”) should CC <v8-users@googlegroups.com> in addition to <blink-dev@chromium.org>. This way, other embedders of V8 are kept in the loop too.

### Link to the spec repo { #spec }

The Blink Intent process requires an explainer. Instead of writing a new doc, feel free to link to respective spec repository instead (e.g. [`import.meta`](https://github.com/tc39/proposal-import-meta)).
