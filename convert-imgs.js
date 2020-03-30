const glob = require("glob").sync;
const fs = require("fs").promises;
const parse5 = require("parse5");
const assert = require("assert");
const getImageSize = require("image-size");
const { inspect } = require("util");

function toMarkdown(nodes) {
  let res = "";
  for (let node of nodes) {
    switch (node.nodeName) {
      case "#text":
        res += node.value;
        break;
      case "code": {
        let [child, ...rest] = node.childNodes;
        assert.deepEqual(rest, []);
        assert.strictEqual(child.nodeName, "#text");
        res += "`" + child.value + "`";
        break;
      }
      case "a": {
        let [attr, ...rest] = node.attrs;
        assert.deepEqual(rest, []);
        assert.strictEqual(attr.name, "href");
        res += `[${toMarkdown(node.childNodes)}](${attr.value})`;
        break;
      }
      default: {
        throw new TypeError(`Unhandled node type ${node.type}`);
      }
    }
  }
  return res;
}

Promise.all(
  glob("src/**/*.md").map(async path => {
    let f = await fs.readFile(path, "utf8");
    let newF = f.replace(/<figure>(.*?)<\/figure>/sg, chunk => {
      let srcForErr;
      try {
        let [ast, ...rest1] = parse5.parseFragment(chunk).childNodes;
        assert.deepEqual(rest1, []);
        assert.strictEqual(ast.nodeName, "figure");
        let [img, figcaption, ...rest2] = ast.childNodes.filter(
          child => !(child.nodeName === "#text" && child.value.match(/^\s*$/))
        );
        assert.deepEqual(rest2, []);
        assert.strictEqual(img.nodeName, "img");
        let {
          src,
          width,
          height,
          srcset,
          alt,
          loading,
          ...other
        } = Object.fromEntries(
          img.attrs.map(({ name, value }) => [name, value])
        );
        srcForErr = src;
        assert.deepEqual(other, {});
        assert(src.startsWith("/_img/"));
        let dimensions = getImageSize("src" + src);
        if (width != dimensions.width || height != dimensions.height) {
          // if (src.endsWith(".svg")) {
          //   let svg = require('fs').readFileSync("src" + src);
          //   svg = svg.replace(/<svg([^>]*)>/, (_, attrs) => {
          //     attrs = attrs.replace(/ (?:width|height)="\d+"/, '');
          //     return `<svg${attrs} width="${width}" height="${height}">`;
          //   });
          //   require('fs').writeFileSync("src" + src, svg);
          // } else {
          assert.fail(
            `${width}x${height} != ${dimensions.width}x${dimensions.height}`
          );
          // }
        }
        if (srcset) {
          assert.strictEqual(srcset, `${src.replace(/\.[^.]*$/, "@2x$&")} 2x`);
        }
        assert.strictEqual(alt, "");
        assert.strictEqual(loading, "lazy");
        if (figcaption) {
          assert.strictEqual(figcaption.nodeName, "figcaption");
          assert.deepEqual(figcaption.attrs, []);
          alt = toMarkdown(figcaption.childNodes);
        }
        return `![${alt}](${src})`;
      } catch (err) {
        console.error(`${path} (image: ${srcForErr}):`, err);
        return chunk;
      }
    });
    if (f !== newF) {
      await fs.writeFile(path, newF);
    }
  })
).then(() => {
  console.log('Done');
}, err => {
  console.error('Fatal:', err);
  process.exit(1);
});
