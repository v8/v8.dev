---
title: 'An additional non-backtracking RegExp engine'
author: 'Martin Bidlingmaier'
date: 2021-01-11
tags:
 - internals
 - RegExp
description: 'V8 now has an additional RegExp engine that serves as a fallback and prevents many instances of catastrophic backtracking.'
tweet: '1348635270762139650'
---
Starting with v8.8, V8 ships with a new experimental non-backtracking RegExp engine (in addition to the existing [Irregexp engine](https://blog.chromium.org/2009/02/irregexp-google-chromes-new-regexp.html)) which guarantees execution in linear time with respect to the size of the subject string. The experimental engine is available behind the feature flags mentioned below.

![Runtime of `/(a*)*b/.exec('a'.repeat(n))` for n ≤ 100](/_img/non-backtracking-regexp/runtime-plot.svg)

Here’s how you can configure the new RegExp engine:

- `--enable-experimental-regexp_engine-on-excessive-backtracks` enables the fallback to the non-backtracking engine on excessive backtracks.
- `--regexp-backtracks-before-fallback N` (default N = 50,000) specifies how many backtracks are considered “excessive”, i.e. when the fallback kicks in.
- `--enable-experimental-regexp-engine` turns on recognition of the non-standard `l` (“linear”) flag for RegExps, as in e.g. `/(a*)*b/l`. RegExps constructed with this flag are always eagerly executed with the new engine; Irregexp is not involved at all. If the new RegExp engine can’t handle the pattern of an `l`-RegExp, then an exception is thrown at construction. We hope that this feature can at some point be used for hardening of apps that run RegExps on untrusted input. For now it remains experimental because Irregexp is orders of magnitude faster than the new engine on most common patterns.

The fallback mechanism does not apply to all patterns. For the fallback mechanism to kick in, the RegExp must:

- not contain backreferences,
- not contain lookaheads or lookbehinds,
- not contain large or deeply nested finite repetitions, as in e.g. `/a{200,500}/`, and
- not have the `u` (Unicode) or `i` (case insensitive) flags set.

## Background: catastrophic backtracking

RegExp matching in V8 is handled by the Irregexp engine. Irregexp jit-compiles RegExps to specialized native code (or [bytecode](/blog/regexp-tier-up)) and is thus extremely fast for most patterns. For some patterns, however, Irregexp’s runtime can blow up exponentially in the size of the input string. The example above, `/(a*)*b/.exec('a'.repeat(100))`, does not finish within our lifetimes if executed by Irregexp.

So what’s going on here? Irregexp is a *backtracking* engine. When faced with a choice of how a match can continue, Irregexp explores the first alternative in its entirety, and then backtracks if necessary to explore the second alternative. Consider for instance matching the pattern `/abc|[az][by][0-9]/` against the subject string `'ab3'`. Here Irregexp tries to match `/abc/` first and fails after the second character. It then backtracks by two characters and successfully matches the second alternative `/[az][by][0-9]/`. In patterns with quantifiers such as `/(abc)*xyz/`, Irregexp has to choose after a match of the body whether to match the body again or to continue with the remaining pattern.

Let’s try to understand what’s going on when matching `/(a*)*b/` against a smaller subject string, say `'aaa'`. This pattern contains nested quantifiers, so we’re asking Irregexp to match a *sequence of sequences* of `'a'`, and then match `'b'`. Clearly there is no match because the subject string does not contain `'b'`. However, `/(a*)*/` matches, and it does so in exponentially many different ways:

```js
'aaa'           'aa', 'a'           'aa', ''
'a', 'aa'       'a', 'a', 'a'       'a', 'a', ''
…
```

A priori, Irregexp cannot rule out that the failure to match the final `/b/` is due to choosing the wrong way of matching `/(a*)*/`, so it has to try all variants. This problem is known as “exponential” or “catastrophic” backtracking.

## RegExps as automata and bytecode

To understand an alternative algorithm that is immune to catastrophic backtracking, we have to take a quick detour via [automata](https://en.wikipedia.org/wiki/Nondeterministic_finite_automaton). Every regular expression is equivalent to an automaton. For example, the RegExp `/(a*)*b/` above corresponds to the following automaton:

![Automaton corresponding to `/(a*)*b/`](/_img/non-backtracking-regexp/example-automaton.svg)

Note that the automaton is not uniquely determined by the pattern; the one you see above is the automaton you will get by a mechanical translation process, and it’s the one that’s used inside the V8’s new RegExp engine for `/(a*)*/`.
The unlabeled edges are epsilon transitions: They don’t consume input. Epsilon transitions are necessary to keep the size of the automaton at around the size of the pattern. Naively eliminating epsilon transitions can result in quadratic increase of the number of transitions.
Epsilon transitions also allow constructing the automaton corresponding to a RegExp from the following four basic kinds of states:

![RegExp bytecode instructions](/_img/non-backtracking-regexp/state-types.svg)

Here we only classify the transitions *out* of the state, while the transitions into the state are still allowed to be arbitrary. Automata built from only these kinds of states can be represented as *bytecode programs*, with every state corresponding to an instruction. For example, a state with two epsilon transitions is represented as a `FORK` instruction.

## The backtracking algorithm

Let’s revisit the backtracking algorithm that Irregexp is based upon and describe it in terms of automata. Suppose we’re given a bytecode array `code` corresponding to the pattern and want to `test` whether an `input` matches the pattern. Let’s assume that `code` looks something like this:

```js
const code = [
  {opcode: 'FORK', forkPc: 4},
  {opcode: 'CONSUME', char: '1'},
  {opcode: 'CONSUME', char: '2'},
  {opcode: 'JMP', jmpPc: 6},
  {opcode: 'CONSUME', char: 'a'},
  {opcode: 'CONSUME', char: 'b'},
  {opcode: 'ACCEPT'}
];
```

This bytecode corresponds to the (sticky) pattern `/12|ab/y`. The `forkPc` field of the `FORK` instruction is the index (“program counter”) of the alternative state/instruction that we can continue at, and similarly for `jmpPc`. Indices are zero-based. The backtracking algorithm can now be implemented in JavaScript as follows.

```js
let ip = 0; // Input position.
let pc = 0; // Program counter: index of the next instruction.
const stack = []; // Backtrack stack.
while (true) {
  const inst = code[pc];
  switch (inst.opcode) {
    case 'CONSUME':
      if (ip < input.length && input[ip] === inst.char) {
        // Input matches what we expect: Continue.
        ++ip;
        ++pc;
      } else if (stack.length > 0) {
        // Wrong input character, but we can backtrack.
        const back = stack.pop();
        ip = back.ip;
        pc = back.pc;
      } else {
        // Wrong character, cannot backtrack.
        return false;
      }
      break;
    case 'FORK':
      // Save alternative for backtracking later.
      stack.push({ip: ip, pc: inst.forkPc});
      ++pc;
      break;
    case 'JMP':
      pc = inst.jmpPc;
      break;
    case 'ACCEPT':
      return true;
  }
}
```

This implementation loops indefinitely if the bytecode program contains loops that do not consume any character, i.e. if the automaton contains a loop consisting of epsilon transitions only. This issue can be solved with lookahead by a single character. Irregexp is much more sophisticated than this simple implementation, but ultimately based on the same algorithm.

## The non-backtracking algorithm

The backtracking algorithm corresponds to *depth-first* traversal of the automaton: We always explore the first alternative of a `FORK` statement in its entirety and then backtrack to the second alternative if necessary. The alternative to it, the non-backtracking algorithm, is thus unsurprisingly based on *breadth-first* traversal of the automaton. Here we consider all alternatives simultaneously, in lockstep with respect to the current position in the input string. We thus maintain a list of current states, and then advance all states by taking transitions corresponding to each input character. Crucially, we remove duplicates from the list of current states.

A simple implementation in JavaScript looks something like this:

```js
// Input position.
let ip = 0;
// List of current pc values, or `'ACCEPT'` if we’ve found a match. We start at
// pc 0 and follow epsilon transitions.
let pcs = followEpsilons([0]);

while (true) {
  // We’re done if we’ve found a match…
  if (pcs === 'ACCEPT') return true;
  // …or if we’ve exhausted the input string.
  if (ip >= input.length) return false;

  // Continue only with the pcs that CONSUME the correct character.
  pcs = pcs.filter(pc => code[pc].char === input[ip]);
  // Advance the remaining pcs to the next instruction.
  pcs = pcs.map(pc => pc + 1);
  // Follow epsilon transitions.
  pcs = followEpsilons(pcs);

  ++ip;
}
```

Here `followEpsilons` is a function that takes a list of program counters and computes the list of program counters at `CONSUME` instructions that can be reached via epsilon transitions (i.e. by only executing FORK and JMP). The returned list must not contain duplicates. If an `ACCEPT` instruction can be reached, the function returns `'ACCEPT'`. It can be implemented like this:

```js
function followEpsilons(pcs) {
  // Set of pcs we’ve seen so far.
  const visitedPcs = new Set();
  const result = [];

  while (pcs.length > 0) {
    const pc = pcs.pop();

    // We can ignore pc if we’ve seen it earlier.
    if (visitedPcs.has(pc)) continue;
    visitedPcs.add(pc);

    const inst = code[pc];
    switch (inst.opcode) {
      case 'CONSUME':
        result.push(pc);
        break;
      case 'FORK':
        pcs.push(pc + 1, inst.forkPc);
        break;
      case 'JMP':
        pcs.push(inst.jmpPc);
        break;
      case 'ACCEPT':
        return 'ACCEPT';
    }
  }

  return result;
}
```

Because of the elimination of duplicates via the `visitedPcs` set, we know that every program counter is only examined once in `followEpsilons`. This guarantees that the `result` list does not contain duplicates, and that the runtime of `followEpsilons` is bounded by the size of the `code` array, i.e. the size of the pattern. `followEpsilons` is called at most `input.length` times, so the total runtime of RegExp matching is bounded by `𝒪(pattern.length * input.length)`.

The non-backtracking algorithm can be extended to support most features of JavaScript RegExps, for example word boundaries or the calculation of (sub)match boundaries. Unfortunately, backreferences, lookahead and lookbehind cannot be supported without major changes that alter asymptotic worst-case complexity.

V8’s new RegExp engine is based on this algorithm and its implementation in the [re2](https://github.com/google/re2) and [Rust regex](https://github.com/rust-lang/regex) libraries. The algorithm is discussed in much more depth than here in an excellent [series of blog posts](https://swtch.com/~rsc/regexp/) by Russ Cox, who is also the original author of the re2 library.
