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

const { DateTime } = require('luxon');
const he = require('he');
const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const markdownItAttrs = require('markdown-it-attrs');
const markdownItContainer = require('markdown-it-container');
const markdownItEmbedImage = require('./md-embed-image.js');
const markdownItImplicitFigures = require('markdown-it-implicit-figures');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItMultiMdTable = require('markdown-it-multimd-table');
const pluginRss = require('@11ty/eleventy-plugin-rss');
const pluginSyntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');

const installPrismLanguages = require('./prism-languages.js');
const expandFeatureSupport = require('./feature-support.js');

const markdownItConfig = {
  html: true,
  breaks: true,
  linkify: false,
};
const markdownItAnchorConfig = {
  permalink: true,
  permalinkClass: 'bookmark',
  permalinkSymbol: '#',
};

const md = markdownIt(markdownItConfig)
  .use(markdownItFootnote)
  .use(markdownItAttrs)
  .use(markdownItContainer, 'note')
  .use(markdownItContainer, 'table-wrapper')
  .use(markdownItContainer, 'ecmascript-algorithm')
  .use(markdownItContainer, 'figure',  {
    validate(params) {
      return params.trim().match(/^figure\s+(.*)$/);
    },
    render(tokens, idx) {
      const m = tokens[idx].info.trim().match(/^figure\s+(.*)$/);
      if (tokens[idx].nesting === 1) {
        // Opening tag; save caption for the closing tag.
        this.saved_caption_ = m[1];
        return '<figure>\n';
      } else {
        // Closing tag.
        return '<figcaption>' + md.utils.escapeHtml(this.saved_caption_) + '</figcaption></figure>\n';
      }
    },
    saved_caption_: null
  })
  .use(markdownItMultiMdTable, {
    rowspan: true,
    multiline: true,
  })
  .use(markdownItAnchor, markdownItAnchorConfig)
  .use(markdownItImplicitFigures, {
    figcaption: true
  })
  .use(markdownItEmbedImage);

// Simulating `td:has(>pre:only-child)` with a markdown-it render rule.
// Can be removed when (if?) CSS4 is actually implemented in browsers.
const prevTdRenderer = md.renderer.rules.table_column_open;
md.renderer.rules.table_column_open = (tokens, idx, options, env, self) => {
  if (tokens[idx + 1].type === 'fence' && tokens[idx + 2].type === 'table_column_close') {
    tokens[idx].attrJoin('class', 'td-with-just-pre');
  }
  if (prevTdRenderer) {
    return prevTdRenderer(tokens, idx, options, env, self);
  } else {
    return self.renderToken(tokens, idx, options);
  }
};

module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight, {
    init({ Prism }) {
      installPrismLanguages(Prism);
    },
  });

  eleventyConfig.addLayoutAlias('post', 'layouts/post.njk');

  eleventyConfig.addFilter('readableDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj).toFormat('dd LLLL yyyy');
  });

  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj).toFormat('yyyy-LL-dd');
  });

  eleventyConfig.addFilter('markdown', (string) => {
    return md.renderInline(string);
  });

  eleventyConfig.addFilter('decodeHtmlEntities', (string) => {
    return he.decode(string);
  });

  // Match Firebase’s `cleanUrls` setting.
  eleventyConfig.addFilter('clean', (path) => {
    if (path === '/') return path;
    if (path === 'https://v8.dev/') return path;
    if (path.endsWith('/')) return path.slice(0, -1);
    return path;
  });

  // Get the first `n` elements of a collection.
  eleventyConfig.addFilter('head', (array, n) => {
    return array.slice(0, n);
  });

  eleventyConfig.addFilter('filterBlogPosts', (array) => {
    return array.filter(post =>
                        post.inputPath.startsWith('./src/blog/'));
  });

  eleventyConfig.addFilter('filterFeaturePosts', (array) => {
    return array.filter(post =>
                        post.inputPath.startsWith('./src/features/'));
  });

  // Create a collection for blog posts only.
  eleventyConfig.addCollection('posts', (collection) => {
    return collection.getFilteredByGlob('src/blog/*.md')
                     .sort((a, b) => b.date - a.date);
  });

  // Create a collection for feature explainers only.
  eleventyConfig.addCollection('features', (collection) => {
    return collection.getFilteredByGlob('src/features/*.md')
                     .sort((a, b) => b.date - a.date);
  });

  // Create a collection with merged blogs and feature explainers.
  eleventyConfig.addCollection('allPosts', (collection) => {
    return collection.getFilteredByGlob('src/{blog,features}/*.md')
                     .sort((a, b) => b.date - a.date);
  });

  // Patch the Markdown renderer to recognize <feature-support>.
  const oldRender = md.render.bind(md);
  md.render = (input) => {
    const preprocessed = expandFeatureSupport(input);
    return oldRender(preprocessed);
  };

  // Treat `*.md` files as Markdown.
  eleventyConfig.setLibrary('md', md);

  eleventyConfig.addCollection('tagList', (collection) => {
    const set = new Set();
    for (const item of collection.getAllSorted()) {
      if ('tags' in item.data) {
        const tags = item.data.tags;
        if (typeof tags === 'string') {
          tags = [tags];
        }
        for (const tag of tags) {
          set.add(tag);
        }
      }
    }
    return [...set].sort();
  });

  // Copy assets that don’t require a build step.
  eleventyConfig.addPassthroughCopy('src/favicon.ico');
  eleventyConfig.addPassthroughCopy('src/robots.txt');
  eleventyConfig.addPassthroughCopy('src/_img');
  eleventyConfig.addPassthroughCopy('src/_css/img');

  return {
    templateFormats: [
      'md',
      'njk',
      'html',
    ],

    pathPrefix: '/',

    markdownTemplateEngine: 'liquid',
    htmlTemplateEngine: 'njk',
    dataTemplateEngine: 'njk',
    passthroughFileCopy: true,
    dir: {
      input: 'src',
      includes: '_includes',
      data: '_data',
      output: 'dist',
    },
  };
};
