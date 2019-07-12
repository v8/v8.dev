---
title: 'Runtime Call Stats'
---
[The DevTools Performance panel](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/) gives insights into your web app’s runtime performance by visualizing various Chrome-internal metrics. However, certain low-level V8 metrics aren’t currently exposed in DevTools. This article guides you through the most robust way of gathering detailed V8-internal metrics, known as Runtime Call Stats or RCS, through `chrome://tracing`.

Tracing records the behavior of the entire browser, including other tabs, windows, and extensions, so it works best when done in a clean user profile, with extensions disabled, and with no other browser tabs open:

```bash
# Start a new Chrome browser session with a clean user profile and extensions disabled
google-chrome --user-data-dir="$(mktemp -d)" --disable-extensions
```

Type the URL of the page you want to measure in the first tab, but do not load the page yet.

<figure>
  <img src="/_img/rcs/01.png" srcset="/_img/rcs/01@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Add a second tab and open `chrome://tracing`. Tip: you can just enter `chrome:tracing`, without the slashes.

<figure>
  <img src="/_img/rcs/02.png" srcset="/_img/rcs/02@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Click on the “Record” button to prepare recording a trace. First choose “Web developer” and then select “Edit categories”.

<figure>
  <img src="/_img/rcs/03.png" srcset="/_img/rcs/03@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Select `v8.runtime_stats` from the list. Depending on how detailed your investigation is, you may select other categories as well.

<figure>
  <img src="/_img/rcs/04.png" srcset="/_img/rcs/04@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Press “Record” and switch back to the first tab and load the page. The fastest way is to use <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>1</kbd> to directly jump to the first tab and then press <kbd>Enter</kbd> to accept the entered URL.

<figure>
  <img src="/_img/rcs/05.png" srcset="/_img/rcs/05@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Wait until your page has completed loading or the buffer is full, then “Stop” the recording.

<figure>
  <img src="/_img/rcs/06.png" srcset="/_img/rcs/06@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Look for a “Renderer” section that contains the web page title from the recorded tab. The easiest way to do this is by clicking “Processes”, then clicking “None” to uncheck all entries, and then selecting only the renderer you’re interested in.

<figure>
  <img src="/_img/rcs/07.png" srcset="/_img/rcs/07@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Select the trace events/slices by pressing <kbd>Shift</kbd> and dragging. Make sure you cover _all_ the sections, including `CrRendererMain` and any `ThreadPoolForegroundWorker`s. A table with all the selected slices appears at the bottom.

<figure>
  <img src="/_img/rcs/08.png" srcset="/_img/rcs/08@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

Scroll to the top right of the table and click on the link next to “Runtime call stats table”.

<figure>
  <img src="/_img/rcs/09.png" srcset="/_img/rcs/09@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

In the view that appears, scroll to the bottom to see a detailed table of where V8 spends its time.

<figure>
  <img src="/_img/rcs/10.png" srcset="/_img/rcs/10@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

By flipping open a category you can further drill down into the data.

<figure>
  <img src="/_img/rcs/11.png" srcset="/_img/rcs/11@2x.png 2x" intrinsicsize="809x545" alt="">
</figure>

## Command-line interface { #cli }

Run [`d8`](/docs/d8) with `--runtime-call-stats` to get RCS metrics from the command-line:

```bash
d8 --runtime-call-stats foo.js
```
