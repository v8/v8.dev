---
 title: 'Land ahoy: leaving the Sea of Nodes'
 author: 'Darius Mercadier'
 avatars:
   - darius-mercadier
 date: 2025-03-25
 tags:
   - JavaScript
   - internals
 description: "Why V8 decided to move away from Sea of Nodes and go back to CFG instead"
 tweet: ''
---

V8’s end-tier optimizing compiler, Turbofan, is famously one of the few large-scale production compilers to use [Sea of Nodes](https://en.wikipedia.org/wiki/Sea_of_nodes) (SoN). However, since almost 3 years ago, we’ve started to get rid of Sea of Nodes and fall back to a more traditional [Control-Flow Graph](https://en.wikipedia.org/wiki/Control-flow_graph) (CFG) [Intermediate Representation](https://en.wikipedia.org/wiki/Intermediate_representation) (IR), which we named Turboshaft. By now, the whole JavaScript backend of Turbofan uses Turboshaft instead, and WebAssembly uses Turboshaft throughout its whole pipeline. Two parts of Turbofan still use some Sea of Nodes: the builtin pipeline, which we’re slowly replacing by Turboshaft, and the frontend of the JavaScript pipeline, which we’re replacing by Maglev, another CFG-based IR. This blog post explains the reasons that led us to move away from Sea of Nodes.

# The birth of Turbofan and Sea of Nodes

12 years ago, in 2013, V8 had a single optimizing compiler: [Crankshaft](https://blog.chromium.org/2010/12/new-crankshaft-for-v8.html). It was using a Control-Flow Graph based Intermediate Representation. The initial version of Crankshaft provided significant performance improvements despite still being quite limited in what it supported. Over the next few years, the team kept improving it to generate even faster code in ever more situations. However, technical debt was starting to stack up and a number of issues were arising with Crankshaft:

1. It contained too much hand-written assembly code. Every time a new operator was added to the IR, its translation to assembly had to be manually written for the four architectures officially supported by V8 (x64, ia32, arm, arm64).

2. It struggled with optimizing [asm.js](https://en.wikipedia.org/wiki/Asm.js), which was back then seen as an important step towards high-performance JavaScript.

3. It didn’t allow introducing control flow in lowerings. Put otherwise, control flow was created at graph building time, and was then final. This was a major limitation, given that a common thing to do when writing compilers is to start with high-level operations, and then lower them to low-level operations, often by introducing additional control flow. Consider for instance a high-level operation `JSAdd(x,y)`, it could make sense to later lower it to something like `if (x is String and y is String) { StringAdd(x, y) } else { … }`. Well, that wasn’t possible in Crankshaft.

4. Try-catches were not supported, and supporting them was very challenging: multiple engineers had spent months trying to support them, without success.

5. It suffered from many performance cliffs and bailouts. Using a specific feature or instruction, or running into a specific edge case of a feature, could cause performance to drop by a factor 100\. This made it hard for JavaScript developers to write efficient code and to anticipate the performance of their applications.

6. It contained many *deoptimization loops*: Crankshaft would optimize a function using some speculative assumptions, then the function would get deoptimized when those assumptions didn’t hold, but too often, Crankshaft would reoptimize the function with the same assumptions, leading to endless optimization-deoptimization loops.

Individually, each of these issues could have probably been overcome. However, combined all together, they seemed like too much. So, the decision was made to replace Crankshaft with a new compiler written from scratch: [Turbofan](https://v8.dev/docs/turbofan). And, rather than using a traditional CFG IR, Turbofan would use a supposedly more powerful IR: Sea of Nodes. At the time, this IR had already been used for more than 10 years in C2, the JIT compiler of the Java HotSpot Virtual Machine.

# But what is Sea of Nodes, really?

First, a small reminder about control-flow graph (CFG): a CFG is a representation of a program as a graph where nodes of the graph represent [basic blocks](https://en.wikipedia.org/wiki/Basic_block) of the program (that is, sequence of instructions without incoming or outgoing branches or jumps), and edges represent the control flow of the program. Here is a simple example:

![Simple CFG graph](/_img/leaving-the-sea-of-nodes/CFG-example-1.svg)

Instructions within a basic block are implicitly ordered: the first instruction should be executed before the second one, and the second one before the third, etc. In the small example above, it feels very natural: `v1 == 0` can’t be computed before `x % 2` has been computed anyways. However, consider

![CFG graph with arithmetic operations that could be reordered](/_img/leaving-the-sea-of-nodes/CFG-example-2.svg)

Here, the CFG seemingly imposes that `a * 2` be computed before `b * 2`, even though we could very well compute them the other way around.
That’s where Sea of Nodes comes in: Sea of Nodes does not represent basic blocks, but rather only true dependencies between the instructions. Nodes in Sea of Nodes are single instructions (rather than basic blocks), and edges represent value uses (meaning: an edge from `a` to `b` represents the fact that `a` uses `b`). So, here is how this last example would be represented with Sea of Nodes:

![Simple Sea of Nodes graph with arithmetic operations](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-arith.svg)

Eventually, the compiler will need to generate assembly and thus will sequentially schedule these two multiplications, but until then, there is no more dependency between them.

Now let’s add control flow in the mix. Control nodes (e.g. `branch`, `goto`, `return`) typically don’t have value dependencies between each other that would force a particular schedule, even though they definitely have to be scheduled in a particular order. Thus, in order to represent control-flow, we need a new kind of edge, *control edges*, which impose some ordering on nodes that don’t have value dependency:

![Sea of Nodes graph with control flow](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-control.svg)

In this example, without control edges, nothing would prevent the `return`s from being executed before the `branch`, which would obviously be wrong.
The crucial thing here is that the control edges only impose an order of the operations that have such incoming or outgoing edges, but not on other operations such as the arithmetic operations. This is the main difference between Sea of Nodes and Control flow graphs.

Let’s now add effectful operations (eg, loads and stores from and to memory) in the mix. Similarly to control nodes, effectful operations often have no value dependencies, but still cannot run in a random order. For instance, `a[0] += 42; x = a[0]` and `x = a[0]; a[0] += 42` are not equivalent. So, we need a way to impose an order (= a schedule) on effectful operations. We could reuse the control chain for this purpose, but this would be stricter than required. For instance, consider this small snippet:

```javascript
let v = a[2];
if (c) {
  return v;
}
```

By putting `a[2]` (which reads memory) on the control chain, we would force it to happen before the branch on `c`, even though, in practice, this load could easily happen after the branch if its result is only used inside the body of the then-branch. Having lots of nodes in the program on the control chain would defeat the goal of Sea of Nodes, since we would basically end up with a CFG-like IR where only pure operations float around.

So, to enjoy more freedom and actually benefit from Sea of Nodes, Turbofan has another kind of edge, *effect edges*, which impose some ordering on nodes that have side effects. Let’s ignore control flow for now and look at a small example:

![Sea of Nodes graph with effectful operations](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-effects.svg)

In this example, `arr[0] = 42` and `let x = arr[a]` have no value dependency (ie, the former is not an input of the latter, and vice versa) . However, because `a` could be `0`,  `arr[0] = 42` should be executed before `x = arr[a]` in order for the latter to always load the correct value from the array.
*Note that while Turbofan has a single effect chain (which splits on branches, and merges back when the control flow merges) which is used for all effectful operations, it’s possible to have multiple effect chains, where operations that have no dependencies could be on different effect chains, thus relaxing how they can be scheduled (see [Chapter 10 of SeaOfNodes/Simple](https://github.com/SeaOfNodes/Simple/blob/main/chapter10/README.md) for more details). However, as we’ll explain later, maintaining a single effect chain is already very error prone, so we did not attempt in Turbofan to have multiple ones.*

And, of course, most real programs will contain both control flow and effectful operations.

![Sea of Nodes graph with control flow and effectful operations](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-control-and-effects.svg)

Note that `store` and `load` need control inputs, since they could be protected by various checks (such as type checks or bound checks).
This example is a good showcase of the power of Sea of Nodes compared to CFG: `y = x * c` is only used in the `else` branch thus will freely float to after the `branch` rather than being computed before as was written in the original JavaScript code. This is similar for `arr[0]`, which is only used in the `else` branch, and *could* thus float after the `branch` (although, in practice, Turbofan will not move down `arr[0]`, for reasons that I’ll explain later).
For comparison, here is what the corresponding CFG would look like:

![CFG graph with control flow and effectful operations](/_img/leaving-the-sea-of-nodes/CFG-control-and-effects.svg)

Already, we start seeing the main issue with SoN: it’s much further away from both the input (source code) and the output (assembly) of the compiler than CFG is, which makes it less intuitive to understand. Additionally, having effect and control dependencies always explicit makes it hard to quickly reason about the graph, and to write lowerings (since lowerings always have to explicitly maintain the control and effect chain, which are implicit in a CFG).

# And the troubles begin…

After more than a decade of dealing with Sea of Nodes, we think that it has more downsides than upsides, at least as far as JavaScript and WebAssembly are concerned.  We’ll go into details in a few of the issues below.

## Manually/visually inspecting and understanding a Sea of Nodes graph is hard

We’ve already seen that on small programs CFG is easier to read, as it is closer to the original source code, which is what developers (including Compiler Engineers\!) are used to write. For the unconvinced readers, let me offer a slightly larger example, so that you understand the issue better. Consider the following JavaScript function, which concatenates an array of strings:

```javascript
function concat(arr) {
  let res = "";
  for (let i = 0; i < arr.length; i++) {
    res += arr[i];
  }
  return res;
}
```

Here is the corresponding Sea of Node graph, in the middle of the Turbofan compilation pipeline (which means that some lowerings have already happened):

![Sea of Nodes graph for a simple array concatenation function](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-array-concat.png)

Already, this starts looking like a messy soup of nodes. And, as a compiler engineer, a big part of my job is looking at Turbofan graphs to either understand bugs, or to find optimization opportunities. Well, it’s not easy to do when the graph looks like this. After all, the input of a compiler is the source code, which is CFG-like (instructions all have a fixed position in a given block), and the output of the compiler is assembly, which is also CFG-like (instructions also all have a fixed position in a given block). Having a CFG-like IR thus makes it easier for compiler engineers to match elements or the IR to either the source or the generated assembly.

For comparison, here is the corresponding CFG graph (which we have available because we’ve already started the process of replacing sea of nodes with CFG):

![CFG graph for the same simple array concatenation function](/_img/leaving-the-sea-of-nodes/CFG-array-concat.png)

Among other things, with the CFG, it’s clear where the loop is, it’s clear what the exit condition of the loop is, and it’s easy to find some instructions in the CFG based on where we expect them to be: for instance `arr.length` can be found in the loop header (it’s `v22 = [v0 + 12]`), the string concatenation can be found towards the end of the loop (`v47 StringConcat(...)`).
Arguably, value use-chains are harder to follow in the CFG version, but I would argue that more often than not, it’s better to clearly see the control-flow structure of the graph rather than a soup of value nodes.

## Too many nodes are on the effect chain and/or have a control input

In order to benefit from Sea of Nodes, most nodes in the graph should float freely around, without control or effect chain. Unfortunately, that’s not really the case in the typical JavaScript graph, because almost all generic JS operations can have arbitrary side effects. They should be rare in Turbofan though, since we have [feedback](https://www.youtube.com/watch?v=u7zRSm8jzvA) that should allow to lower them to more specific operations.

Still, every memory operation needs both an effect input (since a Load should not float past Stores and vise-versa) and a control input (since there might be a type-check or bound-check before the operation). And even some pure operations like division need control inputs because they might have special cases that are protected by checks.

Let’s have a look at a concrete example, and start from the following JavaScript function:

```javascript
function foo(a, b) {
  // assuming that `a.str` and `b.str` are strings
  return a.str + b.str;
}
```

Here is the corresponding Turbofan graph. To make things clearer, I’ve highlighted part of the effect chain with dashed red lines, and annotated a few nodes with numbers so that I can discuss them below.

![Sea of Nodes graph for a simple string concatenation function](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-string-add.png)

The first observation is that almost all nodes are on the effect chain. Let’s go over a few of them, and see if they really need to be:

- `1` (`CheckedTaggedToTaggedPointer`): this checks that the 1st input of the function is a pointer and not a “small integer” (see [Pointer Compression in V8](https://v8.dev/blog/pointer-compression)). On its own, it wouldn’t really *need* an effect input, but in practice, it still needs to be on the effect chain, because it guards the following nodes.
- `2` (`CheckMaps`): now that we know that the 1st input is a pointer, this node loads its “map” (see [Maps (Hidden Classes) in V8](https://v8.dev/docs/hidden-classes)), and checks that it matches what the feedback recorded for this object.
- `3` (`LoadField`): now that we know that the 1st object is a pointer with the right map, we can load its `.str` field.
- `4`, `5` and `6` are a repeat for the second input.
- `7` (`CheckString`): now that we’ve loaded `a.str`, this node checks that it’s indeed a string.
- `8`: repeat for the second input.
- `9`: checks that the combined length of `a.str` and `b.str` is less than the maximum size of a String in V8.
- `10` (`StringConcat`): finally concatenates the 2 strings.

This graph is very typical of Turbofan graphs for JavaScript programs: checking maps, loading values, checking the maps of the loaded values, and so on, and eventually doing a few calculations on those values. And like in this example, in a lot of cases, most instructions end up being on the effect or control chain, which imposes a strict order on the operations, and completely defeats the purpose of Sea of Nodes.

## Memory operations do not float easily

Let’s consider the following JavaScript program:

```javascript
let x = arr[0];
let y = arr[1];
if (c) {
  return x;
} else {
  return y;
}
```

Given that `x` and `y` are each only used in a single side of the `if`\-`else`, we may hope that SoN would allow them to freely float down to inside the “then” and the “else” branches. However, in practice, making this happen in SoN would not be easier than in a CFG. Let’s have a look at the SoN graph to understand why:

![Sea of Nodes graph where the effect chain mirrors the control chain, leading to effectful operations not floating as freely as one may hope](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-mirror-control-effect.svg)

When we build the SoN graph, we create the effect chain as we go along, and thus the second `Load` ends up being right after the first one, after which the effect chain has to split to reach both `return`s (if you’re wondering why `return`s are even on the effect chain, it’s because there could be operations with side-effects before, such as `Store`s, which have to be executed before returning from the function). Given that the second `Load` is a predecessor to both `return`s, it has to be scheduled before the `branch`, and SoN thus doesn’t allow any of the two `Load`s to float down freely.
In order to move the `Load`s down the “then” and “else” branches, we would have to compute that there are no side effects in between them, and that there are no side effects in between the second `Load` and the `return`s, then we could split the effect chain at the beginning instead of after the second `Load`. Doing this analysis on a SoN graph or on a CFG is extremely similar.

Now that we’ve mentioned that a lot of nodes end up on the effect chain, and that effectful nodes often don’t freely float very far, it’s a good time to realize that in a way, **SoN is just CFG where pure nodes are floating**. Indeed, in practice, the control nodes and control chain always mirror the structure of the equivalent CFG. And, when both destinations of a branch have side effects (which is frequent in JavaScript), the effect chain splits and merges exactly where the control chain does (as is the case in the example above: the control chain splits on the `branch`, and the effect chain mirrors this by splitting on the `Load`; and if the program would continue after the `if`\-`else`, both chains would merge around the same place). Effectful nodes thus typically end up being constrained to be scheduled in between two control nodes, a.k.a., in a basic block. And within this basic block, the effect chain will constrain effectful nodes to be in the same order as they were in the source code. In the end, only pure nodes actually float freely.

One way to get more floating nodes is to use multiple effect chains, as mentioned earlier, but this comes at a price: first, managing a single effect chain is already hard; managing multiple ones will be much harder. Second, in a dynamic language like JavaScript, we end up with a lot of memory accesses that could alias, which means that the multiple effect chains would have to all merge very often, thus negating part of the advantages of having multiple effect chains.

## Managing the effect and control chains manually is hard

As mentioned in the previous section, while the effect and control chain are somewhat distinct, in practice, the effect chain typically has the same “shape” as the control chain: if the destinations of a branch contain effectful operations (and it’s often the case), then the effect chain will split on the branch and merge back when the control flow merges back.
Because we’re dealing with JavaScript, a lot of nodes have side effects, and we have a lot of branches (typically branching on the type of some objects), which leads to having to keep track of both the effect and control chain in parallel, whereas with a CFG, we would only have to keep track of the control chain.

History has shown that managing both the effect and control chains manually is error prone, hard to read and hard to maintain. Take this sample of code from the [JSNativeContextSpecialization](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/compiler/js-native-context-specialization.cc;l=1482;drc=22629fc9a7e45cf5e4c691db371f69f176318f11) phase:

```cpp
JSNativeContextSpecialization::ReduceNamedAccess(...) {
  Effect effect{...};
  [...]
  Node* receiverissmi_effect = effect;
  [...]
  Effect this_effect = effect;
  [...]
  this_effect = graph()->NewNode(common()->EffectPhi(2), this_effect,
                                 receiverissmi_effect, this_control);
  receiverissmi_effect = receiverissmi_control = nullptr;
  [...]
  effect = graph()->NewNode(common()->EffectPhi(control_count), ...);
  [...]
}
```

Because of the various branches and cases that have to be handled here, we end up managing 3 different effect chains. It’s easy to get it wrong and use one effect chain instead of the other. So easy that we indeed [got it wrong initially](https://crbug.com/41470351), and only [realized our mistake](https://crrev.com/c/1749902) after a few months:

![](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-effects-fix.png)

For this issue, I would place the blame on both Turbofan and Sea of Nodes, rather than only on the latter. Better helpers in Turbofan could have simplified managing the effect and control chains, but this would not have been an issue in a CFG.

## The scheduler is too complex

Eventually, all instructions must be scheduled in order to generate assembly code. The theory to schedule instructions is simple enough: each instruction should be scheduled after its value, control and effect inputs (ignoring loops).

Let’s have a look at an interesting example:

![Sea of Nodes graph for a simple switch-case](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-switch-case.svg)

You’ll notice that while the source JavaScript program has two identical divisions, the Sea of Node graph only has one. In reality, Sea of Nodes would start with two divisions, but since this is a pure operation (assuming double inputs), redundancy elimination would easily deduplicate them into one.
Then when reaching the scheduling phase, we would have to find a place to schedule this division. Clearly, it cannot go after `case 1` or `case 2`, since it’s used in the other one. Instead, it would have to be scheduled before the `switch`. The downside is that, now, `a / b` will be computed even when `c` is `3`, where it doesn’t really need to be computed. This is a real issue that can lead to many deduplicated instructions floating to the common dominator of their users, slowing down many paths that don’t need them.
There is a fix though: Turbofan’s scheduler will try to identify these cases and duplicate the instructions so that they are only computed on the paths that need them. The downside is that this makes the scheduler more complex, requiring additional logic to figure out which nodes could and should be duplicated, and how to duplicate them.
So, basically, we started with 2 divisions, then “optimized” to a single division, and then optimized further to 2 divisions again. And this doesn’t happen just for division: a lot of other operations will go through similar cycles.

## Finding a good order to visit the graph is difficult

All passes of a compiler need to visit the graph, be it to lower nodes, to apply local optimizations, or to run analysis over the whole graph. In a CFG, the order in which to visit nodes is usually straightforward: start from the first block (assuming a single-entry function), and iterate through each node of the block, and then move on to the successors and so on. In a [peephole optimization](https://en.wikipedia.org/wiki/Peephole_optimization) phase (such as [strength reduction](https://en.wikipedia.org/wiki/Strength_reduction)), a nice property of processing the graph in this order is that inputs are always optimized before a node is processed, and visiting each node exactly once is thus enough to apply most peephole optimizations. Consider for instance the following sequence of reductions:

![](/_img/leaving-the-sea-of-nodes/CFG-peepholes.svg)

In total, it took three steps to optimize the whole sequence, and each step did useful work. After which, dead code elimination would remove `v1` and `v2`, resulting in one less instruction than in the initial sequence.

With Sea of Nodes, it’s not possible to process pure instructions from start to end, since they aren’t on any control or effect chain, and thus there is no pointer to pure roots or anything like that. Instead, the usual way to process a Sea of Nodes graph for peephole optimizations is to start from the end (e.g., `return` instructions), and go up the value, effect and control inputs. This has the nice property that we won’t visit any unused instruction, but the upsides stop about there, because for peephole optimization, this is about the worst visitation order you could get. On the example above, here are the steps we would take:

- Start by visiting `v3`, but can’t lower it at this point, then move on to its inputs
    - Visit `v1`, lower it to `a << 3`, then move on to its uses, in case the lowering of `v1` enables them to be optimized.
        - Visit `v3` again, but can’t lower it yet (this time, we wouldn’t visit its inputs again though)
    - Visit `v2`, lower it to `b << 3`, then move on to its uses, in case this lowering enables them to be optimized.
        - Visit `v3` again, lower it to `(a & b) << 3`.

So, in total, `v3` was visited 3 times but only lowered once.

We measured this effect on typical JavaScript programs a while ago, and realized that, on average, nodes are changed only once every 20 visits\!

Another consequence of the difficulty to find a good visitation order of the graph is that **state tracking is hard and expensive.** A lot of optimizations require tracking some state along the graph, like Load Elimination or Escape Analysis. However, this is hard to do with Sea of Nodes, because at a given point, it’s hard to know if a given state needs to be kept alive or not, because it’s hard to figure out if unprocessed nodes would need this state to be processed.
As a consequence of this, Turbofan’s Load Elimination phase has a bailout on large graphs to avoid taking too long to finish and consuming too much memory. By comparison, we wrote a [new Load elimination phase for our new CFG compiler](https://docs.google.com/document/d/1AEl4dATNLu8GlLyUBQFXJoCxoAT5BeG7RCWxoEtIBJE/edit?usp=sharing), which we’ve benchmarked to be up to 190 times faster (it has better worst-case complexity, so this kind of speedup is easy to achieve on large graphs), while using way less memory.

## Cache unfriendliness

Almost all phases in Turbofan mutate the graph in-place. Given that nodes are fairly large in memory (mostly because each node has pointers to both its inputs and its uses), we try to reuse nodes as much as possible. However, inevitably, when we lower nodes to sequences of multiple nodes, we have to introduce new nodes, which will necessarily not be allocated close to the original node in memory. As a result, the deeper we go through the Turbofan pipeline and the more phases we run, the less cache friendly the graph is. Here is an illustration of this phenomenon:

![](/_img/leaving-the-sea-of-nodes/Sea-of-Nodes-cache-unfriendliness.svg)

It’s hard to estimate the exact impact of this cache unfriendliness on memory. Still, now that we have our new CFG compiler, we can compare the number of cache misses between the two: Sea of Nodes suffers on average from about 3 times more L1 dcache misses compared to our new CFG IR, and up to 7 times more in some phases. We estimate that this costs up to 5% of compile time, although this number is a bit handwavy. Still, keep in mind that in a JIT compiler, compiling fast is essential.

## Control-flow dependent typing is limited

Let’s consider the following JavaScript function:

```javascript
function foo(x) {
  if (x < 42) {
    return x + 1;
  }
  return x;
}
```

If so far we’ve only seen small integers for `x` and for the result of `x+1` (where “small integers” are 31-bit integers, cf. [Value tagging in V8](https://v8.dev/blog/pointer-compression#value-tagging-in-v8)), then we’ll speculate that this will remain the case. If we ever see `x` being larger than a 31-bit integer, then we will deoptimize. Similarly, if `x+1` produces a result that is larger than 31 bits, we will also deoptimize. This means that we need to check whether `x+1` is less or more than the maximum value that fits in 31 bits. Let’s have a look at corresponding the CFG and SoN graphs:

![](/_img/leaving-the-sea-of-nodes/CFG-vs-SoN-control-flow-typing.svg)


(assuming a `CheckedAdd` operation that adds its inputs and deoptimizes if the result overflows 31-bits)
With a CFG, it’s easy to realize that when `CheckedAdd(v1, 1)` is executed, `v1` is guaranteed to be less than `42`, and that there is therefore no need to check for 31-bit overflow. We would thus easily replace the `CheckedAdd` by a regular `Add`, which would execute faster, and would not require a deoptimization state (which is otherwise required to know how to resume execution after deoptimizing).
However, with a SoN graph, `CheckedAdd`, being a pure operation, will flow freely in the graph, and there is thus no way to remove the check until we’ve computed a schedule and decided that we will compute it after the branch (and at this point, we are back to a CFG, so this is not a SoN optimization anymore).

Such checked operations are frequent in V8 due to this 31-bit small integer optimization, and the ability to replace checked operations by unchecked operations can have a significant impact on quality of the code generated by Turbofan. So, Turbofan’s SoN [puts a control-input on `CheckedAdd`](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/compiler/simplified-operator.cc;l=966;drc=0a1fae9e77c6d8e85d8197b4f4396815ec9194b9), which can enable this optimization, but also means introducing a scheduling constraint on a pure node, a.k.a., going back to a CFG.

## And many other issues…

**Propagating deadness is hard.** Frequently, during some lowering, we realize that the current node is actually unreachable. In a CFG, we could just cut the current basic block here, and the following blocks would automatically become obviously unreachable since they would have no predecessors anymore. In Sea of Nodes, it’s harder, because one has to patch both the control and effect chain. So, when a node on the effect chain is dead, we have to walk forward the effect chain until the next merge, killing everything along the way, and carefully handling nodes that are on the control chain.

**It’s hard to introduce new control flow.**  Because control flow nodes have to be on the control chain, it’s not possible to introduce new control flow during regular lowerings. So, if there is a pure node in the graph, such as `Int32Max`, which returns the maximum of 2 integers, and which we would eventually like to lower to `if (x > y) { x } else { y }`, this is not easily doable in Sea of Nodes, because we would need a way to figure out where on the control chain to plug this subgraph. One way to implement this would be to put `Int32Max` on the control chain from the beginning, but this feels wasteful: the node is pure and should be allowed to move around freely. So, the canonical Sea of Nodes way to solve this, used both in Turbofan, and also by Cliff Click (Sea of Nodes’ inventor), as mentioned in this [Coffee Compiler Club](https://youtu.be/Vu372dnk2Ak?t=3037) chat, is to delay this kind of lowerings until we have a schedule (and thus a CFG). As a result, we have a phase around the middle of the pipeline that computes a schedule and lowers the graph, where a lot of random optimizations are packed together because they all require a schedule. By comparison, with a CFG, we would be free to do these optimizations earlier or later in the pipeline.
Also, remember from the introduction that one of the issues of Crankshaft (Turbofan’s predecessor) was that it was virtually impossible to introduce control flow after having built the graph. Turbofan is a slight improvement over this, since lowering of nodes on the control chain can introduce new control flow, but this is still limited.

**It’s hard to figure out what is inside of a loop.** Because a lot of nodes are floating outside of the control chain, it’s hard to figure out what is inside each loop. As a result, basic optimizations such as loop peeling and loop unrolling are hard to implement.

**Compiling is slow.** This is a direct consequence of multiple issues that I’ve already mentioned: it’s hard to find a good visitation order for nodes, which leads to many useless revisitation, state tracking is expensive, memory usage is bad, cache locality is bad… This might not be a big deal for an ahead of time compiler, but in a JIT compiler, compiling slowly means that we keep executing slow unoptimized code until the optimized code is ready, while taking away resources from other tasks (eg, other compilation jobs, or the Garbage Collector). One consequence of this is that we are forced to think very carefully about the compile time \- speedup tradeoff of new optimizations, often erring towards the side of optimizing less to keep optimizing fast.

**Sea of Nodes destroys any prior scheduling, by construction.** JavaScript source code is typically not manually optimized with CPU microarchitecture in mind. However, WebAssembly code can be, either at the source level (C++ for instance), or by an [ahead-of-time (AOT)](https://en.wikipedia.org/wiki/Ahead-of-time_compilation) compilation toolchain (like [Binaryen/Emscripten](https://github.com/WebAssembly/binaryen)). As a result, a WebAssembly code could be scheduled in a way that should be good on most architectures (for instance, reducing the need for [spilling](https://en.wikipedia.org/wiki/Register_allocation#Components_of_register_allocation), assuming 16 registers). However, SoN always discards the initial schedule, and needs to rely on its own scheduler only, which, because of the time constraints of JIT compilation, can easily be worse than what an AOT compiler (or a C++ developer carefully thinking about the scheduling of their code) could do. We have seen cases where WebAssembly was suffering from this. And, unfortunately, using a CFG compiler for WebAssembly and a SoN compiler for JavaScript in Turbofan was not an option either, since using the same compiler for both enables inlining across both languages.


# Sea of Nodes: elegant but impractical for JavaScript

So, to recapitulate, here are the main problems we have with Sea of Nodes and Turbofan:

1. It’s **too complex**. Effect and control chains are hard to understand, leading to many subtle bugs. Graphs are hard to read and analyze, making new optimizations hard to implement and refine.

2. It’s **too limited**. Too many nodes are on the effect and control chain (because we’re compiling JavaScript code), thus not providing many benefits over a traditional CFG. Additionally, because it’s hard to introduce new control-flow in lowerings, even basic optimizations end up being hard to implement.

3. Compiling is **too slow**. State-tracking is expensive, because it’s hard to find a good order in which to visit graphs. Cache locality is bad. And reaching fixpoints during reduction phases takes too long.

So, after ten years of dealing with Turbofan and battling Sea of Nodes, we’ve finally decided to get rid of it, and instead go back to a more traditional CFG IR. Our experience with our new IR has been extremely positive so far, and we are very happy to have gone back to a CFG: compile time got divided by 2 compared to SoN, the code of the compiler is a lot simpler and shorter, investigating bugs is usually much easier, etc.
Still, this post is already quite long, so I’ll stop here. Stay tuned for an upcoming blog post that will explain the design of our new CFG IR, Turboshaft.
