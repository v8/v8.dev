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

import '/_js/dark-mode-toggle.mjs';

// Dark mode toggle.
const darkModeToggle = document.querySelector('dark-mode-toggle');
const root = document.documentElement;

const updateThemeClass = () => {
  root.classList.toggle('dark', darkModeToggle.mode === 'dark');
};

// Set or remove the `dark` class the first time.
updateThemeClass();

// Listen for toggle changes (which includes `prefers-color-scheme` changes)
// and toggle the `dark` class accordingly.
darkModeToggle.addEventListener('colorschemechange', updateThemeClass);

// Force listening for external events (by default "permanent" prevents this).
matchMedia('(prefers-color-scheme:dark)').addListener(({matches}) => {
  darkModeToggle.mode = matches ? 'dark' : 'light';
  updateThemeClass();
});

// Navigation toggle.
const navToggle = document.querySelector('#nav-toggle');
navToggle.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('header nav').classList.add('show');
  navToggle.classList.add('hide');
});

// A user right-clicking the logo probably wants to download it.
if (location.pathname !== '/logo') {
  const logo = document.querySelector('#header a');
  logo.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    self.location = '/logo';
  });
}

// Helper function to dynamically insert scripts.
const firstScript = document.scripts[0];
const insertScript = (src) => {
  const script = document.createElement('script');
  script.src = src;
  firstScript.parentNode.insertBefore(script, firstScript);
};

// Dynamically either insert the dark- or the light-themed Twitter widget.
const twitterTimeline = document.querySelector('.twitter-timeline');
if (twitterTimeline) {
  twitterTimeline.dataset.theme = darkModeToggle.mode;
  insertScript('https://platform.twitter.com/widgets.js');
}

// Install our service worker.
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// Remove UTM garbage from URLs, to make it less likely such links get shared.
if (location.search.includes('utm_source')) {
  // This site doesn’t use query string parameters anyway, so we can just
  // set the location to `location.pathname` directly.
  history.replaceState({}, '', location.pathname);
}

// Google Analytics.
const UA_ID = 'UA-65961526-1';
self.GoogleAnalyticsObject = 'ga';
self.ga = (...args) => {
  ga.q.push(args);
};
ga.l = Date.now();
ga.q = [];
ga('create', UA_ID, 'auto');
ga('set', 'referrer', document.referrer.split('?')[0]);
ga('send', 'pageview');
insertScript('https://www.google-analytics.com/analytics.js');
