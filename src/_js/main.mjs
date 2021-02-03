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

const darkModeToggle = document.querySelector('dark-mode-toggle');

// Only load the Twitter script when we need it.
const twitterLink = document.querySelector('.twitter-link');
let twitterLoaded = null;
if (twitterLink) {
  twitterLoaded = import('https://platform.twitter.com/widgets.js')
    .then(() => twitterLink.remove());
}

// Dynamically either insert the dark- or the light-themed Twitter widget.
let twitterTimelineContainer = document.querySelector('.twitter-widget');
const updateTwitterTimeline = async () => {
  if (twitterTimelineContainer) {
    await twitterLoaded;
    const newContainer = twitterTimelineContainer.cloneNode();
    newContainer.style.display = 'none';
    twitterTimelineContainer.insertAdjacentElement('afterend', newContainer);
    await twttr.widgets.createTimeline({
      screenName: 'v8js',
      sourceType: 'profile',
    },
    newContainer,
    {
      dnt: true,
      height: 1000,
      chrome: 'noheader nofooter',
      theme: darkModeToggle.mode,
    });
    twitterTimelineContainer.remove();
    newContainer.style.display = 'block';
    twitterTimelineContainer = newContainer;
  }
};

// Toggles the `dark` class based on the dark mode toggle's mode
const root = document.documentElement;
const updateThemeClass = () => {
  root.classList.toggle('dark', darkModeToggle.mode === 'dark');
  updateTwitterTimeline();
};

// Set or remove the `dark` class the first time.
updateThemeClass();

// Listen for toggle changes (which includes `prefers-color-scheme` changes)
// and toggle the `dark` class accordingly.
darkModeToggle.addEventListener('colorschemechange', updateThemeClass);

// Navigation toggle.
const navToggle = document.querySelector('#nav-toggle');
navToggle.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('header nav').classList.add('show');
  navToggle.classList.add('hide');
});

// Make headings copyable by clicking.
const copyLinkToClipboard = () => {
  if (!('clipboard' in navigator)) {
    return;
  }
  document
    .querySelector('main')
    // ToDo: Use `:is(h2, h3, h4, h5, h6)[id]` once support is better.
    .querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]')
    .forEach((heading) => {
      heading.addEventListener('click', (ev) => {
        // Don't jump when the '#' is clicked.
        if (ev.target.nodeName === 'A') {
          ev.preventDefault();
        }
        try {
          navigator.clipboard.writeText(
            `${location.origin}${location.pathname}#${heading.id}`,
          );
          const temp = heading.innerHTML;
          heading.innerHTML += '&nbsp;<small>(📋 Copied.)</small>';
          setTimeout(() => {
            heading.innerHTML = temp;
          }, 2000);
        } catch (err) {
          console.warn(err.name, err.message);
        }
      });
    });
};
copyLinkToClipboard();

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
const gaScript = document.createElement('script');
gaScript.src = 'https://www.google-analytics.com/analytics.js';
document.head.appendChild(gaScript);

// On Apple mobile devices add the proprietary app icon and splashscreen markup.
// No one should have to do this manually, and eventually this annoyance will
// go away once https://bugs.webkit.org/show_bug.cgi?id=183937 is fixed.
if (/\b(iPad|iPhone|iPod|Safari)\b/.test(navigator.userAgent)) {
  import('https://unpkg.com/pwacompat');
}
