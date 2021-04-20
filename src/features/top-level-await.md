---
title: 'Top-level `await`'
author: 'Myles Borins ([@MylesBorins](https://twitter.com/MylesBorins))'
avatars:
  - 'myles-borins'
date: 2019-10-08
tags:
  - ECMAScript
  - Node.js 14
description: 'Top-level `await` is coming to JavaScript modules! You’ll soon be able to use `await` without needing to be in an async function.'
tweet: '1181581262399643650'
---
[Top-level `await`](https://github.com/tc39/proposal-top-level-await) enables developers to use the `await` keyword outside of async functions. It acts like a big async function causing other modules who `import` them to wait before they start evaluating their body.

## The old behavior { #old }

When `async`/`await` was first introduced, attempting to use an `await` outside of an `async` function resulted in a `SyntaxError`. Many developers utilized immediately-invoked async function expressions as a way to get access to the feature.

```js
await Promise.resolve(console.log('🎉'));
// → SyntaxError: await is only valid in async function

(async function() {
  await Promise.resolve(console.log('🎉'));
  // → 🎉
}());
```

## The new behavior { #new }

With top-level `await`, the above code instead works the way you’d expect within [modules](/features/modules):

```js
await Promise.resolve(console.log('🎉'));
// → 🎉
```

:::note
**Note:** Top-level `await` _only_ works at the top level of modules. There is no support for classic scripts or non-async functions.
:::

## Use cases

These use cases are borrowed from the [spec proposal repository](https://github.com/tc39/proposal-top-level-await#use-cases).

### Dynamic dependency pathing

```js
const strings = await import(`/i18n/${navigator.language}`);
```

This allows for modules to use runtime values in order to determine dependencies. This is useful for things like development/production splits, internationalization, environment splits, etc.

### Resource initialization

```js
const connection = await dbConnector();
```

This allows modules to represent resources and also to produce errors in cases where the module cannot be used.

### Dependency fallbacks

The following example attempts to load a JavaScript library from CDN A, falling back to CDN B if that fails:

```js
let jQuery;
try {
  jQuery = await import('https://cdn-a.example.com/jQuery');
} catch {
  jQuery = await import('https://cdn-b.example.com/jQuery');
}
```

## Module execution order

One of the biggest changes to JavaScript with top-level `await` is the order of execution of modules in your graph. The JavaScript engine executes modules in [post-order traversal](https://en.wikibooks.org/wiki/A-level_Computing/AQA/Paper_1/Fundamentals_of_algorithms/Tree_traversal#Post-order): starting from the left-most subtree of your module graph, modules are evaluated, their bindings are exported, and their siblings are executed, followed by their parents. This algorithm runs recursively until it executes the root of your module graph.

Prior to top-level `await`, this order was always synchronous and deterministic: between multiple runs of your code your graph was guaranteed to execute in the same order. Once top-level `await` lands, the same guarantee exists, but only as long as you don’t use top-level `await`.

Here’s what happens when you use top-level `await` in a module:

1. The execution of the current module is deferred until the awaited promise is resolved.
1. The execution of the parent module is deferred until the child module that called `await`, and all its siblings, export bindings.
1. The sibling modules, and siblings of parent modules, are able to continue executing in the same synchronous order — assuming there are no cycles or other `await`ed promises in the graph.
1. The module that called `await` resumes its execution after the `await`ed promise resolves.
1. The parent module and subsequent trees continue to execute in a synchronous order as long as there are no other `await`ed promises.

## Doesn’t this already work in DevTools?

Indeed it does! The REPL in [Chrome DevTools](https://developers.google.com/web/updates/2017/08/devtools-release-notes#await), [Node.js](https://github.com/nodejs/node/issues/13209), and Safari Web Inspector have supported top-level `await` for a while now. However, this functionality was non-standard and limited to the REPL! It’s distinct from the top-level `await` proposal, which is part of the language specification and only applies to modules. To test production code relying on top-level `await` in a way that fully matches the spec proposal’s semantics, make sure to test in your actual app, and not just in DevTools or the Node.js REPL!

## Isn’t top-level `await` a footgun?

Perhaps you have seen [the infamous gist](https://gist.github.com/Rich-Harris/0b6f317657f5167663b493c722647221) by [Rich Harris](https://twitter.com/Rich_Harris) which initially outlined a number of concerns about top-level `await` and urged the JavaScript language not to implement the feature. Some specific concerns were:

- Top-level `await` could block execution.
- Top-level `await` could block fetching resources.
- There would be no clear interop story for CommonJS modules.

The stage 3 version of the proposal directly addresses these issues:

- As siblings are able to execute, there is no definitive blocking.
- Top-level `await` occurs during the execution phase of the module graph. At this point all resources have already been fetched and linked. There is no risk of blocking fetching resources.
- Top-level `await` is limited to modules. There is explicitly no support for scripts or for CommonJS modules.

As with any new language feature, there’s always a risk of unexpected behavior. For example, with top-level `await`, circular module dependencies could introduce a deadlock.

Without top-level `await`, JavaScript developers often used async immediately-invoked function expressions just to get access to `await`. Unfortunately, this pattern results in less determinism of graph execution and static analyzability of applications. For these reasons, the lack of top-level `await` was viewed as a higher risk than the hazards introduced with the feature.

## Support for top-level `await` { #support }

<feature-support chrome="89 https://bugs.chromium.org/p/v8/issues/detail?id=9344"
                 firefox="no https://bugzilla.mozilla.org/show_bug.cgi?id=1519100"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=202484"
                 nodejs="14"
                 babel="no https://github.com/babel/proposals/issues/44"></feature-support>
