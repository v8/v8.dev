---
title: 'Understanding the ECMAScript spec, part 1'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-01-22 13:33:37
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: ''
---

... where we take a simple function in the spec and try to understand the notation.

## Preface

Even if you know JavaScript, reading its language specification, the ECMAScript spec, can be pretty daunting. At least that's how I felt when I started reading it for the first time. Reading the spec from the start doesn't help either, as the spec is not designed to be read in that order, and notations are not explained before they occur.

Let's start with a concrete example and walk through the spec to understand it. The following code demonstrates usage of Object.prototype.hasOwnProperty:

```javascript
let o = {'foo': 1};
o.hasOwnProperty('foo'); // true
o.hasOwnProperty('bar'); // false
```

In the example, _o_ doesn't have a property called _hasOwnProperty_, so we walk up the prototype chain and look for it. We find it in _o_'s prototype, which is _Object.prototype_.

When trying to find out how _Object.prototype.hasOwnProperty_ is defined, I bumped into pseudocode-like descriptions like this:

> Object.prototype.hasOwnProperty(V)
>
> When the hasOwnProperty method is called with argument V, the following steps are taken:
>
> 1. Let P be **?** ToPropertyKey(V).
> 2. Let O be **?** ToObject(this value).
> 3. Return **?** HasOwnProperty(O, P).

