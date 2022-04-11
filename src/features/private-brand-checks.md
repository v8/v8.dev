---
title: 'Private brand checks a.k.a. `#foo in obj`'
author: 'Marja Hölttä ([@marjakh](https://twitter.com/marjakh))'
avatars:
  - 'marja-holtta'
date: 2021-04-14
tags:
  - ECMAScript
description: 'Private brand checks allow testing for the existence of a private field in an object.'
tweet: '1382327454975590401'
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

The private brand checks feature extends the `in` operator to support [private class fields](https://v8.dev/features/class-fields#private-class-fields):

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

Subclass instances receive private fields from the parent class as own-properties:

```javascript
class SubA extends A {};
A.test(new SubA()); // true
```

But objects created with with `Object.create` (or that have the prototype set later via the `__proto__` setter or `Object.setPrototypeOf`) don't receive the private fields as own-properties. Because private field lookup only works on own-properties, the `in` operator does not find these inherited fields:

```javascript
const a = new A();
const o = Object.create(a);
A.test(o); // false, private field is inherited and not owned
A.test(o.__proto__); // true

const o2 = {};
Object.setPrototypeOf(o2, a);
A.test(o2); // false, private field is inherited and not owned
A.test(o2.__proto__); // true
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
let halfConstructed;
class F {
  m() {
    console.log(#x in this); // true
    console.log(#y in this); // false
  }
  #x = 0;
  #y = (() => {
    halfConstructed = this;
    throw 'error';
  })();
}

try {
  new F();
} catch {}

halfConstructed.m();
```

## Private brand check support { #support }

<feature-support chrome="91 https://bugs.chromium.org/p/v8/issues/detail?id=11374"
                 firefox="no"
                 safari="no"
                 nodejs="no"
                 babel="no"></feature-support>
