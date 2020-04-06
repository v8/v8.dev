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

const installPrismLanguages = (Prism) => {

  // Based on the grammar defined at the bottom of:
  // https://cs.chromium.org/chromium/src/v8/src/torque/torque-parser.cc
  Prism.languages.torque = {
    'comment': {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true,
    },
    'string': {
      pattern: /(["'])(?:\\(?:\n|.)|(?!\1)[^\\\n])*\1/s,
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
    'keyword': /\b(?:typeswitch|javascript|generates|constexpr|otherwise|continue|implicit|operator|runtime|builtin|extends|labels|return|namespace|extern|while|macro|const|label|break|type|else|case|let|try|for|if)\b/,
    'boolean': /\b(?:[tT]rue|[fF]alse)\b/,
    'number': /\b0x[\da-fA-F]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
    'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
    'punctuation': /[{}[\];(),.:]/,
  };

  // Potayto, potahto.
  Prism.languages.asm = {
    'comment': /;.*$/m,
    'string': /(["'`])(?:\\.|(?!\1)[^\\\n])*\1/,
    'label': {
      pattern: /(^\s*)[A-Za-z._?$][\w.?$@~#]*:/m,
      lookbehind: true,
      alias: 'function'
    },
    'keyword': [
      /\b(mov([sz]x)?|cmov(n?[abceglopsz]|n?[abgl]e|p[eo]))\b/,
      {
        pattern: /(^\s*)section\s*[a-zA-Z.]+:?/im,
        lookbehind: true
      },
      /(?:extern|global)[^;\n]*/i,
      /(?:CPU|FLOAT|DEFAULT).*$/m
    ],
    'register': [
      // x86
      {
        pattern: /\b%?([abcd][hl]|[er]?[abcd]x|[er]?(di|si|bp|sp)|dil|sil|bpl|spl|r(8|9|1[0-5])[bdlw]?)\b/i,
        alias: 'variable'
      },
      // arm
      {
        pattern: /\b(pc|sp|fp|lr|cp|ip|xzr|wzr|([rxw][0-9][0-9]?))\b/i,
        alias: 'variable'
      }
    ],
    'number': [
      // Match a disassembled Arm instruction as a number.
      /\b[\da-f]{8}\b/i,
      // Match immediates.
      /(#[+-]?)?\b(\d+|0x[\da-f]+)\b/i,
    ],
    'operator': /[\[\]*+\-\/%<>=&|$!]/,
  };

  // Suitable to print disassembly, the simulator debugger prompt as well as
  // the output of --print-code.
  Prism.languages.simulator = Prism.languages.extend('asm', {
    'comment': [
      /                  .*$/m,
      /# .*/,
    ],
    'keyword': /sim>/,
    // Print addresses as strings to differentiate them from regular numbers. We
    // assume 0x followed by at least 6 hexadecimal characters is an address.
    'string': [
      // First match a line that starts with an address but also has an offset
      // after 4 spaces.
      /^0x[\da-f]{6}[\da-f]*    [\da-f ]{2}/im,
      // Then match regular addresses.
      /\b0x[\da-f]{6}[\da-f]*\b/i,
    ]
  });

  // Basic highlighter for ES spec and Torque grammar excerpts.
  Prism.languages.grammar = {
    // matches the `[...]` part in `ProductionName[...]`
    'production-params': /(?<=[a-z])\[.*?\]/,
    // matches `ProductionName`
    'production-name': /\b[A-Z][A-Za-z_]*\b/,
    // "but not" and "one of" are special human-readable words in
    // the ES spec that shouldn't be formatted as literals
    'skip': /but not|one of/,
    // `opt` is an ES grammar keyword to be formatted as a subscript
    // `list+` and `list*` are Torque grammar keywords
    'keyword': /\bopt\b|\blist[+*]/,
    // anything else - numbers, words, punctuation - is a literal
    'literal': /\S+/,
  };
};

module.exports = installPrismLanguages;