[Spec: Object.prototype.hasOwnProperty](https://tc39.es/ecma262#sec-object.prototype.hasownproperty)

and

> HasOwnProperty(O, P)
>
>The **abstract operation** HasOwnProperty is used to determine whether an object has an own property with the specified property key. A Boolean value is returned. The operation is called with arguments O and P where O is the object and P is the property key. This abstract operation performs the following steps:
>
> 1. **Assert**: Type(O) is Object.
> 2. **Assert**: IsPropertyKey(P) is true.
> 3. Let desc be **?** O.**\[\[GetOwnProperty\]\]**(P).
> 4. If desc is undefined, return false.
> 5. Return true.

[Spec: HasOwnProperty](https://tc39.es/ecma262#sec-hasownproperty)

But what's an "abstract operation"? What are the things inside \[\[ \]\]? Why is there a "?" in front of a function? What do the asserts mean?

Let's find out!

## ECMAScript Language Types and ECMAScript Specification Types

Let's start with something that looks familiar. The spec uses values such as undefined, true and false, which you already know from JavaScript. They all are **ECMAScript language values**, values of **ECMAScript language types** which the spec also defines.

The spec also uses ECMAScript language values internally, for example, an internal record might contain a field whose possible values are true and false.

[Spec: ECMAScript language types](https://tc39.es/ecma262/#sec-ecmascript-language-types)

**ECMAScript specification types** are types that occur only in the ECMAScript spec, but not in the JavaScript language, and which might or might not occur as internal types in a JavaScript engine. In this blog post, we'll get to know the ECMAScript specification type _Record_ (and its subtype _Completion Record_).

[Spec: ECMAScript specification types](https://tc39.es/ecma262/#sec-ecmascript-specification-types)

## Abstract operations

**Abstract operations** are functions defined in the ECMAScript spec; they are defined for the purpose of writing the spec elegantly and concisely. A JavaScript engine doesn't have to implement them as separate functions inside the engine. They cannot be directly called from JavaScript.

[Spec: Abstract Operations](https://tc39.es/ecma262/#sec-abstract-operations)

## Internal slots and internal methods

**Internal slots** and **internal methods** use names enclosed in \[\[ \]\].

Internal slots are (assumed) data members (of a JavaScript object or a spec-internal data type) and internal methods are (assumed) member functions (of a JavaScript object or a spec-internal data type).

Internal slots and methods are used in the algorithms described by the spec. Internal slots are used for storing the state of the object, and internal methods are functions associated with the object.

[Spec: Object internal methods and internal slots](https://tc39.es/ecma262/#sec-object-internal-methods-and-internal-slots)

For example, every JavaScript object has an internal slot \[\[Prototype\]\] and an internal method \[\[GetOwnProperty\]\].

Internal slots and methods are not accessible from JavaScript, for example, you cannot access _o.\[\[Prototype\]\]_ or call _o.\[\[GetOwnProperty\]\]()_. A JavaScript engine can implement them for their own internal use, but doesn't have to.

Each internal method delegates to a similarly-named abstract operation:

> \[\[GetOwnProperty\]\](P)
>
> When the \[\[GetOwnProperty\]\] internal method of O is called with property key P, the following steps are taken:
>
> Return ! OrdinaryGetOwnProperty(O, P).

[Spec: \[\[GetOwnProperty\]\]](https://tc39.es/ecma262/#sec-ordinary-object-internal-methods-and-internal-slots-getownproperty-p)

(We'll find out what the exclamation mark means in the next chapter.)

_OrdinaryGetOwnProperty_ is not an internal method, since it's not associated with any object; instead, the object it operates on is passed as a parameter.

_OrdinaryGetOwnProperty_ is called "ordinary" since it operates on ordinary objects. EcmaScript objects can be either **ordinary** or **exotic**. Ordinary objects must have the default behavior for a set of methods called **essential internal methods**. If an object deviates from the default behavior, it's exotic.

The most well-known exotic object is the _Array_, since its length property behaves in a non-default way: setting the length property can remove elements from the _Array_.

Essential internal methods are the methods listed [here](https://tc39.es/ecma262/#table-5).

## Completion Records

What about the question marks and exclamation marks? To understand them, we need to look into **Completion Records**!

A Completion Record is a "record" (or a "struct", if you're more familiar with that term) defined by the spec. A record is a data type which has a fixed set of named fields. C-like languages have structs - JavaScript doesn't, since you can always add properties into an object.

Again, the Completion Record is defined only for spec purposes. A JavaScript engine doesn't have to have a corresponding internal data type.

A Completion Record has three fields:

| Name | Description |
--- | ---
| \[\[Type\]\] | One of: normal, break, continue, return, or throw. All other types except "normal" are referred to as "abrupt completions".|
| \[\[Value\]\] | the value that was produced when the completion occurred, e.g., the return value of a function or the exception (if one is thrown)|
| \[\[Target\]\] | used for directed control transfers (ignoring it for this blog post)|

[Spec: Completion Record](https://tc39.es/ecma262/#sec-completion-record-specification-type)

Every abstract operation implicitly returns a Completion Record. Even if it looks like an abstract operation would return a simple type such as Boolean, it's implicitly wrapped into a Completion Record with the type "normal" (see [Implicit Completion Values](https://www.ecma-international.org/ecma-262/index.html#sec-implicit-completion-values)).

If an algorithm throws an exception, it means returning a Completion Record with [[Type]] throw whose [[Value]] is the exception object. We'll ignore the break, continue and return types for now.

_ReturnIfAbrupt(argument)_ means taking the following steps:

> 1. If argument is abrupt, return argument
> 2. Set argument to argument.\[\[Value\]\]

That is, we inspect a Completion Record; if it's an abrupt completion, we return immediately. Otherwise, we extract the value from the Completion Record.

[Spec: ReturnIfAbrupt](https://tc39.es/ecma262/#sec-returnifabrupt)

_ReturnIfAbrupt_ might look like a function call, but it's not. It causes the function where _ReturnIfAbrupt()_ occurs to return, not the "ReturnIfAbrupt" function itself. It behaves more like a macro in C-like languages.

_ReturnIfAbrupt_ can be used like this:

> let obj be Foo()
> // obj is a Completion Record
> ReturnIfAbrupt(obj)
> // If we're still here, obj is now the value extracted from the Completion Record
> Bar(obj)

And now the question mark comes into play: ? Foo() is equivalent to _ReturnIfAbrupt(Foo())_.

Similarly, Let val be ! Foo() is equivalent to:

> let val be Foo()
> Assert: val is not an abrupt completion
> Set val to val.\[\[Value\]\].

[Spec: ReturnIfAbrupt shorthands](https://tc39.es/ecma262/#sec-returnifabrupt-shorthands)

Using this knowledge, we can rewrite _Object.prototype.hasOwnProperty_ like this:

> Object.prototype.hasOwnProperty(P)
>
> 1. Let P be ToPropertyKey(V).
> 2. If P is an abrupt completion, return P
> 3. Set P to P.[[Value]]
> 4. Let O be ToObject(this value).
> 5. If O is an abrupt completion, return O
> 6. Set O to O.[[Value]]
> 7. Let temp be HasOwnProperty(O, P).
> 8. If temp is an abrupt completion, return temp
> 9. Let temp be temp.\[\[Value\]\]
> 9. Return NormalCompletion(temp)

and _HasOwnProperty_ like this:

> HasOwnProperty(O, P)
>
> 1. Assert: Type(O) is Object.
> 2. Assert: IsPropertyKey(P) is true.
> 3. Let desc be O.\[\[GetOwnProperty\]\](P).
> 4. If desc is an abrupt completion, return desc
> 5. Set desc to desc.[[Value]]
> 6. If desc is undefined, return NormalCompletion(false).
> 7. Return NormalCompletion(true).

We can also rewrite the _\[\[GetOwnProperty\]\]_ internal method without the exclamation mark like this:

> O.\[\[GetOwnProperty\]\]
>
> 1. Let temp be OrdinaryGetOwnProperty(O, P)
> 2. Assert: temp is not an abrupt completion
> 3. Let temp be temp.\[\[Value\]\]
> 4. Return NormalCompletion(temp)

Here we assume that _temp_ is a brand new temporary variable which doesn't collide with anything else.

We've also used the knowledge that when a return statement returns something else than a Completion Record, it's implicitly wrapped inside a NormalCompletion.

### Side track: Return ? Foo()

The spec uses the notation "Return ? Foo()" - why the question mark?

Return ? Foo() expands to:

> 1. Let temp be Foo()
> 2. If temp is an abrupt completion, return temp
> 3. Set temp to temp.[[Value]]
> 4. Return NormalCompletion(temp)

Which is the same as "Return Foo()"; it behaves the same way for both abrupt and normal completions.

## Asserts

Asserts in the spec assert invariant conditions of the algorithms. They are added for clarity, but don't add any requirements to the implementation - the implementation doesn't need to check them.

## Moving on

Now we have built the understanding needed for reading the spec for simple methods and abstract operations like Object.prototype.hasOwnProperty and HasOwnProperty. They still delegate to other abstract operations, but based on this blog post you should be able to figure out what they do. You'll need to find out about Property Descriptors, which is just another ECMAScript specification type.

<figure>
  <img src="/_img/understanding-ecma-part-1-1.svg" height="306" width="1082" alt="Function call graph starting from Object.prototype.hasOwnProperty">
</figure>


## Useful links


[How to Read the ECMAScript Specification](https://timothygu.me/es-howto/)

