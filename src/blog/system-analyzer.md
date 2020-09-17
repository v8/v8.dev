---
title: 'Indicium: V8 runtime tracer tool'
author: 'Zeynep Cankara ([@zcankara](https://twitter.com/zeynepcankara))'
avatars:
  - 'zeynep-cankara'
date:
tags:
  - tools
  - system-analyzer
description: 'Indicium: V8 runtime tracer tool to analyze Map/IC events.'
---
# Indicium: V8 runtime tracer tool

Past three months have been an awesome learning experience for me as I joined the V8 team (Google London) as an intern. I have been working on V8’s system analyzer tool [*Indicium*](https://v8.dev/tools/system-analyzer).

The V8 System Analyzer tool Indicium is a unified web interface to trace, debug and analyse patterns of how Inline Caches (ICs) and Maps are created and modified in real-world applications.

V8 already has a tracing infrastructure for [ICs](https://mathiasbynens.be/notes/shapes-ics) and [Maps](https://v8.dev/blog/fast-properties) which can process and analyse IC events using the [IC Explorer](https://v8.dev/tools//ic-explorer.html) and Map events using [Map Processor](https://v8.dev/tools/map-processor.html). Previous tools didn't allow us to analyze maps and ICs holistically and it's now possible with the system analyzer Indicium.

![V8’s System Analyzer Indicium](/_img/system-analyzer/indicium-logo.png)

## Case Study

Let’s go through an example to demonstrate how we can use the tool Indicium to analyse Map and IC log events holistically in V8.

The example script demonstrates a case of function deoptimization in V8.

```javascript
class Point {
  constructor(x, y) {
    this.x = x;
    // Cause a different Map by conditionally adding properties.
    if (x < 0 || y < 0) this.isNegative = true;
    this.y = y;
  }
}

// Allocate many Points to trigger optimization of the Point constructor.
let fastPoints = [];
for (let x = 0; x < 10; x++) {
  for (let y = 0; y < 10; y++) {
    fastPoints.push(new Point(x, y));
  }
}

// Trigger the alternative path in the Point constructor to cause a different
// Map. V8 will deoptimize and throw away the existing optimizations for the
// Point constructor.
let slowPoint = new Point(-1, -1);
```

Before diving into the case study, let’s get familiar with the panels of the system analyzer tool.

![System Analyzer Overview](/_img/system-analyzer/system-analyzer-overview.png)

By examining the Source Code panel we can see that we have a marker on the call site `push` at file position line 12 column 16.

![Source Code Panel showing the IC event in line 12](/_img/system-analyzer/source-panel-case1.png)

By clicking on the marker we can see the details about the Load type IC event in the IC panel. Further examination in the IC Panel reveals that the IC event triggers a map transition; causing an IC state change from uninitialised to monomorphic. The monomorphic state indicates that the `push` property has only been loaded from a single Map.

![IC panel interacts with Map panel to display map information about the IC log event on line 12 column 12.](/_img/system-analyzer/ic-panel-case1.png)

By clicking on the highlighted Map address from the IC Panel we can see the transition trees associated with the selected map. If we click on a map on the transition tree we can see the metadata of the selected map.

![Timeline Panel the temporal information related with the selected IC log event](/_img/system-analyzer/timeline-panel-case1.png)

On the Timeline Panel we can see that the Load IC event is triggered approximately around 108 millisecond (ms) since we started tracing the file. By using the drag handlers provided by the Timeline panel interface we can analyze map/IC log events falling into the specified time range. The drag handlers help to refine time filtering and analyse nearby log events in terms of time.

```javascript
let slowPoint = new Point(-1, -1);
```

![Transition Tree of the `let slowPoint`](/_img/system-analyzer/transition-tree-slowPoint.png)

Now we create a `Point` object instance `slowPoint` where we are passing negative values through constructor arguments for `x` and  `y` properties. The negative values cause the addition of a dynamic property `isNegative` to the `slowPoint` instance.

![IC panel interacting with Map panel to display transition tree and metadata of the map after dynamically adding property `y`after property `isNegative`](/_img/system-analyzer/ic-panel-slowPoint.png)

We go look at the IC panel which shows that the IC state is now polymorphic. Then we look at the maps in the map panel to investigate why this IC is polymorphic. After looking at the Map panel, we see that the ordering of the properties has resulted in several unnecessary maps. With some background knowledge on V8 we recognize that function is deoptimized by V8.

After investigating the map transition trees we see that dynamically adding property ‘y’ after the dynamic property ‘isNegative’ is the reason behind why the IC state changes from monomorphic to polymorphic. Thus, the state change to polymorphic indicates that now we are tracking more than one Map associated with `Point` objects.

If we want to see the map transition tree visualization of the map containing `isNegative` property we can select the map from the IC panel and see more in depth information about the created map transitions.

So now the question being *how can we address the function deoptimization problem by using the insight we generated from the tool*?

The minimal solution is to always initialise the `isNegative` property. As a common advice we say that all instance properties should be initialised in the constructor.

The updated `Point` class to prevent creation of unnecessary maps could have been as follows:

```javascript
class Point {
  constructor(x, y, isNegative = false) {
    this.x = x;
    this.isNegative = isNegative;
    if (x < 0 || y < 0) this.isNegative = true;
    this.y = y;
  }
}
```

![Map panel visualising the map transition tree for modified `Point` class](/_img/system-analyzer/map-panel-opt-case.png)

If we execute the script again with the updated constructor and analyse the log file using the system analyzer tool now we can see on the Map panel that we are not creating unnecessary maps and on the IC panel we are not triggering any IC state transition from monomorphic to polymorphic.

![IC panel interacting with map panel to display when we always initialise `isNegative` property we can avoid creation of unnecessary maps.](/_img/system-analyzer/ic-panel-opt-case.png)

From the following case study we learnt that:

- We can make use of the tool System Analyzer Indicium to analyse V8 Maps and ICs holistically.
- Changing the order of dynamic property additions to the same type of JavaScript objects cause function deoptimizations.
- We can prevent function deoptimizations by dynamically adding properties to the same order for the same type of objects.
- We can verify we avoid function deoptimization by investigating the number of maps an object has.
- By looking at the IC states we can make sure we make use of the ICs in the best possible way by calling a function only with the same type of object containing the same map which allows V8 to optimise fast property access.

## Custom Panels

The custom panels do not require any build dependencies and each panel can be extended by just adding new custom elements and allowing other infrastructure tools to reuse these panels to build more complex tools to generate insights from the V8 data.
Timeline Panel
The timeline panel allows selection in time which enables visualization of IC/map states across discrete points in time or a selected range in time. It supports filtering features such as zoom in/out to the log events for selected time ranges. The number of Timeline views can easily be extended following the proposed Timeline interface.

![Timeline Panel Overview](/_img/system-analyzer/timeline-panel.png)

![Timeline Panel Overview (Cont.)](/_img/system-analyzer/timeline-panel2.png)

### Map Panel

The map panel visualizes the transition trees of selected map log events. The metadata of the selected map displayed through the map details sub-panel. A specific transition tree associated with a map address can be searched through using the provided interface. From the Stats sub-panel which is above the Map transitions sub-panel we can see the statistics about the properties causing map transitions and types of loaded map log events.

![Map Panel Overview](/_img/system-analyzer/map-panel.png)

![Stats Panel Overview](/_img/system-analyzer/stats-panel.png)

### IC Panel

The IC Panel displays statistics about IC events falling within a specific time range which are filtered through the timeline panel. Additionally, the IC Panel allows grouping IC events based on various options (type, category, map, file position...). From the grouping options, map and file position grouping option interacts with map and source code panels respectively to display the transition trees of maps and highlight the file positions associated with the IC events.

![IC Panel Overview](/_img/system-analyzer/ic-panel.png)

![IC Panel Overview (Cont.)](/_img/system-analyzer/ic-panel2.png)

![IC Panel Overview (Cont.)](/_img/system-analyzer/ic-panel3.png)

![IC Panel Overview (Cont.)](/_img/system-analyzer/ic-panel4.png)

### Source Panel

The Source Panel displays the loaded scripts with clickable markers to emit custom events which selects both Map and IC log events across the custom panels. Selection of a loaded script can be done from the drill down bar. Selecting a file position from Map panel and IC panel highlights the selected file position on the source code panel.

![Source Panel Overview](/_img/system-analyzer/source-panel.png)

## Acknowledgements

I would like to thank everyone in the V8 and Mobile Android Engineering teams, especially to my host Sathya and co-host Camillo for supporting me throughout my internship and giving me the opportunity to work on such a cool project. Also, special thanks to Mythri and Ross for providing mentorship and helping me to feel more connected with the team. I know things were different this summer but I learnt a lot this summer which made the experience really valuable to me.

I would like to thank Camillo and Sathya for proofreading this blog article.

I had an amazing summer interning at Google!
