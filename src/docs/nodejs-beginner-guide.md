# NodeJS
As an asynchronous event-driven JavaScript runtime, Node.js is designed to build scalable network applications. In the following "hello world" example, many connections can be handled concurrently. Upon each connection, the callback is fired, but if there is no work to be done, Node.js will sleep.
```js
const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
```
NodeJS is very powerful with its companian, [NPM](https://npmjs.com). `npm` is a powerful command line tool, which allows you to install libraries and many more frameworks.
One of my top picks are the following:
<br>
1: React.js: `npm install -g create-react-app`
<br>
2: Discord.js: `npm i discord.js`
<br>
3: ExpressJS: `npm i express`
<br>
## Building Different Projects
You can use React.js and Express.js for creating things like web pages, they are the most popular for these, there is also AngularJS which is made by [Google](https://google.com).
You can also make discord bots with [discord.js](https://discord.js.org), Discord bots can be made with python, but if you do know javascript, I'd recommend going for [discord.js](https://discord.js.org),
There are many choices, a google search would be helpful to most of you.

## Credits
1: React: [Facebook](https://facebook.com)
<br>
2: Discord.JS: [All The Members Of The DiscordJS Organization On Github](https://github.com/orgs/discordjs/people)
<br>
3: ExpressJS: [TJ Holowaychuk](github.com/tj)
<br>
4: AngularJS: [Google](https://google.com)
<br>
5: Chrome V8 Engine: [Google](https://google.com)

This page was made by [MTGSquad, A Young Developer Looking For Ways To Change The World.](https://github.com/mtgsquad)

## Thank You For Reading!
