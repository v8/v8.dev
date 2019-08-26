const fs = require('fs');

const glob = require('glob');
const imageSize = require('image-size');

const files = glob.sync('src/**/*.{html,md}');
for (const file of files) {
  const contents = fs.readFileSync(file, 'utf8').toString();
  let updatedContents = contents;
  const results = contents.matchAll(/^\s*<img.*$/gm);
  if (!results) continue;
  for (const result of results) {
    const oldLine = result[0];
    if (oldLine.includes(' width="')) continue;
    const fileName = 'src/' + oldLine.match(/src="\/([^"]+)"/)[1];
    const { width, height } = imageSize(fileName);
    const updatedLine = oldLine.replace(' alt="', ` width="${width}" height="${height}" alt="`);
    console.log(oldLine);
    console.log('>>');
    console.log(updatedLine);
    console.log('------------');
    updatedContents = updatedContents.replace(oldLine, updatedLine);
  }
  fs.writeFileSync(file, updatedContents);
}
