---
title: 'Super fast `super` property access'
author: '[Marja Hölttä](https://twitter.com/marjakh), super optimizer'
avatars:
  - marja-holtta
date: 2021-02-18
tags:
  - JavaScript
description: 'Faster super property access in V8 v9.0'
tweet: '1362465295848333316'
---

The [`super` keyword](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super) can be used for accessing properties and functions on an object’s parent.

Previously, accessing a super property (like `super.x`) was implemented via a runtime call. Starting from V8 v9.0, we reuse the [inline cache (IC) system](https://mathiasbynens.be/notes/shapes-ics) in non-optimized code and generate the proper optimized code for super property access, without having to jump to the runtime.

As you can see from the graphs below, super property access used to be an order of magnitude slower than normal property access because of the runtime call. Now we’re much closer to being on par.

![Compare super property access to regular property access, optimized](/_img/fast-super/super-opt.svg)

![Compare super property access to regular property access, unoptimized](/_img/fast-super/super-no-opt.svg)

Super property access is difficult to benchmark, since it must happen inside a function. We can’t benchmark individual property accesses, but only bigger chunks of work. Thus the function call overhead is included in the measurement. The above graphs somewhat underestimate the difference between super property access and normal property access, but they’re accurate enough for demonstrating the difference between the old and new super property access.

In the unoptimized (interpreted) mode, super property access will always be slower than normal property access, since we need to do more loads (reading the home object from the context and reading the `__proto__` from the home object). In the optimized code, we already embed the home object as a constant whenever possible. This could be further improved by embedding its `__proto__` as a constant too.

### Prototypal inheritance and `super`

Let’s start from the basics - what does super property access even mean?

```javascript
class A { }
A.prototype.x = 100;

class B extends A {
  m() {
    return super.x;
  }
}
const b = new B();
b.m();
```

Now `A` is the super class of `B` and  `b.m()` returns `100` as you’d expect.

![Class inheritance diagram](/_img/fast-super/inheritance-1.svg)

The reality of [JavaScript’s prototypal inheritance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain) is more complicated:

![Prototypal inheritance diagram](/_img/fast-super/inheritance-2.svg)

We need to distinguish carefully between the `__proto__` and `prototype` properties - they don’t mean the same thing! To make it more confusing, the object `b.__proto__` is often referred to as "`b`’s prototype".

`b.__proto__` is the object from which `b` inherits properties. `B.prototype` is the object which will be the `__proto__` of objects created with `new B()`, that is `b.__proto__ === B.prototype`.

In turn, `B.prototype` has its own `__proto__` property that equals to `A.prototype`. Together, this forms what’s called a prototype chain:

```
b ->
 b.__proto__ === B.prototype ->
  B.prototype.__proto__ === A.prototype ->
   A.prototype.__proto__ === Object.prototype ->
    Object.prototype.__proto__ === null
```

Through this chain, `b` can access all properties defined in any of those objects. The method `m` is a property of `B.prototype` — `B.prototype.m` — and this is why `b.m()` works.

Now we can define `super.x` inside `m` as a property lookup where we start looking for the property `x` in the *home object’s* `__proto__` and walk up the prototype chain until we find it.

The home object is the object where the method is defined - in this case the home object for `m` is `B.prototype`. Its `__proto__` is `A.prototype`, so that’s where we start looking for the property `x`. We’ll call `A.prototype` the *lookup start object*. In this case we find the property `x` immediately in the lookup start object, but in general it might also be somewhere further up the prototype chain.

If `B.prototype` had a property called `x`, we’d ignore it, since we start looking for it above it in the prototype chain. Also, in this case super property lookup doesn’t depend on the *receiver* - the object that is the `this` value when calling the method.

```javascript
B.prototype.m.call(some_other_object); // still returns 100
```

If the property has a getter though, the receiver will be passed to the getter as the `this` value.

To summarize: in a super property access, `super.x`, the lookup start object is the `__proto__` of the home object and the receiver is the receiver of the method where the super property access occurs.

In a normal property access, `o.x`, we start looking for the property `x` in `o` and walk up the prototype chain. We’ll also use `o` as the receiver if `x` happens to have a getter - the lookup start object and the receiver are the same object (`o`).

*Super property access is just like regular property access where the lookup start object and the receiver are different.*

### Implementing faster `super`

The above realization is also the key for implementing fast super property access. V8 is already engineered to make property access fast - now we generalized it for the case where the receiver and the lookup start object differ.

V8’s data-driven inline cache system is the core part for implementing fast property access. You can read about it in [the high-level introduction](https://mathiasbynens.be/notes/shapes-ics) linked above, or the more detailed descriptions of [V8’s object representation](https://v8.dev/blog/fast-properties) and [how V8’s data-driven inline cache system is implemented](https://docs.google.com/document/d/1mEhMn7dbaJv68lTAvzJRCQpImQoO6NZa61qRimVeA-k/edit?usp=sharing).

To speed up `super`, we’ve added a new [Ignition](https://v8.dev/docs/ignition) bytecode, `LdaNamedPropertyFromSuper`, which enables us to plug into the IC system in the interpreted mode and also generate optimized code for super property access.

With the new byte code, we can add a new IC, `LoadSuperIC`, for speeding up super property loads. Similar to `LoadIC` which handles normal property loads, `LoadSuperIC` keeps track of the shapes of the lookup start objects it has seen and remembers how to load properties from objects which have one of those shapes.

`LoadSuperIC` reuses the existing IC machinery for property loads, just with a different lookup start object. As the IC layer already distinguished between the lookup start object and the receiver, the implementation should’ve been easy. But as the lookup start object and the receiver were always the same, there were bugs where we’d use the lookup start object even though we meant the receiver, and vice versa. Those bugs have been fixed and we now properly support cases where the lookup start object and the receiver differ.

Optimized code for super property access is generated by the `JSNativeContextSpecialization` phase of the [TurboFan](https://v8.dev/docs/turbofan) compiler. The implementation generalizes the existing property lookup machinery ([`JSNativeContextSpecialization::ReduceNamedAccess`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/compiler/js-native-context-specialization.cc;l=1130)) to handle the case where the receiver and the lookup start object differ.

The optimized code got even more optimal when we moved the home object out of the `JSFunction` where it was stored. It’s now stored in the class context, which makes TurboFan embed it into the optimized code as a constant whenever possible.

## Other usages of `super`

`super` inside object literal methods works just like inside class methods, and is optimized similarly.

```javascript
const myproto = {
  __proto__: { 'x': 100 },
  m() { return super.x; }
};
const o = { __proto__: myproto };
o.m(); // returns 100
```

There are of course corner cases which we didn’t optimize for. For example, writing super properties (`super.x = ...`) is not optimized. In addition, using mixins turns the access site megamorphic, leading into slower super property access:

```javascript
function createMixin(base) {
  class Mixin extends base {
    m() { return super.m() + 1; }
    //                ^ this access site is megamorphic
  }
  return Mixin;
}

class Base {
  m() { return 0; }
}

const myClass = createMixin(
  createMixin(
    createMixin(
      createMixin(
        createMixin(Base)
      )
    )
  )
);
(new myClass()).m();
```

There’s still work to be done to ensure all object-oriented patterns are as speedy as they can be - stay tuned for further optimizations!
