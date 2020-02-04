---
title: 'Understanding the ECMAScript spec, part 2'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-02-05 13:33:37
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification'
tweet: ''
---

... where we practice our awesome spec reading skills some more.

## Previous articles in this series

[Part 1](https://v8.dev/blog/understanding-ecmascript-part-1)

## Ready for part 2?

A fun way to get to know the spec is to start with a JavaScript feature we know is there, and find out how it's specified.

We know that properties are looked up in the prototype chain: if an object doesn't have the property we're looking for, we walk up the prototype chain until we find it (or the prototype doesn't exist).

For example:

```javascript
const o1 = {'foo' : 2511};
const o2 = {};
console.log(o2.foo); // undefined
o2.__proto__ = o1;
console.log(o2.foo); // 2511
```

## Where's the prototype walk defined?

Let's try to find out where this behavior is defined. A good place to start is a list of [Object Internal Methods](https://tc39.es/ecma262/#sec-object-internal-methods-and-internal-slots).

There's both `[[GetOwnProperty]]` and `[[Get]]` &mdash; now we're interested in the version that isn't restricted to _own_ properties, so we go with `[[Get]]`.

Unfortunately, the [Property Descriptor specification type](https://tc39.es/ecma262/#sec-property-descriptor-specification-type) also has a field called `[[Get]]`, so while browsing the spec for `[[Get]]`, we need to carefully distinguish between the two independent usages.

The internal method `[[Get]]` is called from the abstract operation Get.

> `Get ( O, P )`
>
>The abstract operation `Get` is used to retrieve the value of a specific property of an object. The operation is called with arguments `O` and `P` where `O` is the object and `P` is the property key. This abstract operation performs the following steps:
>
> 1. Assert: `Type(O)` is `Object`.
> 2. Assert: `IsPropertyKey(P)` is true.
> 3. Return `? O.[[Get]](P, O)`.

[Spec: Get](https://tc39.es/ecma262/#sec-get-o-p)

Curiously, we call `O.[[Get]]` but pass the `O` again as the `Receiver` parameter. What does that mean? We'll find out later.

The internal method `[[Get]]` delegates to `OrdinaryGet`:

> `[[Get]] ( P, Receiver )`
>
> When the `[[Get]]` internal method of `O` is called with property key `P` and ECMAScript language value `Receiver`, the following steps are taken:
>
> 1. Return `? OrdinaryGet(O, P, Receiver)`.

[Spec: \[\[Get\]\]](https://tc39.es/ecma262/#sec-ordinary-object-internal-methods-and-internal-slots-get-p-receiver)

`OrdinaryGet` is defined like this:

> `OrdinaryGet ( O, P, Receiver )`
>
> When the abstract operation `OrdinaryGet` is called with Object `O`, property key `P`, and ECMAScript language value `Receiver`, the following steps are taken:
>
> 1. Assert: `IsPropertyKey(P)` is `true`.
> 2. Let `desc` be `? O.[[GetOwnProperty]](P)`.
> 3. If `desc` is `undefined`, then
> a. Let `parent` be `? O.[[GetPrototypeOf]]()`.
> b. If `parent` is `null`, return `undefined`.
> c. Return `? parent.[[Get]](P, Receiver)`.
> 4. If `IsDataDescriptor(desc)` is `true`, return `desc.[[Value]]`.
> 5. Assert: `IsAccessorDescriptor(desc)` is `true`.
> 6. Let `getter` be `desc.[[Get]]`.
> 7. If `getter` is `undefined`, return `undefined`.
> 8. Return `? Call(getter, Receiver)`.

[Spec: OrdinaryGet](https://tc39.es/ecma262/#sec-ordinaryget)

And here's we see the prototype chain walk: if we don't find the property as an own property, we recurse into the prototype's `[[Get]]` method.

We also pass the original `Receiver`, the object on which `Get` was originally called, through the recursion. The `Receiver` is only used if the property is an accessor property, in which case it's passed as the "this object" when calling the getter function.

Interesting! This means that the `this` inside the getter refers to the original object where we tried to get the property from, not the one where we found the property during the prototype chain walk. Let's try it out!

```javascript
const o = { x: 10, get sneaky() { return this.x; } };
let o2 = {};
o2.__proto__ = o;
o2.sneaky; // will return 10
o2.x = 50;
o2.sneaky; // will return 50
```

It really works! We were able to predict the behavior of this code snippet based on what we read in the spec.

## Accessing properties - why does it invoke `[[Get]]`?

But where does the spec say that the Object internal method `[[Get]]` will get invoked when accessing a property like `o2.foo` or `o2.sneaky`? Surely that has to be defined somewhere. Don't take my word for it!

Searching for places where `[[Get]]` is called we find an abstract operation `GetValue` which operates on References. Reference is a specification type, consisting of a base value (in this case, an Object), the reference name (in this case, a String), and a strict mode flag (bool).

### Side track: References

Side track: A Reference is not a Record, even though it sounds like it could be &mdash; it contains three fixed named values. Here the spec takes a different approach, and defines References as a higher-level data type. This is because of historical reasons.

### Syntax-directed operations

We found out that the Object internal method `[[Get]]` is called from the abstract operation `GetValue` which operates on References. But where is `GetValue` called from?

The grammar rules of the spec define the syntax of the language, and the [syntax-directed operations](https://tc39.es/ecma262/#sec-algorithm-conventions-syntax-directed-operations) define what the syntactic constructs mean (how to evaluate them).

We'll take a deeper look into the grammar rules in a later episode, let's keep it simple for now!

Runtime semantics for the grammar production `MemberExpression` `:` `MemberExpression` `.` `IdentifierName` define how to evaluate it:

> `MemberExpression` `:` `MemberExpression` `.` `IdentifierName`
>
> 1. Let `baseReference` be the result of evaluating `MemberExpression`.
> 2. Let `baseValue` be `? GetValue(baseReference)`.
> 3. If the code matched by this MemberExpression is strict mode code, let `strict` be `true`; else let `strict` be `false`.
> 4. Return `? EvaluatePropertyAccessWithIdentifierKey(baseValue, IdentifierName, strict)`.

[Spec: Property accessors: Runtime Semantics: Evaluation](https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation)

The algorithm delegates to the abstract operation `EvaluatePropertyAccessWithIdentifierKey`, so we need to read it too:

> Runtime Semantics: `EvaluatePropertyAccessWithIdentifierKey( baseValue, identifierName, strict )`
>
> The abstract operation `EvaluatePropertyAccessWithIdentifierKey` takes as arguments a value `baseValue`, a Parse Node `identifierName`, and a Boolean argument `strict`. It performs the following steps:
>
> 1. Assert: `identifierName` is an IdentifierName
> 2. Let `bv` be `? RequireObjectCoercible(baseValue)`.
> 3. Let `propertyNameString` be StringValue of `identifierName`.
> 4. Return a value of type Reference whose base value component is `bv`, whose referenced name component is `propertyNameString`, and whose strict reference flag is `strict`.

[Spec: Runtime Semantics: EvaluatePropertyAccessWithIdentifierKey](https://tc39.es/ecma262/#sec-evaluate-property-access-with-identifier-key)

That is: `EvaluatePropertyAccessWithIdentifierKey` constructs a Reference which uses the provided `baseValue` as the base and the string value of `identifierName` as the property name.

Eventually this Reference gets passed to `GetValue`. This is defined in several places in the spec, depending on how the Reference ends up being used.

For example, if we use it as a parameter:

```javascript
console.log(o.foo);
```

This is defined in the `ArgumentList` production which calls `GetValue` on the argument:

> Runtime Semantics: ArgumentListEvaluation
>
> `ArgumentList : AssignmentExpression`
>
> 1. Let `ref` be the result of evaluating `AssignmentExpression`.
> 2. Let `arg` be `? GetValue(ref)`.
> 3. Return a List whose sole item is `arg`.

[Spec: Runtime Semantics: ArgumentListEvaluation](https://tc39.es/ecma262/#sec-argument-lists-runtime-semantics-argumentlistevaluation)

Now the `AssignmentExpression` is `o.foo` and the result of evaluating it is the above mentioned Reference. Now we call `GetValue` on it.

If we use it as the right hand side of an assignment:

```javascript
const x = o.foo;
```

This is defined in the runtime semantics for the `AssignmentExpression` production which calls `GetValue` on the right hand side:

> `AssignmentExpression : LeftHandSideExpression = AssignmentExpression`
>
> 1. If `LeftHandSideExpression` is neither an `ObjectLiteral` nor an `ArrayLiteral`, then
> a. Let `lref` be the result of evaluating `LeftHandSideExpression`.
> b. ReturnIfAbrupt(lref).
> c. If `IsAnonymousFunctionDefinition(AssignmentExpression)` and `IsIdentifierRef` of `LeftHandSideExpression` are both `true`, then
> i. Let `rval` be `NamedEvaluation` of `AssignmentExpression` with argument `GetReferencedName(lref)`.
> d. Else,
> i. Let `rref` be the result of evaluating `AssignmentExpression`.
> ii. Let `rval` be `? GetValue(rref)`.
> e. Perform `? PutValue(lref, rval)`.
> f. Return `rval`.
> 2. Let `assignmentPattern` be the `AssignmentPattern` that is covered by `LeftHandSideExpression`.
> 3. Let `rref` be the result of evaluating `AssignmentExpression`.
> 4. Let `rval` be `? GetValue(rref)`.
> 5. Perform `? DestructuringAssignmentEvaluation` of `assignmentPattern` using `rval` as the argument.
> 6. Return `rval`.

[Spec: Assignment operators: Runtime Semantics: Evaluation](https://tc39.es/ecma262/#sec-assignment-operators-runtime-semantics-evaluation)

Now the `LeftHandSideExpression` is not an object literal or an array literal, so we take the if branch in step 1. The assignment expression is `o.foo`, and it's not a function definition, so we take the else branch in 1 d. There we evaluate the `AssignmentExpression` and call `GetValue` on it.

In any case, `GetValue` will be called on the Reference which is the result of evaluating the `MemberExpression`. Thus, we know that the Object internal method `[[Get]]` will get invoked when accessing a property on an Object, and the prototype chain walk will occur.
