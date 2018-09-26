Prism.languages.torque = {
  'comment': {
    pattern: /(^|[^\\:])\/\/.*/,
    lookbehind: true,
    greedy: true,
  },
  'string': {
    pattern: /(["'])(?:\\(?:\r\n|.)|(?!\1)[^\\\r\n])*\1/s,
    greedy: true,
  },
  'class-name': [
    {
      pattern: /((?:\:\s+(\bconstexpr\b\s+)?))[\w]+(?:\s*(?:\)|;|,|=|{|labels))/i,
      inside: {
        keyword: /\b(?:constexpr|labels)\b/,
      },
    },
    {
      pattern: /((?:\b(?:type\s+[\w]+\s+=)\s+))[\w\|]+/i,
      lookbehind: true,
    },
    {
      pattern: /((?:\b(?:type|extends)\s+))[\w]+/i,
      lookbehind: true,
    }
  ],
  'builtin': /\b(?:UnsafeCast|Convert|Cast|check|assert)\b/,
  'keyword': /\b(?:typeswitch|javascript|generates|constexpr|otherwise|continue|operator|runtime|builtin|extends|labels|return|module|extern|while|macro|const|label|break|type|else|case|let|try|for|if)\b/,
  'boolean': /\b(?:[tT]rue|[fF]alse)\b/,
  'number': /\b0x[\da-fA-F]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
  'punctuation': /[{}[\];(),.:]/,
};
