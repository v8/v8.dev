---
title: 'Optional chaining'
author: 'Maya Lekova ([@MayaLekova](https://twitter.com/MayaLekova)), breaker of optional chains'
avatars:
  - 'maya-lekova'
date: 2019-08-27
tags:
  - ECMAScript
description: 'Optional chaining enables readable and concise expression of property accesses with built-in nullish checking.'
tweet: '1166360971914481669'
---
Long chains of property accesses in JavaScript can be error-prone, as any of them might evaluate to `null` or `undefined` (also known as “nullish” values). Checking for property existence on each step easily turns into a deeply-nested structure of `if`-statements or a long `if`-condition replicating the property access chain:

```js
// Error prone-version, could throw.
const nameLength = db.user.name.length;

// Less error-prone, but harder to read.
let nameLength;
if (db && db.user && db.user.name)
  nameLength = db.user.name.length;
```

The above can also be expressed using the ternary operator, which doesn’t exactly help readability:

```js
const nameLength =
  (db
    ? (db.user
      ? (db.user.name
        ? db.user.name.length
        : undefined)
      : undefined)
    : undefined);
```

## Introducing the optional chaining operator { #optional-chaining }

Surely you don’t want to write code like that, so having some alternative is desirable. Some other languages offer an elegant solution to this problem with using a feature called “optional chaining”. According to [a recent spec proposal](https://github.com/tc39/proposal-optional-chaining), “an optional chain is a chain of one or more property accesses and function calls, the first of which begins with the token `?.`”.

Using the new optional chaining operator, we can rewrite the above example as follows:

```js
// Still checks for errors and is much more readable.
const nameLength = db?.user?.name?.length;
```

What happens when `db`, `user`, or `name` is `undefined` or `null`? With the optional chaining operator, JavaScript initializes `nameLength` to `undefined` instead of throwing an error.

Notice that this behavior is also more robust than our check for `if (db && db.user && db.user.name)`. For instance, what if `name` was always guaranteed to be a string? We could change `name?.length` to `name.length`. Then, if `name` were an empty string, we would still get the correct `0` length. That is because the empty string is a falsy value: it behaves like `false` in an `if` clause. The optional chaining operator fixes this common source of bugs.

## Additional syntax forms: calls and dynamic properties

There’s also a version of the operator for calling optional methods:

```js
// Extends the interface with an optional method, which is present
// only for admin users.
const adminOption = db?.user?.validateAdminAndGetPrefs?.().option;
```

The syntax can feel unexpected, as the `?.()` is the actual operator, which applies to the expression _before_ it.

There’s a third usage of the operator, namely the optional dynamic property access, which is done via `?.[]`. It either returns the value referenced by the argument in the brackets, or `undefined` if there’s no object to get the value from. Here’s a possible use case, following the example from above:

```js
// Extends the capabilities of the static property access
// with a dynamically generated property name.
const optionName = 'optional setting';
const optionLength = db?.user?.preferences?.[optionName].length;
```

This last form is also available for optionally indexing arrays, e.g.:

```js
// If the `usersArray` is `null` or `undefined`,
// then `userName` gracefully evaluates to `undefined`.
const userIndex = 42;
const userName = usersArray?.[userIndex].name;
```

The optional chaining operator can be combined with the [nullish coalescing `??` operator](https://github.com/tc39/proposal-nullish-coalescing) when a non-`undefined` default value is needed. This enables safe deep property access with a specified default value, addressing a common use case that previously required userland libraries such as [lodash’s `_.get`](https://lodash.dev/docs/4.17.15#get):

```js
const object = { id: 123, names: { first: 'Alice', last: 'Smith' }};

{ // With lodash:
  const firstName = _.get(object, 'names.first');
  // → 'Alice'

  const middleName = _.get(object, 'names.middle', '(no middle name)');
  // → '(no middle name)'
}

{ // With optional chaining and nullish coalescing:
  const firstName = object?.names?.first ?? '(no first name)';
  // → 'Alice'

  const middleName = object?.names?.middle ?? '(no middle name)';
  // → '(no middle name)'
}
```

## Properties of the optional chaining operator { #properties }

The optional chaining operator has a few interesting properties: _short-circuiting_, _stacking_, and _optional deletion_. Let’s walk through each of these with an example.

_Short-circuiting_ means not evaluating the rest of the expression if an optional chaining operator returns early:

```js
// `age` is incremented only if `db` and `user` are defined.
db?.user?.grow(++age);
```

_Stacking_ means that more than one optional chaining operator can be applied on a sequence of property accesses:

```js
// An optional chain may be followed by another optional chain.
const firstNameLength = db.users?.[42]?.names.first.length;
```

Still, be considerate about using more than one optional chaining operator in a single chain. If a value is guaranteed to not be nullish, then using `?.` to access properties on it is discouraged. In the example above, `db` is considered to always be defined, but `db.users` and `db.users[42]` may not be. If there’s such a user in the database, then `names.first.length` is assumed to always be defined.

_Optional deletion_ means that the `delete` operator can be combined with an optional chain:

```js
// `db.user` is deleted only if `db` is defined.
delete db?.user;
```

More details can be found in [the _Semantics_ section of the proposal](https://github.com/tc39/proposal-optional-chaining#semantics).

## Support for optional chaining { #support }

<feature-support chrome="no https://bugs.chromium.org/p/v8/issues/detail?id=9553"
                 firefox="no https://bugzilla.mozilla.org/show_bug.cgi?id=1566143"
                 safari="no https://bugs.webkit.org/show_bug.cgi?id=200199"
                 nodejs="no"
                 babel="yes https://babeljs.io/docs/en/babel-plugin-proposal-optional-chaining"></feature-support>
