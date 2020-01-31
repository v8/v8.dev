const fs = require('fs').promises;

const glob = require('glob');
const imageSize = require('image-size');
const videoSize = require('get-video-dimensions');

(async () => {
  const files = glob.sync('src/**/*.{html,md}');
  for (const file of files) {
    const contents = await fs.readFile(file, 'utf8');
    let updatedContents = contents;
    const images = contents.matchAll(/^\s*<img.*$/gm);
    if (images) {
      for (const result of images) {
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
    }

    // TODO: This needs updating once we use `<source>`.
    const videos = contents.matchAll(/^\s*<video.*$/gm);
    if (videos) {
      for (const result of videos) {
        const oldLine = result[0];
        if (oldLine.includes(' width="')) continue;
        const fileName = 'src/' + oldLine.match(/src="\/([^"]+)"/)[1];
        const { width, height } = await videoSize(fileName);
        const updatedLine = oldLine.replace(' src="', ` width="${width}" height="${height}" src="`);
        console.log(oldLine);
        console.log('>>');
        console.log(updatedLine);
        console.log('------------');
        updatedContents = updatedContents.replace(oldLine, updatedLine);
      }
    }

    await fs.writeFile(file, updatedContents);
  }
})();
