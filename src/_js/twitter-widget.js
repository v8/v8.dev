/**
 * Dynamically either insert the dark or the light themed Twitter widget
 * @todo Should the widget be dynamically updated upon theme change?
 */
(function(toggle, prefix, suffix) {
  document.querySelector('main').insertAdjacentHTML('beforeend', prefix +
      (toggle ? toggle.mode : 'light') + suffix);
})(
  document.querySelector('dark-mode-toggle'),
  '<a href="https://twitter.com/v8js" rel="me nofollow" class="twitter-timeline" data-dnt="true" data-height="1000" data-chrome="noheader nofooter" data-theme="',
  '">View tweets by @v8js</a>'
);
