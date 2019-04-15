---
title: 'Implementing and shipping JavaScript/WebAssembly language features'
---

In general, V8 uses the [Blink Intent process](https://www.chromium.org/blink/launching-features) for JavaScript and WebAssembly language features. The differences are layed out in the errata below. Please follow the Blink Intent process, except the errata tells you otherwhise.

## Errata

### TAG review for JavaScript features is not required
JavaScript features do not need to go through a TAG review. There is no added
value perceived for pure JS features.

