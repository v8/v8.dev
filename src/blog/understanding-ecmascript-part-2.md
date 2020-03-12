---
title: 'Understanding the ECMAScript spec, part 2'
author: '[Marja Hölttä](https://twitter.com/marjakh), speculative specification spectator'
avatars:
  - marja-holtta
date: 2020-03-02
tags:
  - ECMAScript
description: 'Tutorial on reading the ECMAScript specification, part 2'
tweet: '1234550773629014016'
---
Let’s practice our awesome spec reading skills some more. If you haven’t had a look at the previous episodes, now it’s a good time to do so!

In [part 1 of this series](/blog/understanding-ecmascript-part-1) we read through a simple method — `Object.prototype.hasOwnProperty` — and **abstract operations** it invokes. We familiarized ourselves with the shorthands `?` and `!` related to error handling. We encountered **language types**, **specification types**, **internal slots**, and **internal methods**.

## Ready for part 2?

A fun way to get to know the spec is to start with a JavaScript feature we know is there, and find out how it’s specified.

> Warning! This episode contains copy-pasted algorithms from the [ECMAScript spec](https://tc39.es/ecma262/) as of February 2020. They’ll eventually be out of date.

We know that properties are looked up in the prototype chain: if an object doesn’t have the property we’re trying to read, we walk up the prototype chain until we find it (or find an object which no longer has a prototype).

For example:

```js
const o1 = { foo: 99 };
const o2 = {};
Object.setPrototypeOf(o2, o1);
o2.foo;
// → 99
```

## Where’s the prototype walk defined?  { #prototype-walk }

Let’s try to find out where this behavior is defined. A good place to start is a list of [Object Internal Methods](https://tc39.es/ecma262/#sec-object-internal-methods-and-internal-slots).

There’s both `[[GetOwnProperty]]` and `[[Get]]` — we’re interested in the version that isn’t restricted to _own_ properties, so we’ll go with `[[Get]]`.

Unfortunately, the [Property Descriptor specification type](https://tc39.es/ecma262/#sec-property-descriptor-specification-type) also has a field called `[[Get]]`, so while browsing the spec for `[[Get]]`, we need to carefully distinguish between the two independent usages.

`[[Get]]` is an **essential internal method**. **Ordinary objects** implement the default behavior for essential internal methods. **Exotic objects** can define their own internal method `[[Get]]` which deviates from the default behavior. In this post, we focus on ordinary objects.

The default implementation for `[[Get]]` delegates to `OrdinaryGet`:

:::ecmascript-algorithm
> **[`[[Get]] ( P, Receiver )`](https://tc39.es/ecma262/#sec-ordinary-object-internal-methods-and-internal-slots-get-p-receiver)**
>
> When the `[[Get]]` internal method of `O` is called with property key `P` and ECMAScript language value `Receiver`, the following steps are taken:
>
> 1. Return `? OrdinaryGet(O, P, Receiver)`.

We’ll see shortly that `Receiver` is the value which is used as the **this value** when calling a getter function of an accessor property.

`OrdinaryGet` is defined like this:

:::ecmascript-algorithm
> **[`OrdinaryGet ( O, P, Receiver )`](https://tc39.es/ecma262/#sec-ordinaryget)**
>
> When the abstract operation `OrdinaryGet` is called with Object `O`, property key `P`, and ECMAScript language value `Receiver`, the following steps are taken:
>
> 1. Assert: `IsPropertyKey(P)` is `true`.
> 1. Let `desc` be `? O.[[GetOwnProperty]](P)`.
> 1. If `desc` is `undefined`, then
>     1. Let `parent` be `? O.[[GetPrototypeOf]]()`.
>     1. If `parent` is `null`, return `undefined`.
>     1. Return `? parent.[[Get]](P, Receiver)`.
> 1. If `IsDataDescriptor(desc)` is `true`, return `desc.[[Value]]`.
> 1. Assert: `IsAccessorDescriptor(desc)` is `true`.
> 1. Let `getter` be `desc.[[Get]]`.
> 1. If `getter` is `undefined`, return `undefined`.
> 1. Return `? Call(getter, Receiver)`.

The prototype chain walk is inside step 3: if we don’t find the property as an own property, we call the prototype’s `[[Get]]` method which delegates to `OrdinaryGet` again. If we still don’t find the property, we call its prototype’s `[[Get]]` method, which delegates to `OrdinaryGet` again, and so on, until we either find the property or reach an object without a prototype.

Let’s look at how this algorithm works when we access `o2.foo`. First we invoke `OrdinaryGet` with `O` being `o2` and `P` being `"foo"`. `O.[[GetOwnProperty]]("foo")` returns `undefined`, since `o2` doesn’t have an own property called `"foo"`, so we take the if branch in step 3. In step 3.a, we set `parent` to the prototype of `o2` which is `o1`. `parent` is not `null`, so we don’t return in step 3.b. In step 3.c, we call the parent’s `[[Get]]` method with property key `"foo"`, and return whatever it returns.

The parent (`o1`) is an ordinary object, so its `[[Get]]` method invokes `OrdinaryGet` again, this time with `O` being `o1` and `P` being `"foo"`. `o1` has an own property called `"foo"`, so in step 2, `O.[[GetOwnProperty]]("foo")` returns the associated Property Descriptor and we store it in `desc`.

[Property Descriptor](https://tc39.es/ecma262/#sec-property-descriptor-specification-type) is a specification type. Data Property Descriptors store the value of the property directly in the `[[Value]]` field. Accessor Property Descriptors store the accessor functions in fields `[[Get]]` and/or `[[Set]]`. In this case, the Property Descriptor associated with `"foo"` is a data Property Descriptor.

The data Property Descriptor we stored in `desc` in step 2 is not `undefined`, so we don’t take the `if` branch in step 3. Next we execute step 4. The Property Descriptor is a data Property Descriptor, so we return its `[[Value]]` field, `99`, in step 4, and we’re done.

## What’s `Receiver` and where is it coming from? { #receiver }

The `Receiver` parameter is only used in the case of accessor properties in step 8. It’s passed as the **this value** when calling the getter function of an accessor property.

`OrdinaryGet` passes the original `Receiver` throughout the recursion, unchanged (step 3.c). Let’s find out where the `Receiver` is originally coming from!

Searching for places where `[[Get]]` is called we find an abstract operation `GetValue` which operates on References. Reference is a specification type, consisting of a base value, the referenced name, and a strict reference flag. In the case of `o2.foo`, the base value is the Object `o2`, the referenced name is the String `"foo"`, and the strict reference flag is `false`, since the example code is sloppy.

### Side track: Why is Reference not a Record?

Side track: Reference is not a Record, even though it sounds like it could be. It contains three components, which could equally well be expressed as three named fields. Reference is not a Record only because of historical reasons.

### Back to `GetValue`

Let’s look at how `GetValue` is defined:

:::ecmascript-algorithm
> **[`GetValue ( V )`](https://tc39.es/ecma262/#sec-getvalue)**
>
> 1. `ReturnIfAbrupt(V)`.
> 1. If `Type(V)` is not `Reference`, return `V`.
> 1. Let `base` be `GetBase(V)`.
> 1. If `IsUnresolvableReference(V)` is `true`, throw a `ReferenceError` exception.
> 1. If `IsPropertyReference(V)` is `true`, then
>     1. If `HasPrimitiveBase(V)` is `true`, then
>         1. Assert: In this case, `base` will never be `undefined` or `null`.
>         1. Set `base` to `! ToObject(base)`.
>     1. Return `? base.[[Get]](GetReferencedName(V), GetThisValue(V))`.
> 1. Else,
>     1. Assert: `base` is an Environment Record.
>     1. Return `? base.GetBindingValue(GetReferencedName(V), IsStrictReference(V))`

The Reference in our example is `o2.foo`, which is a property reference. So we take branch 5. We don’t take the branch in 5.a, since the base (`o2`) is not [a primitive value](/blog/react-cliff#javascript-types) (a Number, String, Symbol, BigInt, Boolean, Undefined, or Null).

Then we call `[[Get]]` in step 5.b. The `Receiver` we pass is `GetThisValue(V)`. In this case, it’s just the base value of the Reference:

:::ecmascript-algorithm
> **[`GetThisValue( V )`](https://tc39.es/ecma262/#sec-getthisvalue)**
>
> 1. Assert: `IsPropertyReference(V)` is `true`.
> 1. If `IsSuperReference(V)` is `true`, then
>     1. Return the value of the `thisValue` component of the reference `V`.
> 1. Return `GetBase(V)`.

For `o2.foo`, we don’t take the branch in step 2, since it’s not a Super Reference (such as `super.foo`), but we take step 3 and return the base value of the Reference which is `o2`.

Piecing everything together, we find out that we set the `Receiver` to be the base of the original Reference, and then we keep it unchanged during the prototype chain walk. Finally, if the property we find is an accessor property, we use the `Receiver` as the **this value** when calling it.

In particular, the **this value** inside a getter refers to the original object where we tried to get the property from, not the one where we found the property during the prototype chain walk.

Let’s try it out!

```js
const o1 = { x: 10, get foo() { return this.x; } };
const o2 = { x: 50 };
Object.setPrototypeOf(o2, o1);
o2.foo;
// → 50
```

In this example, we have an accessor property called `foo` and we define a getter for it. The getter returns `this.x`.

Then we access `o2.foo` - what does the getter return?

We found out that when we call the getter, the **this value** is the object where we originally tried to get the property from, not the object where we found it. In this case the **this value** is `o2`, not `o1`. We can verify that by checking whether the getter returns `o2.x` or `o1.x`, and indeed, it returns `o2.x`.

It works! We were able to predict the behavior of this code snippet based on what we read in the spec.

## Accessing properties — why does it invoke `[[Get]]`? { #property-access-get }

Where does the spec say that the Object internal method `[[Get]]` will get invoked when accessing a property like `o2.foo`? Surely that has to be defined somewhere. Don’t take my word for it!

We found out that the Object internal method `[[Get]]` is called from the abstract operation `GetValue` which operates on References. But where is `GetValue` called from?

### Runtime semantics for `MemberExpression` { #memberexpression }

The grammar rules of the spec define the syntax of the language. [Runtime semantics](https://tc39.es/ecma262/#sec-runtime-semantics) define what the syntactic constructs “mean” (how to evaluate them at runtime).

If you’re not familiar with [context-free grammars](https://en.wikipedia.org/wiki/Context-free_grammar), it’s a good idea to have a look now!

We’ll take a deeper look into the grammar rules in a later episode, let’s keep it simple for now! In particular, we can ignore the subscripts (`Yield`, `Await` and so on) in the productions for this episode.

The following productions describe what a [`MemberExpression`](https://tc39.es/ecma262/#prod-MemberExpression) looks like:

<pre><code class="language-grammar">MemberExpression :
  PrimaryExpression
  MemberExpression <b>[</b> Expression <b>]</b>
  MemberExpression <b>.</b> IdentifierName
  MemberExpression TemplateLiteral
  SuperProperty
  MetaProperty
  <b>new</b> MemberExpression Arguments</code></pre>

Here we have 7 productions for `MemberExpression`. A `MemberExpression` can be just a `PrimaryExpression`. Alternatively, a `MemberExpression` can be constructed from another `MemberExpression` and `Expression` by piecing them together: `MemberExpression [ Expression ]`, for example `o2['foo']`. Or it can be `MemberExpression . IdentifierName`, for example `o2.foo` — this is the production relevant for our example.

Runtime semantics for the production `MemberExpression : MemberExpression . IdentifierName` define the set of steps to take when evaluating it:

:::ecmascript-algorithm
> **[Runtime Semantics: Evaluation for `MemberExpression : MemberExpression . IdentifierName`](https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation)**
>
> 1. Let `baseReference` be the result of evaluating `MemberExpression`.
> 1. Let `baseValue` be `? GetValue(baseReference)`.
> 1. If the code matched by this `MemberExpression` is strict mode code, let `strict` be `true`; else let `strict` be `false`.
> 1. Return `? EvaluatePropertyAccessWithIdentifierKey(baseValue, IdentifierName, strict)`.

The algorithm delegates to the abstract operation `EvaluatePropertyAccessWithIdentifierKey`, so we need to read it too:

:::ecmascript-algorithm
> **[`EvaluatePropertyAccessWithIdentifierKey( baseValue, identifierName, strict )`](https://tc39.es/ecma262/#sec-evaluate-property-access-with-identifier-key)**
>
> The abstract operation `EvaluatePropertyAccessWithIdentifierKey` takes as arguments a value `baseValue`, a Parse Node `identifierName`, and a Boolean argument `strict`. It performs the following steps:
>
> 1. Assert: `identifierName` is an `IdentifierName`
> 1. Let `bv` be `? RequireObjectCoercible(baseValue)`.
> 1. Let `propertyNameString` be `StringValue` of `identifierName`.
> 1. Return a value of type Reference whose base value component is `bv`, whose referenced name component is `propertyNameString`, and whose strict reference flag is `strict`.

That is: `EvaluatePropertyAccessWithIdentifierKey` constructs a Reference which uses the provided `baseValue` as the base, the string value of `identifierName` as the property name, and `strict` as the strict mode flag.

Eventually this Reference gets passed to `GetValue`. This is defined in several places in the spec, depending on how the Reference ends up being used.

### `MemberExpression` as a parameter

In our example, we use the property access as a parameter:

```js
console.log(o2.foo);
```

In this case, the behavior is defined in the runtime semantics of `ArgumentList` production which calls `GetValue` on the argument:

:::ecmascript-algorithm
> **[Runtime Semantics: `ArgumentListEvaluation`](https://tc39.es/ecma262/#sec-argument-lists-runtime-semantics-argumentlistevaluation)**
>
> `ArgumentList : AssignmentExpression`
>
> 1. Let `ref` be the result of evaluating `AssignmentExpression`.
> 1. Let `arg` be `? GetValue(ref)`.
> 1. Return a List whose sole item is `arg`.

`o2.foo` doesn’t look like an `AssignmentExpression` but it is one, so this production is applicable. To find out why, you can check out this [extra content](/blog/extras/understanding-ecmascript-part-2-extra), but it’s not strictly necessary at this point.

The `AssignmentExpression` in step 1 is `o2.foo`. `ref`, the result of evaluating `o2.foo`, is the above mentioned Reference. In step 2 we call `GetValue` on it. Thus, we know that the Object internal method `[[Get]]` will get invoked, and the prototype chain walk will occur.

## Summary

In this episode, we looked at how the spec defines a language feature, in this case prototype lookup, across all the different layers: the syntactic constructs that trigger the feature and the algorithms defining it.
