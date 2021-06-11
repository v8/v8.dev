---
title: 'Import Assertions'
author: 'Dan Clark ([@dandclark1](https://twitter.com/dandclark1))'
avatars:
  - 'dan-clark'
date: 2021-06-10
tags:
  - ECMAScript
description: 'Import assertions allow module import statements to include additional information alongside the module specifier'
tweet: ''
---

The new [import assertions](https://github.com/tc39/proposal-import-assertions) feature allows module import statements to include additional information alongside the module specifier. An initial use for the feature is to enable JSON documents to be imported as [JSON modules](https://github.com/tc39/proposal-json-modules):

```javascript
// foo.json
{ "answer": 42 }

// main.mjs
import json from "./foo.json" assert { type: "json" };
console.log(json.answer); // 42
```

## Background: JSON modules and MIME type

A natural question to ask is why a JSON module couldn't simply be imported like this:

```javascript
import json from "./foo.json";
```

The web platform checks the MIME type of a module resource for validity prior to executing it, and in theory this MIME type could also be used to determine whether to treat the resource as a JSON or as a JavaScript module.

But, there's an [escalation-of-privilege security issue](https://github.com/w3c/webcomponents/issues/839) with relying on the MIME type alone. Modules can be imported cross-origin, and a developer might import a JSON module from a third-party source. The developer might consider an import of JSON even from an untrusted  third-party to be basically safe as long as the JSON is properly sanitized, since importing JSON won't execute script. But, the third-party server could unexpectedly reply with a JavaScript MIME type and a malicious JavaScript payload, executing code in the importer's domain.

```javascript
// Executes JS if sketchy-third-party.com responds with
// application/javascript MIME type!
import data from "https://sketchy-third-party.com/data.json";
```

File extensions can't be used to make a module type determination because they [aren't a reliable indicator of content type on the web](https://github.com/tc39/proposal-import-assertions/blob/master/content-type-vs-file-extension.md). So instead, we use import assertions to indicate the expected module type and prevent this escalation-of-privilege pitfall. When a developer wants to import a JSON module, they must use an import assertion to specify that it's supposed to be JSON. The import will fail if the MIME type received from the network doesn't match the expected type.

```javascript
// Fails if sketchy-third-party responds with a non-JSON MIME type.
import data from "https://sketchy-third-party.com/data.json" assert { type: "json" };
```

# Dynamic `import()`

Import assertions can also be passed to dynamic `import()` with a new second parameter:

```javascript
// foo.json
{ "answer": 42 }

// main.mjs
const jsonModule = await import("./foo.json", { assert: { type: "json" } });
console.log(jsonModule.default.answer); // 42
```

The data is referenced through the `default` property because the JSON content is the [default export](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#importing_defaults) of the module.

## Conclusion

Currently the only specified use of import assertions is for specifying module type. However, the feature was designed to allow arbitrary key/value assertion pairs, so additional uses may be added in the future if it becomes useful to restrain module imports in other ways.

Meanwhile, JSON modules with the new import assertions syntax are available by default in Chromium 91. [CSS module scripts](https://chromestatus.com/feature/5948572598009856#) are also coming soon, using the same module-type-assertion syntax.

## Import Assertions support { #support }

<feature-support chrome="91 https://chromestatus.com/feature/5765269513306112"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="yes https://github.com/babel/babel/pull/12139"></feature-support>
