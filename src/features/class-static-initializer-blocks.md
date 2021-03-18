---
title: 'Class static initializer blocks'
author: 'Shu-yu Guo ([@_shu](https://twitter.com/_shu))'
avatars:
  - 'shu-yu-guo'
date: 2021-03-19
tags:
  - ECMAScript
description: 'JavaScript classes get dedicated syntax for static initialization.'
---
The new class static initializer block syntax lets developers gather code that should run once for a given class definition and put them in a single place. Consider the following example where a pseudo random number generator uses a static block to initialize an entropy pool once, when the `class MyPRNG` definition is evaluated.

```js
class MyPRNG {
  seed;
  constructor(seed) {
    if (seed == undefined) {
      if (MyPRNG.entropy_pool.length === 0) {
        throw new Error("Entropy pool exhausted");
      }
      seed = MyPRNG.entropy_pool.pop();
    }
    this.seed = seed;
  }

  getRandom() { ... }

  static entropy_pool = [];
  static {
    for (let i = 0; i < 512; i++) {
      this.entropy_pool.push(ProbeEntropySource());
    }
  }
}
```

## Scope

Each static initializer block is its own `var` and `let`/`const` scope. Like in static field initializers, the `this` value in static blocks is the class constructor itself. Similarly, `super.property` inside a static block refers to the super class's static property.

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

A class may have more than one static initializer block. These blocks will be evaluated in textual order. Additionally, if there are any static fields, all static elements will be evaluated in textual order. 

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

Since a class static initializer block is always nested inside a class, it has access to that class's private fields.

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

That's about it. Happy object orienting!

## Class static initializer block support { #support }

<feature-support chrome="91 https://bugs.chromium.org/p/v8/issues/detail?id=11375"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
