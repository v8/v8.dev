---
title: "JavaScript's New Superpower: Explicit Resource Management"
author: 'Rezvan Mahdavi Hezaveh'
avatars:
  - 'rezvan-mahdavi-hezaveh'
date: 2025-05-09
tags:
  - ECMAScript
description: 'The Explicit Resource Management proposal empowers developers to explicitly manage the lifecycle of resources.'
tweet: ''
---

The *Explicit Resource Management* proposal introduces a more deterministic approach, empowering developers to explicitly manage the lifecycle of resources like file handles, network connections, and more. This proposal brings the following additions to the language: the `using` and `await using` declarations, which automatically calls dispose method when a resource goes out of scope; `[Symbol.dispose]()` and `[Symbol.asyncDispose]()` symbols for cleanup operations; two new global objects `DisposableStack` and `AsyncDisposableStack` as containers to aggregate disposable resources; and `SuppressedError` as a new type of error which would contain both the error that was most recently thrown, as well as the error that was suppressed. These additions enable developers to write more robust, performant, and maintainable code by providing fine-grained control over resource disposal.

## `using` and `await using` declarations

The core of the Explicit Resource Management proposal lies in the `using` and `await using` declarations. The `using` declaration is designed for synchronous resources, ensuring that the `[Symbol.dispose]()` method of a disposable resource is called when the scope in which it's declared exits. For asynchronous resources, the `await using` declaration works similarly, but ensures that the `[Symbol.asyncDispose]()` method is called and the result of this calling is awaited, allowing for asynchronous cleanup operations. This distinction enables developers to reliably manage both synchronous and asynchronous resources, preventing leaks and improving overall code quality. The `using` and `await using` keywords can be used inside braces `{}` (such as bloks, for loops and function bodies), and cannot be used in top-levels. 

For example, When working with [`ReadableStreamDefaultReader`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader), it's crucial to call `reader.releaseLock()` to unlock the stream and allow it to be used elsewhere. However, error handling introduces a common problem: if an error occurs during the reading process, and you forget to call `releaseLock()` before the error propagates, the stream remains locked. Let's start with a naive example:

```javascript
async function downloadFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      console.warn('Content-Length header is missing. Progress tracking may not be accurate.');
    }
    const total = parseInt(contentLength, 10);
    let loaded = 0;
  
    const reader = response.body.getReader();
    let done = false;
    let value;
    
    while (!done) {
        ({ done, value } = await reader.read());
        if (value) {
            loaded += value.byteLength;
            if (contentLength) {
                const progress = (loaded / total) * 100;
                console.log(`Downloaded ${loaded} of ${total} bytes (${progress.toFixed(2)}%)`);
                updateProgressBar(progress); //some UI update
            }
        }
    }
    
    // If an error occures before this line, the stream remaines locked.
    reader.releaseLock(); 

    ... // The rest of the code
  }
  
 downloadFile('https://example.com/largefile.dat');
```
So it is crucial for developers, to have `try...finally` block while using streams and put `reader.releaseLock()` in `finally`. This pattern ensures that `reader.releaseLock()` is always called.

```javascript
async function downloadFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      console.warn('Content-Length header is missing. Progress tracking may not be accurate.');
    }
    const total = parseInt(contentLength, 10);
    let loaded = 0;
  
    const reader = response.body.getReader();
    let done = false;
    let value;
    
    try {
        while (!done) {
            ({ done, value } = await reader.read());
            if (value) {
                loaded += value.byteLength;
                if (contentLength) {
                    const progress = (loaded / total) * 100;
                    console.log(`Downloaded ${loaded} of ${total} bytes (${progress.toFixed(2)}%)`);
                    updateProgressBar(progress); //some UI update
                }
            }
        }
    } catch (error) {
        console.error("reading error", error);
    } finally {
        reader.releaseLock(); 
    }

    ... // The rest of the code
  }
  
 downloadFile('https://example.com/largefile.dat');
```

