---
title: 'V8 release v8.0'
author: 'Leszek Swirski, V8th of his name'
avatars:
  - 'leszek-swirski'
date: 2019-12-18
tags:
  - release
description: 'V8 v8.0 features optional chaining, nullish coalescing, faster higher-order builtins — oh and 40% less memory use thanks to pointer compression, no big deal.'
tweet: '1207323849861279746'
---

<!-- Yes, it's an SVG. Please don't ask me how long I spent making it. -->
<!-- markdownlint-capture -->
<!-- markdownlint-disable no-inline-html -->
<div style="position: relative; left: 50%; margin-left: -45vw; width: 90vw; pointer-events: none">
<div style="width: 1075px; max-width:100%; margin:0 auto">
<svg xmlns="http://www.w3.org/2000/svg" width="1075" height="260" viewBox="-5 140 1075 260" style="display:block;width:100%;height:auto;margin-top:-4%;margin-bottom:-1em"><style>a{pointer-events: auto}text{font-family:Helvetica,Roboto,Segoe UI,Calibri,sans-serif;fill:#1c2022;font-weight:400}.bg,.divider{stroke:#e1e8ed;stroke-width:.8;fill:#fff}a.name text{font-weight:700}.subText,a.like text,a.name .subText{fill:#697882;font-size:14px;font-weight:400}a.like path{fill:url(#b)}a:hover text,a:focus text{fill:#3b94d9}a.like:hover text,a.like:focus text{fill:#e0245e}a.like:hover path,a.like:focus path{fill:url(#B)}.dark .bg{stroke:#66757f;fill:#000}.dark text{fill:#f5f8fa}.dark .subText,.dark a.name .subText,.dark a.like text{fill:#8899a6}.dark a:hover text,.dark a:focus text{fill:#55acee}.dark a.like:hover text,.dark a.like:focus text{fill:#e0245e}</style><defs><pattern id="a" width="1" height="1" patternContentUnits="objectBoundingBox" patternUnits="objectBoundingBox"><image width="1" height="1" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 72 72%22><path fill=%22none%22 d=%22M0 0h72v72H0z%22/><path class=%22icon%22 fill=%22%231da1f2%22 d=%22M68.812 15.14c-2.348 1.04-4.87 1.744-7.52 2.06 2.704-1.62 4.78-4.186 5.757-7.243-2.53 1.5-5.33 2.592-8.314 3.176C56.35 10.59 52.948 9 49.182 9c-7.23 0-13.092 5.86-13.092 13.093 0 1.026.118 2.02.338 2.98C25.543 24.527 15.9 19.318 9.44 11.396c-1.125 1.936-1.77 4.184-1.77 6.58 0 4.543 2.312 8.552 5.824 10.9-2.146-.07-4.165-.658-5.93-1.64-.002.056-.002.11-.002.163 0 6.345 4.513 11.638 10.504 12.84-1.1.298-2.256.457-3.45.457-.845 0-1.666-.078-2.464-.23 1.667 5.2 6.5 8.985 12.23 9.09-4.482 3.51-10.13 5.605-16.26 5.605-1.055 0-2.096-.06-3.122-.184 5.794 3.717 12.676 5.882 20.067 5.882 24.083 0 37.25-19.95 37.25-37.25 0-.565-.013-1.133-.038-1.693 2.558-1.847 4.778-4.15 6.532-6.774z%22/></svg>"/></pattern><pattern id="b" width="1" height="1" patternContentUnits="objectBoundingBox" patternUnits="objectBoundingBox"><image width="1" height="1" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22><path class=%22icon%22 fill=%22%23697882%22 d=%22M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.813-1.148 2.353-2.73 4.644-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.375-7.454 13.11-10.037 13.156H12zM7.354 4.225c-2.08 0-3.903 1.988-3.903 4.255 0 5.74 7.035 11.596 8.55 11.658 1.52-.062 8.55-5.917 8.55-11.658 0-2.267-1.822-4.255-3.902-4.255-2.528 0-3.94 2.936-3.952 2.965-.23.562-1.156.562-1.387 0-.015-.03-1.426-2.965-3.955-2.965z%22/></svg>"/></pattern><pattern id="B" width="1" height="1" patternContentUnits="objectBoundingBox" patternUnits="objectBoundingBox"><image width="1" height="1" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22><path class=%22icon%22 fill=%22%23E0245E%22 d=%22M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.813-1.148 2.353-2.73 4.644-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.375-7.454 13.11-10.037 13.156H12zM7.354 4.225c-2.08 0-3.903 1.988-3.903 4.255 0 5.74 7.035 11.596 8.55 11.658 1.52-.062 8.55-5.917 8.55-11.658 0-2.267-1.822-4.255-3.902-4.255-2.528 0-3.94 2.936-3.952 2.965-.23.562-1.156.562-1.387 0-.015-.03-1.426-2.965-3.955-2.965z%22/></svg>"/></pattern></defs><g><path class="bg" d="M-2.2 222.4l398.4-34.8 13.6 127.3-398.4 34.8z"/><g transform="rotate(-5 830.8 -212.3) scale(.8)"><image width="36" height="36" x="-25.2" y="206.2" href="/_img/v8-release-80/twitter-avatar-1.jpg"/><a class="name"><text x="66" y="21"><tspan x="19.8" y="218.6">Josebaba 💥</tspan></text><text x="66" y="42" class="subText"><tspan x="19.8" y="235.4">@fullstackmofo</tspan></text></a><path fill="url(#a)" d="M412.8 206.2h20v20h-20z"/><text x="21" y="72" class="subText"><tspan x="-25.2" y="266.8">Replying to @v8js</tspan></text></a><text x="21" y="93"><tspan x="-25.2" y="291.2">V8 almost at v8</tspan></text><a class="like"><path d="M-25.2 307.4h17.5v17.5h-17.5z"/><text x="42" y="125" class="subText"><tspan x="-4.7" y="321.2">4</tspan></text></a><a href="https://twitter.com/fullstackmofo/status/1197260632237780994"><text x="61" y="126" class="subText"><tspan x="15.1" y="321.2">22:09 - 20 Nov 2019</tspan></text></a></g></g><g><path class="bg" d="M147.2 238.9l399 27.9-10.8 127-399-28z"/><g transform="rotate(4 -638.7 1274.7) scale(.8)"><image width="36" height="36" x="112.3" y="254.2" href="/_img/v8-release-80/twitter-avatar-2.jpg"/><a class="name"><text x="66" y="21"><tspan x="157.3" y="264.8">Connor ‘Stryxus’ Shearer</tspan></text><text x="66" y="40" class="subText"><tspan x="157.3" y="281.6">@Stryxus</tspan></text></a><path fill="url(#a)" d="M550.3 254.2h20v20h-20z"/><text x="21" y="71" class="subText"><tspan x="112.3" y="314">Replying to @v8js</tspan></text><g data-id="p"><text x="21" y="92"><tspan x="112.3" y="339.2">What happens when v8 reaches v8? 🤔</tspan></text></g><a class="like"><path d="M112.3 355.4h17.5v17.5h-17.5z"/><text x="42" y="125"><tspan x="132.8" y="369.2">11</tspan></text></a><a  href="https://twitter.com/Stryxus/status/1197187677747122176"><text x="68" y="126" class="subText"><tspan x="159.4" y="369.2">17:19 - 20 Nov 2019</tspan></text></a></g></g><g><path class="bg" d="M383.2 179.6l399.8-14 5.4 126.6-399.8 14z"/><g transform="rotate(-2 1958.9 -3131) scale(.8)"><image width="36" height="36" x="356.8" y="174.2" href="/_img/v8-release-80/twitter-avatar-3.jpg"/><a class="name"><text x="66" y="21"><tspan x="401.8" y="184.8">Thibault Molleman</tspan></text><text x="66" y="40" class="subText"><tspan x="401.8" y="201.6">@thibaultmol</tspan></text></a><path fill="url(#a)" d="M794.8 174.2h20v20h-20z"/><text x="21" y="71" class="subText"><tspan x="356.8" y="234">Replying to @v8js</tspan></text><text x="21" y="92"><tspan x="356.8" y="258.4">Wait. What happens when we get V8 V8?</tspan></text><a class="like"><path d="M356.8 274.6h17.5v17.5h-17.5z"/></a><a href="https://twitter.com/thibaultmol/status/1141656354169470976"><text x="54" y="125" class="subText"><tspan x="389.3" y="288.4">11:37 - 20 Jun 2019</tspan></text></a></g></g><g><path class="bg" d="M522 272.1l400-7 2.6 127.4-400 7z"/><g transform="rotate(-1 4619.2 -7976.5) scale(.8)"><image width="36" height="36" x="494.3" y="270.2" href="/_img/v8-release-80/twitter-avatar-4.jpg"/><a class="name"><text x="66" y="21"><tspan x="539.3" y="280.8">Greg Miernicki</tspan></text><text x="66" y="40" class="subText"><tspan x="539.3" y="297.6">@gregulatore</tspan></text></a><path fill="url(#a)" d="M932.3 270.2h20v20h-20z"/><text x="21" y="71" class="subText"><tspan x="494.3" y="330">Replying to @v8js</tspan></text><g data-id="p"><text x="21" y="92"><tspan x="494.3" y="355.2">Anything special planned for v8 v8.0? 😅</tspan></text></g><a class="like"><path d="M494.3 371.4h17.5v17.5h-17.5z"/><text x="42" y="125"><tspan x="514.8" y="385.2">5</tspan></text></a><a href="https://twitter.com/gregulatore/status/1161302336314191872"><text x="61" y="126" class="subText"><tspan x="534.6" y="385.2">16:43 - 13 Aug 2019</tspan></text></a></g></g><g><path class="bg" d="M671.2 141.3l394 69.5-30 142.7-394-69.5z"/><g transform="rotate(10 469.6 1210) scale(.8)"><image width="36" height="36" x="624.2" y="174.2" href="/_img/v8-release-80/twitter-avatar-5.jpg"/><a class="name"><text x="66" y="21"><tspan x="669.2" y="184.8">SignpostMarv</tspan></text><text x="66" y="40" class="subText"><tspan x="669.2" y="201.6">@SignpostMarv</tspan></text></a><path fill="url(#a)" d="M1062.2 174.2h20v20h-20z"/><text x="21" y="71" class="subText"><tspan x="624.2" y="234">Replying to @v8js @ChromiumDev</tspan></text><text x="21" y="92"><tspan x="624.2" y="258.4">are you going to be having an extra special party when V8 goes</tspan><tspan x="624.2" y="279.4">v8?</tspan></text><a class="like"><path d="M624.2 296.6h17.5v17.5h-17.5z"/><text x="42" y="146"><tspan x="644.7" y="310.4">18</tspan></text></a><a href="https://twitter.com/SignpostMarv/status/1177603910288203782"><text x="69" y="147" class="subText"><tspan x="672.3" y="310.4">16:20 - 27 Sep 2019</tspan></text></a></g></g></svg>
</div>
</div>
<!-- markdownlint-restore -->

It’s finally here. Every V8 release, every six weeks when we branch as part of our [release process](/docs/release-process), the question comes up about what will happen when V8 hits version 8. Will we have a party? Will we ship a new compiler? Will we skip versions 8 and 9 and just stay at an eternal V8 version X? Finally, after [over 10 years](/blog/10-years) of work, on our 100th blog post, we’re pleased to announce our newest branch, [V8 ~~version 8.0~~ V8](https://chromium.googlesource.com/v8/v8.git/+log/branch-heads/8.0), and we can finally answer that question:

It’s bug fixes and performance improvements.

This post provides a preview of some of the highlights in anticipation of the release in coordination with Chrome 80 Stable in several weeks.

## Performance (size & speed) { #performance }

### Pointer compression

~~We changed all our `void *` to `pv`, reducing source file size by up to 66%.~~

The V8 heap contains a whole slew of items, for example floating point values, string characters, compiled code, and tagged values (which represent pointers into the V8 heap or small integers). Upon inspection of the heap, we discovered that these tagged values occupy the majority of the heap!

Tagged values are as big as the system pointer: they are 32 bits wide for 32-bit architectures, and 64 bits in 64-bit architectures. Then, when comparing the 32-bit version with the 64-bit one, we are using twice as much heap memory for every tagged value.

Luckily for us, we have a trick up our sleeve. The top bits can be synthesized from the lower bits. Then, we only need to store the unique lower bits into the heap saving precious memory resources... to save an average of 40% of the heap memory!

![Pointer compression saves an average of 40% of memory.](/_img/v8-release-80/pointer-compression-chart.svg)

When improving memory, usually it comes at the cost of performance. Usually. We are proud to announce that we saw improvements in performance on real websites in the time spent in V8, and in its garbage collector!

:::table-wrapper
|                       || Desktop | Mobile |
|-------------|----------|---------|--------|
| Facebook    | V8-Total | -8%     | -6%    |
| ^^          | GC       | -10%    | -17%   |
| CNN         | V8-Total | -3%     | -8%    |
| ^^          | GC       | -14%    | -20%   |
| Google Maps | V8-Total | -4%     | -6%    |
| ^^          | GC       | -7%     | -12%   |
:::

If pointer compression piqued your interest, be on the lookout for a full blog post with more details.

### Optimizing higher-order builtins

We recently removed a limitation within TurboFan’s optimization pipeline that prevented aggressive optimizations of higher-order builtins.

```js
const charCodeAt = Function.prototype.call.bind(String.prototype.charCodeAt);

charCodeAt(string, 8);
```

So far, the call to `charCodeAt` was completely opaque to TurboFan, which led to the generation of a generic call to a user-defined function. With this change, we are now able to recognize that we are actually calling the built-in `String.prototype.charCodeAt` function and are thus able to trigger all the further optimizations that TurboFan has in stock to improve calls to builtins, which leads to the same performance as:

```js
string.charCodeAt(8);
```

This change affects a bunch of other builtins like `Function.prototype.apply`, `Reflect.apply`, and many higher-order array builtins (e.g. `Array.prototype.map`).

## JavaScript

### Optional chaining

When writing chains of property accesses, programmers often need to check if intermediate values are nullish (that is, `null` or `undefined`). A chain without error checking may throw, and a chain with explicit error checking is verbose and has the unwanted consequence of checking for all truthy values instead of only non-nullish values.

```js
// Error prone-version, could throw.
const nameLength = db.user.name.length;

// Less error-prone, but harder to read.
let nameLength;
if (db && db.user && db.user.name)
  nameLength = db.user.name.length;
```

[Optional chaining](https://v8.dev/features/optional-chaining) (`?.`) lets programmers write terser, robust chains of property accesses that check if intermediate values are nullish. If an intermediate value is nullish, the entire expression evaluates to `undefined`.

```js
// Still checks for errors and is much more readable.
const nameLength = db?.user?.name?.length;
```

In addition to static property accesses, dynamic property accesses and calls are also supported. Please see our [feature explainer](https://v8.dev/features/optional-chaining) for details and more examples.

### Nullish coalescing

The [nullish coalescing](https://v8.dev/features/nullish-coalescing) operator `??` is a new short-circuiting binary operator for handling default values. Currently, default values are sometimes handled with the logical `||` operator, such as in the following example.

```js
function Component(props) {
  const enable = props.enabled || true;
  // …
}
```

Use of `||` is undesirable for computing default values because `a || b` evaluates to `b` when `a` is falsy. If `props.enabled` were explicitly set to `false`, `enable` would still be true.

With the nullish coalescing operator, `a ?? b` evaluates to `b` when `a` is nullish (`null` or `undefined`), and otherwise evaluates to `a`. This is the desired default value behavior, and rewriting the example using `??` fixes the bug above.

```js
function Component(props) {
  const enable = props.enabled ?? true;
  // …
}
```

The nullish coalescing operator and optional chaining are companion features and work well together. The example may be further amended to handle the case when no `props` argument is passed in.

```js
function Component(props) {
  const enable = props?.enabled ?? true;
  // …
}
```

Please see our [feature explainer](https://v8.dev/features/nullish-coalescing) for details and more examples.

## V8 API

Please use `git log branch-heads/7.9..branch-heads/8.0 include/v8.h` to get a list of the API changes.

Developers with an [active V8 checkout](/docs/source-code#using-git) can use `git checkout -b 8.0 -t branch-heads/8.0` to experiment with the new features in V8 v8.0. Alternatively you can [subscribe to Chrome’s Beta channel](https://www.google.com/chrome/browser/beta.html) and try the new features out yourself soon.
