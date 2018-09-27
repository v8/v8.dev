// Copyright 2018 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the “License”);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// <https://apache.org/licenses/LICENSE-2.0>.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an “AS IS” BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const oldToNew = new Map([
  ['https://v8project.blogspot.com/2018/09/dataview.html', 'https://v8.dev/blog/dataview'],
  ['https://v8project.blogspot.com/2018/09/10-years.html', 'https://v8.dev/blog/10-years'],
  ['https://v8project.blogspot.com/2018/08/liftoff.html', 'https://v8.dev/blog/liftoff'],
  ['https://v8project.blogspot.com/2018/08/embedded-builtins.html', 'https://v8.dev/blog/embedded-builtins'],
  ['https://v8project.blogspot.com/2018/08/v8-release-69.html', 'https://v8.dev/blog/v8-release-69'],
  ['https://v8project.blogspot.com/2018/06/v8-release-68.html', 'https://v8.dev/blog/v8-release-68'],
  ['https://v8project.blogspot.com/2018/06/concurrent-marking.html', 'https://v8.dev/blog/concurrent-marking'],
  ['https://v8project.blogspot.com/2018/05/v8-release-v67.html', 'https://v8.dev/blog/v8-release-67'],
  ['https://v8project.blogspot.com/2018/05/bigint.html', 'https://v8.dev/blog/bigint'],
  ['https://v8project.blogspot.com/2018/04/improved-code-caching.html', 'https://v8.dev/blog/improved-code-caching'],
  ['https://v8project.blogspot.com/2018/03/v8-release-66.html', 'https://v8.dev/blog/v8-release-66'],
  ['https://v8project.blogspot.com/2018/03/background-compilation.html', 'https://v8.dev/blog/background-compilation'],
  ['https://v8project.blogspot.com/2018/03/tracing-js-dom.html', 'https://v8.dev/blog/tracing-js-dom'],
  ['https://v8project.blogspot.com/2018/02/lazy-deserialization.html', 'https://v8.dev/blog/lazy-deserialization'],
  ['https://v8project.blogspot.com/2018/02/v8-release-65.html', 'https://v8.dev/blog/v8-release-65'],
  ['https://v8project.blogspot.com/2018/01/hash-code.html', 'https://v8.dev/blog/hash-code'],
  ['https://v8project.blogspot.com/2018/01/speedometer-2.html', 'https://v8.dev/blog/speedometer-2'],
  ['https://v8project.blogspot.com/2017/12/v8-release-64.html', 'https://v8.dev/blog/v8-release-64'],
  ['https://v8project.blogspot.com/2017/12/javascript-code-coverage.html', 'https://v8.dev/blog/javascript-code-coverage'],
  ['https://v8project.blogspot.com/2017/11/orinoco-parallel-scavenger.html', 'https://v8.dev/blog/orinoco-parallel-scavenger'],
  ['https://v8project.blogspot.com/2017/11/csa.html', 'https://v8.dev/blog/csa'],
  ['https://v8project.blogspot.com/2017/11/web-tooling-benchmark.html', 'https://v8.dev/blog/web-tooling-benchmark'],
  ['https://v8project.blogspot.com/2017/10/v8-release-63.html', 'https://v8.dev/blog/v8-release-63'],
  ['https://v8project.blogspot.com/2017/10/optimizing-proxies.html', 'https://v8.dev/blog/optimizing-proxies'],
  ['https://v8project.blogspot.com/2017/10/lazy-unlinking.html', 'https://v8.dev/blog/lazy-unlinking'],
  ['https://v8project.blogspot.com/2017/09/disabling-escape-analysis.html', 'https://v8.dev/blog/disabling-escape-analysis'],
  ['https://v8project.blogspot.com/2017/09/elements-kinds-in-v8.html', 'https://v8.dev/blog/elements-kinds'],
  ['https://v8project.blogspot.com/2017/09/v8-release-62.html', 'https://v8.dev/blog/v8-release-62'],
  ['https://v8project.blogspot.com/2017/08/fast-properties.html', 'https://v8.dev/blog/fast-properties'],
  ['https://v8project.blogspot.com/2017/08/about-that-hash-flooding-vulnerability.html', 'https://v8.dev/blog/hash-flooding'],
  ['https://v8project.blogspot.com/2017/08/v8-release-61.html', 'https://v8.dev/blog/v8-release-61'],
  ['https://v8project.blogspot.com/2017/07/upcoming-regexp-features.html', 'https://developers.google.com/web/updates/2017/07/upcoming-regexp-features'],
  ['https://v8project.blogspot.com/2017/06/v8-release-60.html', 'https://v8.dev/blog/v8-release-60'],
  ['https://v8project.blogspot.com/2017/05/launching-ignition-and-turbofan.html', 'https://v8.dev/blog/launching-ignition-and-turbofan'],
  ['https://v8project.blogspot.com/2017/05/energizing-atom-with-v8s-custom-start.html', 'https://v8.dev/blog/custom-startup-snapshots'],
  ['https://v8project.blogspot.com/2017/04/v8-release-59.html', 'https://v8.dev/blog/v8-release-59'],
  ['https://v8project.blogspot.com/2017/04/retiring-octane.html', 'https://v8.dev/blog/retiring-octane'],
  ['https://v8project.blogspot.com/2017/03/v8-release-58.html', 'https://v8.dev/blog/v8-release-58'],
  ['https://v8project.blogspot.com/2017/03/fast-for-in-in-v8.html', 'https://v8.dev/blog/fast-for-in'],
  ['https://v8project.blogspot.com/2017/02/high-performance-es2015-and-beyond.html', 'https://v8.dev/blog/high-performance-es2015'],
  ['https://v8project.blogspot.com/2017/02/help-us-test-future-of-v8.html', 'https://v8.dev/blog/test-the-future'],
  ['https://v8project.blogspot.com/2017/02/one-small-step-for-chrome-one-giant.html', 'https://v8.dev/blog/heap-size-limit'],
  ['https://v8project.blogspot.com/2017/02/v8-release-57.html', 'https://v8.dev/blog/v8-release-57'],
  ['https://v8project.blogspot.com/2017/01/speeding-up-v8-regular-expressions.html', 'https://v8.dev/blog/speeding-up-regular-expressions'],
  ['https://v8project.blogspot.com/2016/12/how-v8-measures-real-world-performance.html', 'https://v8.dev/blog/real-world-performance'],
  ['https://v8project.blogspot.com/2016/12/v8-nodejs.html', 'https://v8.dev/blog/v8-nodejs'],
  ['https://v8project.blogspot.com/2016/12/v8-release-56.html', 'https://v8.dev/blog/v8-release-56'],
  ['https://v8project.blogspot.com/2016/10/webassembly-browser-preview.html', 'https://v8.dev/blog/webassembly-browser-preview'],
  ['https://v8project.blogspot.com/2016/10/v8-release-55.html', 'https://v8.dev/blog/v8-release-55'],
  ['https://v8project.blogspot.com/2016/10/fall-cleaning-optimizing-v8-memory.html', 'https://v8.dev/blog/optimizing-v8-memory'],
  ['https://v8project.blogspot.com/2016/09/v8-release-54.html', 'https://v8.dev/blog/v8-release-54'],
  ['https://v8project.blogspot.com/2016/08/firing-up-ignition-interpreter.html', 'https://v8.dev/blog/ignition-interpreter'],
  ['https://v8project.blogspot.com/2016/07/v8-at-blinkon-6-conference.html', 'https://v8.dev/blog/blinkon-6'],
  ['https://v8project.blogspot.com/2016/07/v8-release-53.html', 'https://v8.dev/blog/v8-release-53'],
  ['https://v8project.blogspot.com/2016/06/release-52.html', 'https://v8.dev/blog/release-52'],
  ['https://v8project.blogspot.com/2016/04/es6-es7-and-beyond.html', 'https://v8.dev/blog/modern-javascript'],
  ['https://v8project.blogspot.com/2016/04/v8-release-51.html', 'https://v8.dev/blog/v8-release-51'],
  ['https://v8project.blogspot.com/2016/04/jank-busters-part-two-orinoco.html', 'https://v8.dev/blog/orinoco'],
  ['https://v8project.blogspot.com/2016/03/experimental-support-for-webassembly.html', 'https://v8.dev/blog/webassembly-experimental'],
  ['https://v8project.blogspot.com/2016/03/v8-release-50.html', 'https://v8.dev/blog/v8-release-50'],
  ['https://v8project.blogspot.com/2016/02/regexp-lookbehind-assertions.html', 'https://v8.dev/blog/regexp-lookbehind-assertions'],
  ['https://v8project.blogspot.com/2016/02/v8-extras.html', 'https://v8.dev/blog/v8-extras'],
  ['https://v8project.blogspot.com/2016/01/v8-release-49.html', 'https://v8.dev/blog/v8-release-49'],
  ['https://v8project.blogspot.com/2015/12/theres-mathrandom-and-then-theres.html', 'https://v8.dev/blog/math-random'],
  ['https://v8project.blogspot.com/2015/11/v8-release-48.html', 'https://v8.dev/blog/v8-release-48'],
  ['https://v8project.blogspot.com/2015/10/jank-busters-part-one.html', 'https://v8.dev/blog/jank-busters'],
  ['https://v8project.blogspot.com/2015/10/v8-release-47.html', 'https://v8.dev/blog/v8-release-47'],
  ['https://v8project.blogspot.com/2015/09/custom-startup-snapshots.html', 'https://v8.dev/blog/custom-startup-snapshots'],
  ['https://v8project.blogspot.com/2015/08/v8-release-46.html', 'https://v8.dev/blog/v8-release-46'],
  ['https://v8project.blogspot.com/2015/08/getting-garbage-collection-for-free.html', 'https://v8.dev/blog/free-garbage-collection'],
  ['https://v8project.blogspot.com/2015/07/code-caching.html', 'https://v8.dev/blog/code-caching'],
  ['https://v8project.blogspot.com/2015/07/v8-45-release.html', 'https://v8.dev/blog/v8-release-45'],
  ['https://v8project.blogspot.com/2015/07/digging-into-turbofan-jit.html', 'https://v8.dev/blog/turbofan-jit'],
  ['https://v8project.blogspot.com/2015/07/hello-world.html', 'https://v8.dev/blog/hello-world']
]);

// for (const [oldUrl, newUrl] of oldToNew) {
//   console.log(`${oldUrl} => ${newUrl}`);
// }

module.exports = oldToNew;
