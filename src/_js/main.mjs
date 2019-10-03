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

import * as DarkModeToggle from '/_js/dark-mode-toggle.min.mjs';

// Navigation toggle.
const toggle = document.querySelector('#nav-toggle');
toggle.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('header nav').classList.add('show');
  toggle.classList.add('hide');
});

// A user right-clicking the logo probably wants to download it.
if (location.pathname !== '/logo') {
  const logo = document.querySelector('#header a');
  logo.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    self.location = '/logo';
  });
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
const firstScript = document.scripts[0];
const scriptElement = document.createElement('script');
scriptElement.src = 'https://www.google-analytics.com/analytics.js';
firstScript.parentNode.insertBefore(scriptElement, firstScript);
