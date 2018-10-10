Welcome to the developer documentation for V8. V8 is Google's open source, high performance JavaScript engine. It is written in C++ and is used in Google Chrome, Google's open source browser.

This documentation is aimed at C++ developers who want to use V8 in their applications, as well as anyone interested in V8's design and performance. This document introduces you to V8, while the remaining documentation shows you how to use V8 in your code and describes some of its design details, as well as providing a set of JavaScript benchmarks for measuring V8's performance.

# About V8

V8 implements ECMAScript as specified in ECMA-262, 5th edition, and runs on Windows (XP or newer), Mac OS X (10.5 or newer), and Linux systems that use IA-32, x64, or ARM processors.

V8 compiles and executes JavaScript source code, handles memory allocation for objects, and garbage collects objects it no longer needs. V8's stop-the-world, generational, accurate garbage collector is one of the keys to V8's performance. You can learn about this and other performance aspects in V8 Design Elements.

JavaScript is most commonly used for client-side scripting in a browser, being used to manipulate Document Object Model (DOM) objects for example. The DOM is not, however, typically provided by the JavaScript engine but instead by a browser. The same is true of V8—Google Chrome provides the DOM. V8 does however provide all the data types, operators, objects and functions specified in the ECMA standard.

V8 enables any C++ application to expose its own objects and functions to JavaScript code. It's up to you to decide on the objects and functions you would like to expose to JavaScript. There are many examples of applications that do this, for example: Adobe Flash and the Dashboard Widgets in Apple's Mac OS X and Yahoo! Widgets.