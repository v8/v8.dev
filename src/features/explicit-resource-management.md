---
title: "JavaScript's New Superpower: Explicit Resource Management"
author: 'Rezvan Mahdavi Hezaveh'
avatars:
  - 'rezvan-mahdavi-hezaveh'
date: 2025-05-09
tags:
  - ECMAScript
description: 'The Explicit Resource Management proposal empowering developers to explicitly manage the lifecycle of resources like file handles, network connections, and more.'
tweet: ''
---

JavaScript, while powerful, has traditionally relied on garbage collection for resource management, which can lead to unpredictable cleanup and potential resource leaks. The *Explicit Resource Management* proposal introduces a more deterministic approach, empowering developers to explicitly manage the lifecycle of resources like file handles, network connections, and more. This proposal brings the following additions to the language: `SuppressedError` as a new type of error which would contain both the error that was most recently thrown, as well as the error that was suppressed;  the `Disposable` and `AsyncDisposable` interface, which defines `[Symbol.dispose]()` and `[Symbol.AsyncDispose]()` methods for cleanup; the `using` and `await using` declarations, which automatically calls dispose method when a resource goes out of scope; and two new global objects `DisposableStack` and `AsyncDisposableStack` as containers to aggregate disposable resources. These additions enable developers to write more robust, performant, and maintainable code by providing fine-grained control over resource disposal.

## `using` and `await using` declarations

The core of the Explicit Resource Management proposal lies in the `using` and `await using` declarations. The `using` declaration is designed for synchronous resources, ensuring that the `[Symbol.dispose]()` method of a disposable resource is called when the scope in which it's declared is exited. For asynchronous resources, the `await using` declaration works similarly, but ensures that the `[Symbol.asyncDispose]()` method is called, allowing for asynchronous cleanup operations. This distinction enables developers to reliably manage both synchronous and asynchronous resources, preventing leaks and improving overall code quality. The `using` and `await using` keywords can be used within a Block, ForStatement, ForInOfStatement, FunctionBody, GeneratorBody, AsyncGeneratorBody, AsyncFunctionBody, or ClassStaticBlockBody. 

For instance, when working with streams in JavaScript, when you call `stream.getReader()`, the stream is locked to that specific reader. This prevents other parts of your code, or other libraries, from attempting to read from the stream simultaneously, which could lead to data corruption or unexpected behavior. Calling `reader.releaseLock()` releases this lock, allowing other readers to acquire it if needed. It's essential for proper stream management to not forget to release the lock, especially in scenarios where you might want to hand off the stream to another function or process. In the following example, the `downloadFile` function fetches data from a URL, reads it in chunks, and simulates both displaying download progress and saving the data to a file.  It demonstrates the need to manage stream readers, obtaining two separate readers (`reader` and `reader2`) for the two operations and releasing the lock on each reader when its respective operation is complete, using `reader.releaseLock()` and `reader2.releaseLock()`:

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
   
    reader.releaseLock(); // Explicitly release the lock in a finally block
    
    ... // Do some other things

    // Now, another part of your application tries to get a reader for the same stream, and save it to a file. 
    // If the lock has not been released, it will throw an error.  
    
    const reader2 = response.body.getReader();
    let done2 = false;
    let fileData = new Uint8Array();
    while (!done2) {
      const { done, value } = await reader2.read();
      done2 = done;
      if (value) {
        const newFileData = new Uint8Array(fileData.length + value.length);
        newFileData.set(fileData);
        newFileData.set(value, fileData.length);
        fileData = newFileData;
        console.log(`Saving data to file... chunk length = ${value.length}`);
      }
    }
    reader2.releaseLock();

    ... // The rest of the code
  }
  
 downloadFile('https://example.com/largefile.dat');
```

An alternative to write this code is to create a disposable object `readerResource`, which has the reader (`response.body.getReader()`) and the `[Symbol.dispose]()` method that calls `this.reader.releaseLock()`. The `using` declaration ensures that `readerResource[Symbol.dispose]()` is called when the code block exits, and remembering to call `releaseLock` is no longer needed because the using declaration handles it.

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
    } // readerResource[Symbol.dispose]() is called automatically

    // Do some other things... 
    
    { // Introduce a new scope with a block
        // Get a new reader for the same stream
        using readerResource = {
        reader2: response.body.getReader(),
        [Symbol.dispose]() {
            this.reader2.releaseLock();
        },
        };
        const { reader2 } = readerResource;
    
        let done2 = false;
        let fileData = new Uint8Array();
        while (!done2) {
            const { done, value } = await reader2.read();
            done2 = done;
            if (value) {
                const newFileData = new Uint8Array(fileData.length + value.length);
                newFileData.set(fileData);
                newFileData.set(value, fileData.length);
                fileData = newFileData;
                console.log(`Saving data to file... chunk length = ${value.length}`);
            }
        }

    } // readerResource[Symbol.dispose]() is called automatically

    ... // The rest of the code
  }
  
  // Example usage:
  downloadFileWithUsing('https://example.com/largefile.dat');
```

## `DisposableStack` and `AsyncDisposableStack`

To further facilitate managing multiple disposable resources, the proposal introduces `DisposableStack` and `AsyncDisposableStack`. These stack-based structures allow developers to group and dispose of multiple resources in a coordinated manner. Resources are added to the stack, and when the stack is disposed, either synchronously or asynchronously, the resources are disposed of in the reverse order they were added, ensuring that any dependencies between them are handled correctly. This simplifies the cleanup process when dealing with complex scenarios involving multiple related resources. Both structures provide methods like `use()`, `adopt()`, and `defer()` to add resources or disposal actions, and a `dispose()` or `asyncDispose()` method to trigger the cleanup. They offer a robust way to manage the disposal of multiple resources within a defined scope.

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

Explicit Resource Management is shipped in V8 v13.4.

## Explicit Resource Management support

<feature-support chrome="134 https://chromestatus.com/feature/5071680358842368"
                 firefox="134 (nightly) https://bugzilla.mozilla.org/show_bug.cgi?id=1927195"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=248707" 
                 nodejs="no"
                 babel="yes https://github.com/zloirock/core-js#explicit-resource-management"></feature-support>
