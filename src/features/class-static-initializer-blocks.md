---
title: 'Class static initialization blocks'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2021-03-30
tags:
  - ECMAScript
description: 'JavaScript classes get dedicated syntax for static initialization.'
tweet: '1376925666780798989'
---
The new class static initialization block syntax lets developers gather code that should run once for a given class definition and put them in a single place. Consider the following example where a pseudo-random number generator uses a static block to initialize an entropy pool once, when the `class MyPRNG` definition is evaluated.

```js
class MyPRNG {
  constructor(seed) {
    if (seed === undefined) {
      if (MyPRNG.entropyPool.length === 0) {
        throw new Error('Entropy pool exhausted');
      }
      seed = MyPRNG.entropyPool.pop();
    }
    this.seed = seed;
  }

  getRandom() { … }

  static entropyPool = [];
  static {
    for (let i = 0; i < 512; i++) {
      this.entropyPool.push(probeEntropySource());
    }
  }
}
```

## Scope

Each static initialization block is its own `var` and `let`/`const` scope. Like in static field initializers, the `this` value in static blocks is the class constructor itself. Similarly, `super.property` inside a static block refers to the super class’s static property.

```js
var y = 'outer y';
class A {
  static fieldA = 'A.fieldA';
}
class B extends A {
  static fieldB = 'B.fieldB';
  static {
    let x = super.fieldA;
    // → 'A.fieldA'
    var y = this.fieldB;
    // → 'B.fieldB'
  }
}
// Since static blocks are their own `var` scope, `var`s do not hoist!
y;
// → 'outer y'
```

## Multiple blocks

A class may have more than one static initialization block. These blocks are evaluated in textual order. Additionally, if there are any static fields, all static elements are evaluated in textual order.

```js
class C {
  static field1 = console.log('field 1');
  static {
    console.log('static block 1');
  }
  static field2 = console.log('field 2');
  static {
    console.log('static block 2');
  }
}
// → field 1
//   static block 1
//   field 2
//   static block 2
```

## Access to private fields

Since a class static initialization block is always nested inside a class, it has access to that class’s private fields.

```js
let getDPrivateField;
class D {
  #privateField;
  constructor(v) {
    this.#privateField = v;
  }
  static {
    getDPrivateField = (d) => d.#privateField;
  }
}
getDPrivateField(new D('private'));
// → private
```

That’s about it. Happy object orienting!

## Class static initialization block support { #support }

<feature-support chrome="91 https://bugs.chromium.org/p/v8/issues/detail?id=11375"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="yes https://babeljs.io/docs/en/babel-plugin-proposal-class-static-block"></feature-support>
