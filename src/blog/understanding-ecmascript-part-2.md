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

## Previous episodes

If you haven't had a look at the previous episodes, now it's a good time to do so!

In [part 1](https://v8.dev/blog/understanding-ecmascript-part-1) we read through a simple method, `Object.prorotype.hasOwnProperty`, and other **abstract operations** it invokes. We familiarized ourselves with the shorhands `?` and `!`related to error handling. We encountered **language types**, **specification types**, **internal slots** and **internal methods**.

## Ready for part 2?

A fun way to get to know the spec is to start with a JavaScript feature we know is there, and find out how it's specified.

We know that properties are looked up in the prototype chain: if an object doesn't have the property we're trying to read, we walk up the prototype chain until we find it (or find an object which no longer has a prototype).

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

There's both `[[GetOwnProperty]]` and `[[Get]]` &mdash; now we're interested in the version that isn't restricted to _own_ properties, so we'll go with `[[Get]]`.

Unfortunately, the [Property Descriptor specification type](https://tc39.es/ecma262/#sec-property-descriptor-specification-type) also has a field called `[[Get]]`, so while browsing the spec for `[[Get]]`, we need to carefully distinguish between the two independent usages.

The internal method `[[Get]]` delegates to `OrdinaryGet`:

> [`[[Get]] ( P, Receiver )`](https://tc39.es/ecma262/#sec-ordinary-object-internal-methods-and-internal-slots-get-p-receiver)
>
> When the `[[Get]]` internal method of `O` is called with property key `P` and ECMAScript language value `Receiver`, the following steps are taken:
>
> 1. Return `? OrdinaryGet(O, P, Receiver)`.

We'll see shortly that `Receiver` is the value which is used as the **this value** when calling a getter function of an accessor property.

`OrdinaryGet` is defined like this:

> [`OrdinaryGet ( O, P, Receiver )`](https://tc39.es/ecma262/#sec-ordinaryget)
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

The prototype chain walk is inside step 3: if we don't find the property as an own property, we recurse into the prototype's `[[Get]]` method.

## What's `Receiver` and where is it coming from?

The `Receiver` parameter is only used in the case of accessor properties. It's passed as the **this value** when calling the getter function of an accessor property (step 8 of `OrdinaryGet`).

`OrdinaryGet` passes the original `Receiver` throughout the recursion, unchanged (step 3c of `OrdinaryGet`). Let's find out where the `Receiver` is originally coming from!

Searching for places where `[[Get]]` is called we find an abstract operation `GetValue` which operates on References. Reference is a specification type, consisting of a base value (in this case, an Object), the reference name (in this case, a String), and a strict mode flag (bool).

### Side track: References

Side track: A Reference is not a Record, even though it sounds like it could be &mdash; it contains three fixed named values. Here the spec takes a different approach, and defines References as a higher-level data type. This is because of historical reasons.

### Back to `GetValue`

Let's look at how `GetValue` is defined:

> [`GetValue ( V )`](https://tc39.es/ecma262/#sec-getvalue)
>
> 1. `ReturnIfAbrupt(V)`.
> 2. If `Type(V)` is not `Reference`, return `V`.
> 3. Let `base` be `GetBase(V)`.
> 4. If `IsUnresolvableReference(V)` is `true`, throw a `ReferenceError` exception.
> 5. If `IsPropertyReference(V)` is `true`, then
> a. If `HasPrimitiveBase(V)` is `true`, then
> i. Assert: In this case, `base` will never be `undefined` or `null`.
> ii. Set `base` to `! ToObject(base)`.
> b. Return `? base.[[Get]](GetReferencedName(V), GetThisValue(V))`.
> 6. Else,
> a. Assert: `base` is an Environment Record.
> b. Return `? base.GetBindingValue(GetReferencedName(V), IsStrictReference(V))`

For property references such as `o.foo`, we take the branch 5 b. The `Receiver` we pass is `GetThisValue(V)`. In this case, it's just the base of the Reference:

> [`GetThisValue( V )`](https://tc39.es/ecma262/#sec-getthisvalue)
>
> 1. Assert: `IsPropertyReference(V)` is `true`.
> 2. If `IsSuperReference(V)` is `true`, then
> a. Return the value of the `thisValue` component of the reference `V`.
> 3. Return `GetBase(V)`.

Interesting! The `this` inside the getter refers to the original object where we tried to get the property from, not the one where we found the property during the prototype chain walk. Let's try it out!

```javascript
const o = { x: 10, get sneaky() { return this.x; } };
let o2 = {};
o2.__proto__ = o;
o2.sneaky; // will return 10
o2.x = 50;
o2.sneaky; // will return 50
o.sneaky; // will return 10
```

It really works! We were able to predict the behavior of this code snippet based on what we read in the spec.

(Note that setting `o2.x = 50` adds a property called `x` in `o2` and doesn't overwrite the property `x` in `o`.)

## Accessing properties - why does it invoke `[[Get]]`?

But where does the spec say that the Object internal method `[[Get]]` will get invoked when accessing a property like `o2.foo` or `o2.sneaky`? Surely that has to be defined somewhere. Don't take my word for it!

We found out that the Object internal method `[[Get]]` is called from the abstract operation `GetValue` which operates on References. But where is `GetValue` called from?

### Runtime Semantics

The grammar rules of the spec define the syntax of the language. [Runtime semantics](https://tc39.es/ecma262/#sec-runtime-semantics) define what the syntactic constructs "mean" (how to evaluate them at runtime).

We'll take a deeper look into the grammar rules in a later episode, let's keep it simple for now! In particular, we can ignore the subscripts (`Yield`, `Await` and so on) in the productions for this episode.

The following productions describe how a `MemberExpression` looks like:

> [`MemberExpression`](https://tc39.es/ecma262/#prod-MemberExpression):
>
> `PrimaryExpression`
> `MemberExpression [ Expression ]`
> `MemberExpression . IdentifierName`
> `MemberExpression TemplateLiteral`
> `SuperProperty`
> `MetaProperty`
> `new MemberExpression Arguments`

Here we have 8 productions for `MemberExpression`. A `MemberExpression` can be just a `PrimaryExpression` (production: `MemberExpression` : `PrimaryExpression`). Alternatively, a `MemberExpression` can be constructed from another `MemberExpression` and `Expression` by piecing them together: `MemberExpression [ Expression ]`, for example `o2['foo']`. Or it can be `MemberExpression . IdentifierName`, for example `o2.foo` &mdash; this is the production relevant for our example.

Runtime semantics for the production `MemberExpression` `:` `MemberExpression` `.` `IdentifierName` define the set of steps to take when evaluating it:

> [Runtime Semantics: Evaluation for `MemberExpression` `:` `MemberExpression` `.` `IdentifierName`](https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation)
>
> 1. Let `baseReference` be the result of evaluating `MemberExpression`.
> 2. Let `baseValue` be `? GetValue(baseReference)`.
> 3. If the code matched by this `MemberExpression` is strict mode code, let `strict` be `true`; else let `strict` be `false`.
> 4. Return `? EvaluatePropertyAccessWithIdentifierKey(baseValue, IdentifierName, strict)`.

The algorithm delegates to the abstract operation `EvaluatePropertyAccessWithIdentifierKey`, so we need to read it too:

> [`EvaluatePropertyAccessWithIdentifierKey( baseValue, identifierName, strict )`](https://tc39.es/ecma262/#sec-evaluate-property-access-with-identifier-key)
>
> The abstract operation `EvaluatePropertyAccessWithIdentifierKey` takes as arguments a value `baseValue`, a Parse Node `identifierName`, and a Boolean argument `strict`. It performs the following steps:
>
> 1. Assert: `identifierName` is an IdentifierName
> 2. Let `bv` be `? RequireObjectCoercible(baseValue)`.
> 3. Let `propertyNameString` be StringValue of `identifierName`.
> 4. Return a value of type Reference whose base value component is `bv`, whose referenced name component is `propertyNameString`, and whose strict reference flag is `strict`.

That is: `EvaluatePropertyAccessWithIdentifierKey` constructs a Reference which uses the provided `baseValue` as the base and the string value of `identifierName` as the property name.

Eventually this Reference gets passed to `GetValue`. This is defined in several places in the spec, depending on how the Reference ends up being used.

### Property access as a parameter

For example, we can use the property access as a parameter.

```javascript
console.log(o.foo);
```

In this case, the behavior is defined in the runtime semantics of `ArgumentList` production which calls `GetValue` on the argument:

> [Runtime Semantics: ArgumentListEvaluation](https://tc39.es/ecma262/#sec-argument-lists-runtime-semantics-argumentlistevaluation)
>
> `ArgumentList : AssignmentExpression`
>
> 1. Let `ref` be the result of evaluating `AssignmentExpression`.
> 2. Let `arg` be `? GetValue(ref)`.
> 3. Return a List whose sole item is `arg`.

Now the `AssignmentExpression` is `o.foo` and the result of evaluating it is the above mentioned Reference. Now we call `GetValue` on it.

### Property access as the right hand side of an assignemnt

We can also use the property access as a right hand side of an assignment:

```javascript
const x = o.foo;
```

In this case, the behavior is defined in the runtime semantics for the `AssignmentExpression` production which calls `GetValue` on the right hand side:

> [Runtime Semantics: Evaluation for `AssignmentExpression : LeftHandSideExpression = AssignmentExpression`](https://tc39.es/ecma262/#sec-assignment-operators-runtime-semantics-evaluation)
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

Now the `LeftHandSideExpression` is not an object literal or an array literal, so we take the if branch in step 1. The assignment expression is `o.foo`, and it's not a function definition, so we take the else branch in 1 d. There we evaluate the `AssignmentExpression` and call `GetValue` on it.

In any case, `GetValue` will be called on the Reference which is the result of evaluating the `MemberExpression`. Thus, we know that the Object internal method `[[Get]]` will get invoked when accessing a property on an Object, and the prototype chain walk will occur.

### Why is `o2.foo` an `AssignmentExpression`?

Just one more thing. Previously, we used `o2.foo` as an `AssignmentExpression`. It doesn't look like one though. Why is it an `AssignmentExpression`?

The spec actually allows an `AssignmentExpression` both as an argument and as the right hand side of an assignment. For example:

```javascript
function simple(a) { console.log('The argument was ' + a); }
simple(x = 1); // Prints out: The argument was 1
x; // 1
```

and

```javascript
let x = (y = 5);
x; // 5
y; // 5
```

`o2.foo` is a "degenerate" `AssignmentExpression` which doesn't assign anything. This follows from the following grammar productions, each one taking the "simplest" or "most degenerate" case until the last one.

An `AssignmentExpresssion` doesn't need to have an assignment, it can also be just a `ConditionalExpression`:

> [`AssignmentExpression : ConditionalExpression`](https://tc39.es/ecma262/#sec-assignment-operators)

A `ConditionalExpression` doesn't need to have a conditional (`a == b ? c : d`), it can also be just a `ShortcircuitExpression`:

> [`ConditionalExpression : ShortCircuitExpression`](https://tc39.es/ecma262/#sec-conditional-operator)

And so on:

> [`ShortCircuitExpression : LogicalORExpression`](https://tc39.es/ecma262/#prod-ShortCircuitExpression)
>
> [`LogicalORExpression : LogicalANDExpression`](https://tc39.es/ecma262/#prod-LogicalORExpression)
>
> [`LogicalANDExpression : BitwiseORExpression`](https://tc39.es/ecma262/#prod-LogicalANDExpression)
>
> [`BitwiseORExpression : BitwiseXORExpression`](https://tc39.es/ecma262/#prod-BitwiseORExpression)
>
> [`BitwiseXORExpression : BitwiseANDExpression`](https://tc39.es/ecma262/#prod-BitwiseXORExpression)
>
> [`BitwiseANDExpression : EqualityExpression`](https://tc39.es/ecma262/#prod-BitwiseANDExpression)
>
> [`EqualityExpression : RelationalExpression`](https://tc39.es/ecma262/#sec-equality-operators)
>
> [`RelationalExpression : ShiftExpression`](https://tc39.es/ecma262/#prod-RelationalExpression)

Almost there...

> [`ShiftExpression : AdditiveExpression`](https://tc39.es/ecma262/#prod-ShiftExpression)
>
> [`AdditiveExpression : MultiplicativeExpression`](https://tc39.es/ecma262/#prod-AdditiveExpression)
>
> [`MultiplicativeExpression : ExponentialExpression`](https://tc39.es/ecma262/#prod-MultiplicativeExpression)
>
> [`ExponentialExpression : UnaryExpression`](https://tc39.es/ecma262/#prod-ExponentiationExpression)

Don't despair! Just a couple of more productions...

> [`UnaryExpression : UpdateExpression`](https://tc39.es/ecma262/#prod-UnaryExpression)
>
> [`UpdateExpression : LeftHandSideExpression`](https://tc39.es/ecma262/#prod-UpdateExpression)

None of the productions of `LeftHandSideExpression` sound particularly degenerate, but we just need to know (or find out) that a `NewExpression` doesn't actually have to have the `new` keyword.

> [`LeftHandSideExpression : NewExpression`](https://tc39.es/ecma262/#prod-LeftHandSideExpression)
>
> [`NewExpression : MemberExpression`](https://tc39.es/ecma262/#prod-NewExpression)

`MemberExpression` sounds like something we were looking for, so now we take the non-degenerate production:

> [`MemberExpression : MemberExpression . IdentifierName`](https://tc39.es/ecma262/#prod-MemberExpression)

So, `o2.foo` is a `MemberExpression` if `o2` is a valid `MemberExpression`. Luckily it's much easier to see:

> [`MemberExpression : PrimaryExpression`](https://tc39.es/ecma262/#prod-MemberExpression)
>
> [`PrimaryExpression : IdentifierReference`](https://tc39.es/ecma262/#prod-PrimaryExpression)
>
> [`IdentifierReference : Identifier`](https://tc39.es/ecma262/#prod-IdentifierReference)

`o2` surely is an identifier so we're good.

## Final words

In this episode, we looked at how a language feature, in this case prototype lookup, in defined across all the different layers: the syntactic constructs that trigger the feature and the algorithms defining it.