An alternative to write this code is to create a disposable object `readerResource`, which has the reader (`response.body.getReader()`) and the `[Symbol.dispose]()` method that calls `this.reader.releaseLock()`. The `using` declaration ensures that `readerResource[Symbol.dispose]()` is called when the code block exits, and remembering to call `releaseLock` is no longer needed because the using declaration handles it. Integration of `[Symbol.dispose]` and `[Symbol.asyncDispose]` in web APIs like streams may happen in the future, so developers do not have to write the manual wrapper object.

```javascript
  async function downloadFileWithUsing(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      console.warn('Content-Length header is missing. Progress tracking may not be accurate.');
    }
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    
    { // Introduce a new scope with a block
        // Wrap the reader in a disposable resource
        using readerResource = {
            reader: response.body.getReader(),
            [Symbol.dispose]() {
                this.reader.releaseLock();
            },
        };
        const { reader } = readerResource;
    
        let done = false;
        let value;

        try {
            while (!done) {
                ({ done, value } = await reader.read());
                if (value) {
                    loaded += value.byteLength;
                    if (contentLength) {
                        const progress = (loaded / total) * 100;
                        console.log(`Downloaded ${loaded} of ${total} bytes (${progress.toFixed(2)}%)`);
                    }
                    updateProgressBar(progress); //some UI update
                }
            }
        } catch (error) {
            console.error("reading error", error);
        }
        
    } // readerResource[Symbol.dispose]() is called automatically

    ... // The rest of the code
  }
  
  // Example usage:
  downloadFileWithUsing('https://example.com/largefile.dat');
```

## `DisposableStack` and `AsyncDisposableStack`

To further facilitate managing multiple disposable resources, the proposal introduces `DisposableStack` and `AsyncDisposableStack`. These stack-based structures allow developers to group and dispose of multiple resources in a coordinated manner. Resources are added to the stack, and when the stack is disposed, either synchronously or asynchronously, the resources are disposed of in the reverse order they were added, ensuring that any dependencies between them are handled correctly. This simplifies the cleanup process when dealing with complex scenarios involving multiple related resources. Both structures provide methods like `use()`, `adopt()`, and `defer()` to add resources or disposal actions, and a `dispose()` or `asyncDispose()` method to trigger the cleanup. `DisposableStack` and `AsyncDisposableStack` have `[Symbol.dispose]()` and `[Symbol.asyncDispose]()`, respectively, so they can be used with `using` and `await using` keywords. They offer a robust way to manage the disposal of multiple resources within a defined scope.

Let’s take a look at each method and see an example of it:

`use(value)` adds a resource to the top of the stack.

```javascript
const readerResource = {
      reader: response.body.getReader(),
      [Symbol.dispose]() {
        this.reader.releaseLock();
        console.log('Reader lock released.');
      },
    };
let stack = new DisposableStack();
stack.use(readerResource);
```

`adopt(value, onDispose)` adds a non-disposable resource and a disposal callback to the top of the stack.

```javascript
let stack = new DisposableStack();
  stack.adopt(response.body.getReader(), reader => reader.releaseLock());
```

`defer(onDispose)` adds a disposal callback to the top of the stack. It's useful for adding cleanup actions that don't have an associated resource.

```javascript
let stack = new DisposableStack();
stack.defer(() => console.log("done"));
```

`move()` moves all resources currently in this stack into a new `DisposableStack`. This can be useful if you need to transfer ownership of resources to another part of your code.

```javascript
let stack = new DisposableStack();
stack.use(firstDisposableResource);
stack.use(secondDisposableResource);
let newStack = stack.move();
// stack is disposed at this point 
```

`dispose()` in DisposableStack and `asyncDispose()` in AsyncDisposableStack: Disposes of resources within this object.

```javascript
let stack = new DisposableStack();
stack.use(firstDisposableResource);
stack.dispose();
```

## Availability

Explicit Resource Management is shipped in Chromium 134 and V8 v13.8.

## Explicit Resource Management support

<feature-support chrome="134 https://chromestatus.com/feature/5071680358842368"
                 firefox="134 (nightly) https://bugzilla.mozilla.org/show_bug.cgi?id=1927195"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=248707" 
                 nodejs="no"
                 babel="yes https://github.com/zloirock/core-js#explicit-resource-management"></feature-support>
