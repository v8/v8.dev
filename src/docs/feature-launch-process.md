---
title: 'Implementing and shipping JavaScript/WebAssembly language features'
---

In general, V8 uses the [Blink Intent process](https://www.chromium.org/blink/launching-features) for JavaScript and WebAssembly language features. The differences are laid out in the errata below. Please follow the Blink Intent process, unless the errata tells you otherwise.

If you have any questions on this topic, please send hablich@chromium.org and v8-dev@googlegroups.com an email.

## Errata

### TAG review { #tag }

For smaller JavaScript or WebAssembly features, a TAG review is not required, as TC39 and the Wasm CG already provide significant technical oversight. If the feature is large or cross-cutting (e.g., requires changes to other Web Platform APIs or modifications to Chromium), TAG review is recommended.

### Instead of WPT, Test262 and WebAssembly spec tests are sufficient { #tests }

Adding Web Platform Tests (WPT) is not required, as JavaScript and WebAssembly language features have their own test repositories. Feel free to add some though, if you think it is beneficial.

For JavaScript features, explicit correctness tests in [Test262](https://github.com/tc39/test262) are preferred and required.

For WebAssembly features, explicit correctness tests in the [WebAssembly Spec Test repo](https://github.com/WebAssembly/spec/tree/master/test) are required.

### Who to CC { #cc }

**Every** “intent to `$something`” email (e.g. “intent to implement”) should CC <v8-users@googlegroups.com> in addition to <blink-dev@chromium.org>. This way, other embedders of V8 are kept in the loop too.

### Link to the spec repo { #spec }

The Blink Intent process requires an explainer. Instead of writing a new doc, feel free to link to respective spec repository instead (e.g. [`import.meta`](https://github.com/tc39/proposal-import-meta)).
