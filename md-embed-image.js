'use strict';

const imageSize = require('image-size');
const { existsSync } = require('fs');

module.exports = md => {
  // Add a post-process rule for inline items.
  md.inline.ruler2.push('embed_image', state => {
    for (let t of state.tokens) {
      // Skip non-image tokens.
      if (t.type !== 'image') continue;
      let imgSrc = t.attrGet('src');
      // We only embed self-hosted images.
      if (imgSrc.startsWith('/_img/')) {
        let { width, height } = imageSize('src' + imgSrc);
        // Lazify image and embed its sizes to avoid layout jump.
        t.attrs.push(['width', width], ['height', height], ['loading', 'lazy']);
        // Check if `file@2x.ext` exists for `file.ext`.
        let imgSrc2x = imgSrc.replace(/\.[^.]*$/, '@2x$&');
        if (existsSync('src' + imgSrc2x)) {
          // If it does, use it in `srcset` as an alternative variant.
          t.attrs.push(['srcset', `${imgSrc2x} 2x`]);
        }
      } else {
        throw new Error(`Image ${imgSrc} is not in the "/_img/..." directory.`);
      }
    }
  });
};
