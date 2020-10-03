---
title: 'Slack tracking in V8'
author: 'Michael Stanton ([@alpencoder](https://twitter.com/alpencoder)), renowned master of *slack*'
description: 'A detailed look into the V8 slack tracking mechanism.'
avatars:
 - 'michael-stanton'
date: 2020-09-24 14:00:00
tags:
 - internals
---
Slack tracking is a way to give new objects an initial size that is **larger than what they may actually use**, so they can have new properties added quickly. And then, after some period of time, to **magically return that unused space to the system**. Neat, huh?

It’s especially useful because JavaScript doesn’t have static classes. The system can never see “at a glance” how many properties you have. The engine experiences them one by one. So when you read:

```js
function Peak(name, height) {
  this.name = name;
  this.height = height;
}

const m1 = new Peak('Matterhorn', 4478);
```

You might think the engine has all it needs to perform well — you’ve told it the object has two properties, after all. However, V8 really has no idea what will come next. This object `m1` could be passed to another function that adds 10 more properties to it. Slack tracking comes out of this need to be responsive to whatever comes next in an environment without static compilation to infer overall structure. It’s like many other mechanisms in V8, whose basis is only things you can generally say about execution, like:

- Most objects die soon, few live long — the garbage collection “generational hypothesis”.
- The program does indeed have an organizational structure — we build [shapes or “hidden classes”](https://mathiasbynens.be/notes/shapes-ics) (we call these **maps** in V8) into the objects we see the programmer uses because we believe they will be useful. *BTW, [Fast Properties in V8](/blog/fast-properties) is a great post with interesting details about maps and property access.*
- Programs have an initialization state, when everything is new and it’s hard to tell what’s important. Later, the important classes and functions can be identified through their steady use — our feedback regime and compiler pipeline grow out of this idea.

Finally, and most importantly, the runtime environment must be very fast, otherwise we’re just philosophizing.

Now, V8 could simply store properties in a backing store attached to the main object. Unlike properties that live directly in the object, this backing store can grow indefinitely through copying and replacing the pointer. However the fastest access to a property comes by avoiding that indirection and looking at a fixed offset from the start of the object. Below, I show the layout of a plain ol’ JavaScript object in the V8 heap with two in-object properties. The first three words are standard in every object (a pointer to the map, to the properties backing store, and to the elements backing store). You can see that the object can’t “grow” because it’s hard up against the next object in the heap:

![](/_img/slack-tracking/property-layout.svg)

:::note
**Note:** I left out the details of the property backing store because the only thing important about it for the moment is that it can be replaced at any time with a larger one. However, it too is an object on the V8 heap and has a map pointer like all objects that reside there.
:::

So anyway, because of the performance provided by in-object properties, V8 is willing to give you extra space in each object, and **slack tracking** is the way it’s done. Eventually, you’ll settle down, stop adding new properties, and get down to the business of mining bitcoin or whatever.

How much “time” does V8 give you? Cleverly, it considers the number of times you’ve constructed a particular object. In fact, there is a counter in the map, and it’s initialized with one of the more mystical magic numbers in the system: **seven**.

Another question: how does V8 know how much extra space in the object body to provide? It actually gets a hint from the compilation process, which offers an estimated number of properties to start with. This calculation includes the number of properties from the prototype object, going up the chain of prototypes recursively. Finally, for good measure it adds **eight** more (another magic number!). You can see this in `JSFunction::CalculateExpectedNofProperties()`:

```cpp
int JSFunction::CalculateExpectedNofProperties(Isolate* isolate,
                                               Handle<JSFunction> function) {
  int expected_nof_properties = 0;
  for (PrototypeIterator iter(isolate, function, kStartAtReceiver);
       !iter.IsAtEnd(); iter.Advance()) {
    Handle<JSReceiver> current =
        PrototypeIterator::GetCurrent<JSReceiver>(iter);
    if (!current->IsJSFunction()) break;
    Handle<JSFunction> func = Handle<JSFunction>::cast(current);

    // The super constructor should be compiled for the number of expected
    // properties to be available.
    Handle<SharedFunctionInfo> shared(func->shared(), isolate);
    IsCompiledScope is_compiled_scope(shared->is_compiled_scope(isolate));
    if (is_compiled_scope.is_compiled() ||
        Compiler::Compile(func, Compiler::CLEAR_EXCEPTION,
                          &is_compiled_scope)) {
      DCHECK(shared->is_compiled());
      int count = shared->expected_nof_properties();
      // Check that the estimate is sensible.
      if (expected_nof_properties <= JSObject::kMaxInObjectProperties - count) {
        expected_nof_properties += count;
      } else {
        return JSObject::kMaxInObjectProperties;
      }
    } else {
      // In case there was a compilation error proceed iterating in case there
      // will be a builtin function in the prototype chain that requires
      // certain number of in-object properties.
      continue;
    }
  }
  // In-object slack tracking will reclaim redundant inobject space
  // later, so we can afford to adjust the estimate generously,
  // meaning we over-allocate by at least 8 slots in the beginning.
  if (expected_nof_properties > 0) {
    expected_nof_properties += 8;
    if (expected_nof_properties > JSObject::kMaxInObjectProperties) {
      expected_nof_properties = JSObject::kMaxInObjectProperties;
    }
  }
  return expected_nof_properties;
}
```

Let’s have a look at our object `m1` from before:

```js
function Peak(name, height) {
  this.name = name;
  this.height = height;
}

const m1 = new Peak('Matterhorn', 4478);
```

By the calculation in `JSFunction::CalculateExpectedNofProperties` and our `Peak()` function, we should have 2 in-object properties, and thanks to slack tracking, another 8 extra. We can print `m1` with `%DebugPrint()` (_this handy function exposes the map structure. You can use it by running `d8` with the flag `--allow-natives-syntax`_):

```
> %DebugPrint(m1);
DebugPrint: 0x49fc866d: [JS_OBJECT_TYPE]
 - map: 0x58647385 <Map(HOLEY_ELEMENTS)> [FastProperties]
 - prototype: 0x49fc85e9 <Object map = 0x58647335>
 - elements: 0x28c821a1 <FixedArray[0]> [HOLEY_ELEMENTS]
 - properties: 0x28c821a1 <FixedArray[0]> {
    0x28c846f9: [String] in ReadOnlySpace: #name: 0x5e412439 <String[10]: #Matterhorn> (const data field 0)
    0x5e412415: [String] in OldSpace: #height: 4478 (const data field 1)
 }
  0x58647385: [Map]
 - type: JS_OBJECT_TYPE
 - instance size: 52
 - inobject properties: 10
 - elements kind: HOLEY_ELEMENTS
 - unused property fields: 8
 - enum length: invalid
 - stable_map
 - back pointer: 0x5864735d <Map(HOLEY_ELEMENTS)>
 - prototype_validity cell: 0x5e4126fd <Cell value= 0>
 - instance descriptors (own) #2: 0x49fc8701 <DescriptorArray[2]>
 - prototype: 0x49fc85e9 <Object map = 0x58647335>
 - constructor: 0x5e4125ed <JSFunction Peak (sfi = 0x5e4124dd)>
 - dependent code: 0x28c8212d <Other heap object (WEAK_FIXED_ARRAY_TYPE)>
 - construction counter: 6
```

Note the instance size of the object is 52. Object layout in V8 is like so:

| word | what                                                 |
| ---- | ---------------------------------------------------- |
| 0    | the map                                              |
| 1    | pointer to the properties array                      |
| 2    | pointer to the elements array                        |
| 3    | in-object field 1 (pointer to string `"Matterhorn"`) |
| 4    | in-object field 2 (integer value `4478`)             |
| 5    | unused in-object field 3                             |
| …    | …                                                    |
| 12   | unused in-object field 10                            |

Pointer size is 4 in this 32-bit binary, so we’ve got those 3 initial words that every ordinary JavaScript object has, and then 10 extra words in the object. It tells us above, helpfully, that there are 8 “unused property fields”. So, we are experiencing slack tracking. Our objects are bloated, greedy consumers of precious bytes!

How do we slim down? We use the construction counter field in the map. We reach zero and then decide we are done with slack tracking. However, if you construct more objects, you won’t see the counter above decreasing. Why?

Well, it’s because the map displayed above is not “the” map for a `Peak` object. It’s only a leaf map in a chain of maps descending from the **initial map** that the `Peak` object is given before executing the constructor code.

How to find the initial map? Happily, the function `Peak()` has a pointer to it. It’s the construction counter in the initial map that we use to control slack tracking:

```
> %DebugPrint(Peak);
d8> %DebugPrint(Peak)
DebugPrint: 0x31c12561: [Function] in OldSpace
 - map: 0x2a2821f5 <Map(HOLEY_ELEMENTS)> [FastProperties]
 - prototype: 0x31c034b5 <JSFunction (sfi = 0x36108421)>
 - elements: 0x28c821a1 <FixedArray[0]> [HOLEY_ELEMENTS]
 - function prototype: 0x37449c89 <Object map = 0x2a287335>
 - initial_map: 0x46f07295 <Map(HOLEY_ELEMENTS)>   // Here's the initial map.
 - shared_info: 0x31c12495 <SharedFunctionInfo Peak>
 - name: 0x31c12405 <String[4]: #Peak>
…

d8> // %DebugPrintPtr allows you to print the initial map.
d8> %DebugPrintPtr(0x46f07295)
DebugPrint: 0x46f07295: [Map]
 - type: JS_OBJECT_TYPE
 - instance size: 52
 - inobject properties: 10
 - elements kind: HOLEY_ELEMENTS
 - unused property fields: 10
 - enum length: invalid
 - back pointer: 0x28c02329 <undefined>
 - prototype_validity cell: 0x47f0232d <Cell value= 1>
 - instance descriptors (own) #0: 0x28c02135 <DescriptorArray[0]>
 - transitions #1: 0x46f0735d <Map(HOLEY_ELEMENTS)>
     0x28c046f9: [String] in ReadOnlySpace: #name:
         (transition to (const data field, attrs: [WEC]) @ Any) ->
             0x46f0735d <Map(HOLEY_ELEMENTS)>
 - prototype: 0x5cc09c7d <Object map = 0x46f07335>
 - constructor: 0x21e92561 <JSFunction Peak (sfi = 0x21e92495)>
 - dependent code: 0x28c0212d <Other heap object (WEAK_FIXED_ARRAY_TYPE)>
 - construction counter: 5
```

See how the construction counter is decremented to 5? If you’d like to find the initial map from the two-property map we showed above, you can follow its back pointer with the help of `%DebugPrintPtr()` until you reach a map with `undefined` in the back pointer slot. That will be this map above.

Now, a map tree grows from the initial map, with a branch for each property added from that point. We call these branches _transitions_. In the above printout of the initial map, do you see the transition to the next map with the label “name”? The whole map tree thus far looks like this:

![(X, Y, Z) means (instance size, number of in-object properties, number of unused properties).](/_img/slack-tracking/root-map-1.svg)

These transitions based on property names are how the [“blind mole”](https://www.google.com/search?q=blind+mole&tbm=isch)" of JavaScript builds its maps behind you. This initial map is also stored in the function `Peak`, so when it’s used as a constructor, that map can be used to set up the `this` object.

```js
const m1 = new Peak('Matterhorn', 4478);
const m2 = new Peak('Mont Blanc', 4810);
const m3 = new Peak('Zinalrothorn', 4221);
const m4 = new Peak('Wendelstein', 1838);
const m5 = new Peak('Zugspitze', 2962);
const m6 = new Peak('Watzmann', 2713);
const m7 = new Peak('Eiger', 3970);
```

The cool thing here is that after creating `m7`, running `%DebugPrint(m1)` again produces a marvellous new result:

```
DebugPrint: 0x5cd08751: [JS_OBJECT_TYPE]
 - map: 0x4b387385 <Map(HOLEY_ELEMENTS)> [FastProperties]
 - prototype: 0x5cd086cd <Object map = 0x4b387335>
 - elements: 0x586421a1 <FixedArray[0]> [HOLEY_ELEMENTS]
 - properties: 0x586421a1 <FixedArray[0]> {
    0x586446f9: [String] in ReadOnlySpace: #name:
        0x51112439 <String[10]: #Matterhorn> (const data field 0)
    0x51112415: [String] in OldSpace: #height:
        4478 (const data field 1)
 }
0x4b387385: [Map]
 - type: JS_OBJECT_TYPE
 - instance size: 20
 - inobject properties: 2
 - elements kind: HOLEY_ELEMENTS
 - unused property fields: 0
 - enum length: invalid
 - stable_map
 - back pointer: 0x4b38735d <Map(HOLEY_ELEMENTS)>
 - prototype_validity cell: 0x511128dd <Cell value= 0>
 - instance descriptors (own) #2: 0x5cd087e5 <DescriptorArray[2]>
 - prototype: 0x5cd086cd <Object map = 0x4b387335>
 - constructor: 0x511127cd <JSFunction Peak (sfi = 0x511125f5)>
 - dependent code: 0x5864212d <Other heap object (WEAK_FIXED_ARRAY_TYPE)>
 - construction counter: 0
```

Our instance size is now 20, which is 5 words:

| word | what                            |
| ---- | ------------------------------- |
| 0    | the map                         |
| 1    | pointer to the properties array |
| 2    | pointer to the elements array   |
| 3    | name                            |
| 4    | height                          |

You’ll wonder how this happened. After all, if this object is laid out in memory, and used to have 10 properties, how can the system tolerate these 8 words laying around with no one to own them? It’s true that we never filled them with anything interesting — maybe that can help us.

If you wonder why I’m worried about leaving these words laying around, there is some background you need to know about the garbage collector. Objects are laid out one after the other, and the V8 garbage collector keeps track of things in that memory by walking over it again and again. Starting at the first word in memory, it expects to find a pointer to a map. It reads the instance size from the map and then knows how far to step forward to the next valid object. For some classes it has to additionally compute a length, but that’s all there is to it.

![](/_img/slack-tracking/gc-heap-1.svg)

In the diagram above, the red boxes are the **maps**, and the white boxes the words that fill out the instance size of the object. The garbage collector can “walk” the heap by hopping from map to map.

So what happens if the map suddenly changes it’s instance size? Now when the GC (garbage collector) walks the heap it will find itself looking at a word that it didn’t see before. In the case of our `Peak` class, we change from taking up 13 words to only 5 (I colored the “unused property” words yellow):

![](/_img/slack-tracking/gc-heap-2.svg)

![](/_img/slack-tracking/gc-heap-3.svg)

We can deal with this if we cleverly initialize those unused properties with a **“filler” map of instance size 4**. This way, the GC will lightly walk over them once they are exposed to the traversal.

![](/_img/slack-tracking/gc-heap-4.svg)

This is expressed in the code in `Factory::InitializeJSObjectBody()`:

```cpp
void Factory::InitializeJSObjectBody(Handle<JSObject> obj, Handle<Map> map,
                                     int start_offset) {

  // <lines removed>

  bool in_progress = map->IsInobjectSlackTrackingInProgress();
  Object filler;
  if (in_progress) {
    filler = *one_pointer_filler_map();
  } else {
    filler = *undefined_value();
  }
  obj->InitializeBody(*map, start_offset, *undefined_value(), filler);
  if (in_progress) {
    map->FindRootMap(isolate()).InobjectSlackTrackingStep(isolate());
  }

  // <lines removed>
}
```

And so this is slack tracking in action. For each class you create, you can expect it to take up more memory for a while, but on the 7th instantiation we “call it good” and expose the leftover space for the GC to see. These one-word objects have no owners — that is, nobody points to them — so when a collection occurs they are freed up and living objects may be compacted to save space.

The diagram below reflects that slack tracking is **finished** for this initial map. Note that the instance size is now 20 (5 words: the map, the properties and elements arrays, and 2 more slots). Slack tracking respects the whole chain from the initial map. That is, if a descendent of the initial map ends up using all 10 of those initial extra properties, then the initial map keeps them, marking them as unused:

![(X, Y, Z) means (instance size, number of in-object properties, number of unused properties).](/_img/slack-tracking/root-map-2.svg)

Now that slack tracking is finished, what happens if we add another property to one of these `Peak` objects?

```js
m1.country = 'Switzerland';
```

V8 has to go into the properties backing store. We end up with the following object layout:

| word | value                                 |
| ---- | ------------------------------------- |
| 0    | map                                   |
| 1    | pointer to a properties backing store |
| 2    | pointer to elements (empty array)     |
| 3    | pointer to string `"Matterhorn"`      |
| 4    | `4478`                                |

The properties backing store then looks like this:

| word | value                             |
| ---- | --------------------------------- |
| 0    | map                               |
| 1    | length (3)                        |
| 2    | pointer to string `"Switzerland"` |
| 3    | `undefined`                       |
| 4    | `undefined`                       |
| 5    | `undefined`                       |

We have those extra `undefined` values there in case you decide to add more properties. We kind of think you might, based on your behavior so far!

## Optional properties

It may happen that you add properties in some cases only. Suppose if height is 4000 meters or more, you want to keep track of two additional properties, `prominence` and `isClimbed`:

```js
function Peak(name, height, prominence, isClimbed) {
  this.name = name;
  this.height = height;
  if (height >= 4000) {
    this.prominence = prominence;
    this.isClimbed = isClimbed;
  }
}
```

You add a few of these different variants:

```js
const m1 = new Peak('Wendelstein', 1838);
const m2 = new Peak('Matterhorn', 4478, 1040, true);
const m3 = new Peak('Zugspitze', 2962);
const m4 = new Peak('Mont Blanc', 4810, 4695, true);
const m5 = new Peak('Watzmann', 2713);
const m6 = new Peak('Zinalrothorn', 4221, 490, true);
const m7 = new Peak('Eiger', 3970);
```

In this case, objects `m1`, `m3`, `m5`, and `m7` have one map, and objects `m2`, `m4`, and `m6` have a map further down the chain of descendents from the initial map because of the additional properties. When slack tracking is finished for this map family, there are **4** in-object properties instead of **2** like before, because slack tracking makes sure to keep sufficient room for the maximum number of in-object properties used by any descendents in the tree of maps below the initial map.

Below shows the map family after running the code above, and of course, slack tracking is complete:

![(X, Y, Z) means (instance size, number of in-object properties, number of unused properties).](/_img/slack-tracking/root-map-3.svg)

## How about optimized code?

Let’s compile some optimized code before slack tracking is finished. We’ll use a couple native syntax commands to force a optimized compile to happen before we finished slack tracking:

```js
function foo(a1, a2, a3, a4) {
  return new Peak(a1, a2, a3, a4);
}

%PrepareFunctionForOptimization(foo);
const m1 = foo('Wendelstein', 1838);
const m2 = foo('Matterhorn', 4478, 1040, true);
%OptimizeFunctionOnNextCall(foo);
foo('Zugspitze', 2962);
```

That should be enough to compile and run optimized code. We do something in TurboFan (the optimizing compiler) called [**Create Lowering**](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/compiler/js-create-lowering.h;l=32;drc=ee9e7e404e5a3f75a3ca0489aaf80490f625ca27), where we inline the allocation of objects. That means the native code we produce emits instructions to ask the GC for the instance size of the object to allocate and then carefully initialize those fields. However, this code would be invalid if slack tracking were to stop at some later point. What can we do about that?

Easy-peasy! We just end slack tracking early for this map family. This makes sense because normally — we wouldn’t compile an optimized function until thousands of objects have been created. So slack tracking *should* be finished. If it’s not, too bad! The object must not be that important anyway if fewer than 7 of them have been created by this point. (Normally, remember, we are only optimizing after the program ran for a long time.)

### Compiling on a background thread

We can compile optimized code on the main thread, in which case we can get away with prematurely ending slack tracking with some calls to change the initial map because the world has been stopped. However, we do as much compilation as possible on a background thread. From this thread it would be dangerous to touch the initial map because it *might be changing on the main thread where JavaScript is running.* So our technique goes like this:

1. **Guess** that the instance size will be what it would be if you did stop slack tracking right now. Remember this size.
1. When the compilation is almost done, we return to the main thread where we can safely force completion of slack tracking if it wasn’t already done.
1. Check: is the instance size what we predicted? If so, **we are good!** If not, throw away the code object and try again later.

If you’d like to see this in code, have a look at the class [`InitialMapInstanceSizePredictionDependency`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/compiler/compilation-dependencies.cc?q=InitialMapInstanceSizePredictionDependency&ss=chromium%2Fchromium%2Fsrc) and how it’s used in `js-create-lowering.cc` to create inline allocations. You’ll see that the `PrepareInstall()` method is called on the main thread, which forces completion of slack tracking. Then method `Install()` checks if our guess on the instance size held up.

Here is the optimized code with the inlined allocation. First you see communication with the GC, checking to see if we can just bump a pointer forward by the instance size and take that (this is called bump-pointer allocation). Then, we start filling in fields of the new object:

```asm
…
43  mov ecx,[ebx+0x5dfa4]
49  lea edi,[ecx+0x1c]
4c  cmp [ebx+0x5dfa8],edi       ;; hey GC, can we have 28 (0x1c) bytes please?
52  jna 0x36ec4a5a  <+0x11a>

58  lea edi,[ecx+0x1c]
5b  mov [ebx+0x5dfa4],edi       ;; okay GC, we took it. KThxbye.
61  add ecx,0x1                 ;; hells yes. ecx is my new object.
64  mov edi,0x46647295          ;; object: 0x46647295 <Map(HOLEY_ELEMENTS)>
69  mov [ecx-0x1],edi           ;; Store the INITIAL MAP.
6c  mov edi,0x56f821a1          ;; object: 0x56f821a1 <FixedArray[0]>
71  mov [ecx+0x3],edi           ;; Store the PROPERTIES backing store (empty)
74  mov [ecx+0x7],edi           ;; Store the ELEMENTS backing store (empty)
77  mov edi,0x56f82329          ;; object: 0x56f82329 <undefined>
7c  mov [ecx+0xb],edi           ;; in-object property 1 <-- undefined
7f  mov [ecx+0xf],edi           ;; in-object property 2 <-- undefined
82  mov [ecx+0x13],edi          ;; in-object property 3 <-- undefined
85  mov [ecx+0x17],edi          ;; in-object property 4 <-- undefined
88  mov edi,[ebp+0xc]           ;; retrieve argument {a1}
8b  test_w edi,0x1
90  jz 0x36ec4a6d  <+0x12d>
96  mov eax,0x4664735d          ;; object: 0x4664735d <Map(HOLEY_ELEMENTS)>
9b  mov [ecx-0x1],eax           ;; push the map forward
9e  mov [ecx+0xb],edi           ;; name = {a1}
a1  mov eax,[ebp+0x10]          ;; retrieve argument {a2}
a4  test al,0x1
a6  jnz 0x36ec4a77  <+0x137>
ac  mov edx,0x46647385          ;; object: 0x46647385 <Map(HOLEY_ELEMENTS)>
b1  mov [ecx-0x1],edx           ;; push the map forward
b4  mov [ecx+0xf],eax           ;; height = {a2}
b7  cmp eax,0x1f40              ;; is height >= 4000?
bc  jng 0x36ec4a32  <+0xf2>
                  -- B8 start --
                  -- B9 start --
c2  mov edx,[ebp+0x14]          ;; retrieve argument {a3}
c5  test_b dl,0x1
c8  jnz 0x36ec4a81  <+0x141>
ce  mov esi,0x466473ad          ;; object: 0x466473ad <Map(HOLEY_ELEMENTS)>
d3  mov [ecx-0x1],esi           ;; push the map forward
d6  mov [ecx+0x13],edx          ;; prominence = {a3}
d9  mov esi,[ebp+0x18]          ;; retrieve argument {a4}
dc  test_w esi,0x1
e1  jz 0x36ec4a8b  <+0x14b>
e7  mov edi,0x466473d5          ;; object: 0x466473d5 <Map(HOLEY_ELEMENTS)>
ec  mov [ecx-0x1],edi           ;; push the map forward to the leaf map
ef  mov [ecx+0x17],esi          ;; isClimbed = {a4}
                  -- B10 start (deconstruct frame) --
f2  mov eax,ecx                 ;; get ready to return this great Peak object!
…
```

BTW, to see all this you should have a debug build and pass a few flags. I put the code into a file and called:

```bash
./d8 --allow-natives-syntax --trace-opt --code-comments --print-opt-code mycode.js
```

I hope this has been a fun exploration. I’d like to say a very special thanks to Igor Sheludko and Maya Armyanova for (patiently!) reviewing this post.
