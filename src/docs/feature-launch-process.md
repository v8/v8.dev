---
title: 'Implementing and shipping JavaScript/WebAssembly language features'
---

In general, V8 uses the [Blink Intent process](https://www.chromium.org/blink/launching-features) for JavaScript and WebAssembly language features. The differences are layed out in the errata below. Please follow the Blink Intent process, except the errata tells you otherwhise.

## Errata

### TAG review for JavaScript features is not required
JavaScript features do not need to go through a TAG review. There is no added
value perceived for pure JS features.

### Instead of WPT, test262 and WebAssembly spec tests are sufficient

Adding tests to the Web Platform Tests (WPT) is not required, as JavaScript and
WebAssembly language features have their own test repositories. Feel free to add
some though, if you think it is beneficial.

For JavaScript features explicit tests around the feature in
[test262](https://github.com/tc39/test262) are
preferred and required.

For WebAssembly features explicit tests around the feature in the [WebAssembly
Spec Test repo](https://github.com/WebAssembly/spec/tree/master/test) are required.
