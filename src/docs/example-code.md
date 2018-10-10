---
title: 'Example code'
---
The following samples are provided as part of the source code download.

## [`process.cc`](https://github.com/v8/v8/blob/master/samples/process.cc)

This sample provides the code necessary to extend a hypothetical HTTP request processing application - which could be part of a web server, for example - so that it is scriptable. It takes a JavaScript script as an argument, which must provide a function called `Process`. The JavaScript `Process` function can be used to, for example, collect information such as how many hits each page served by the fictional web server gets.

## [`shell.cc`](https://github.com/v8/v8/blob/master/samples/shell.cc)

This sample takes filenames as arguments then reads and executes their contents. Includes a command prompt at which you can enter JavaScript code snippets which are then executed. In this sample additional functions like `print` are also added to JavaScript through the use of object and function templates.
