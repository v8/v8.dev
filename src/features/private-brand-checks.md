---
title: 'Private brand checks a.k.a. `#foo in obj`'
author: 'Marja Hölttä ([@marjakh](https://twitter.com/marjakh))'
avatars:
  - 'marja-holtta'
date: 2021-04-12
tags:
  - ECMAScript
description: 'Private brand checks allow testing for the existence of a private field in an object.'
tweet: ''
---

The [`in` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in) can be used for testing whether the given object (or any object in its prototype chain) has the given property:

```javascript
const o1 = {'foo': 0};
console.log('foo' in o1); // true
const o2 = {};
console.log('foo' in o2); // false
const o3 = Object.create(o1);
console.log('foo' in o3); // true
```

The private brand checks feature extends the `in` operator to support [private class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields):

```javascript
class A {
  static test(obj) {
    console.log(#foo in obj);
  }
  #foo = 0;
}

A.test(new A()); // true
A.test({}); // false

class B {
  #foo = 0;
}

A.test(new B()); // false; it's not the same #foo
```

Since private names are only available inside the class which defines them, the test must also occur inside the class, for example in a method like `static test` above.

Subclass instances inherit private fields from the parent class:

```javascript
class SubA extends A {};
A.test(new SubA()); // true
```

But creating an object with a prototype with `Object.create` or setting the prototype later (via the `__proto__` setter or `Object.setPrototypeOf`) doesn't make private fields accessible:

```javascript
const a = new A();
A.test(Object.create(a)); // false
let o = {};
Object.setProrotypeOf(o, a);
A.test(o); // false
```

Accessing a non-existing private field throws an error - unlike for normal properties, where accessing a non-existent property returns `undefined` but doesn't throw. Before the private brand checks, the developers have been forced to use a `try`-`catch` for implementing fall-back behavior for cases where an object doesn't have the needed private field:

```javascript
class D {
  use(obj) {
    try {
      obj.#foo;
    } catch {
      // Fallback for the case obj didn't have #foo
    }
  }
  #foo = 0;
}
```

Now the existence of the private field can be tested using a private brand check:

```javascript
class E {
  use(obj) {
    if (#foo in obj) {
      obj.#foo;
    } else {
      // Fallback for the case obj didn't have #foo
    }
  }
  #foo = 0;
}
```

But beware - the existence of one private field does not guarantee that the object has all the private fields declared in a class! The following example shows a half-constructed object which has only one of the two private fields declared in its class:

```javascript
let half_constructed;
class F {
  m() {
    console.log(#x in this); // true
    console.log(#y in this); // false
  }
  #x = 0;
  #y = (() => { half_constructed = this; throw 'error';})();
}

try {
  new F();
} catch {
}

half_constructed.m();
```

## Private brand check support { #support }

<feature-support chrome="91 https://bugs.chromium.org/p/v8/issues/detail?id=11374"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
