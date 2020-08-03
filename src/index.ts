import low from 'lowdb';

import FileSync from 'lowdb/adapters/FileSync';

import { Telegraf } from 'telegraf';
import fastify from 'fastify';

if (!process.env.TG_TOKEN || !process.env.FILE_PATH) {
  console.log('provide TG_TOKEN и FILE_PATH');
  process.exit(1);
}

const adapter = new FileSync(process.env.FILE_PATH);

const db = low(adapter);

const bot = new Telegraf(process.env.TG_TOKEN);

bot.start((ctx) =>
  ctx.reply(
    'используй команду /savechat чтобы дать этому чату имя. У одного чата может быть много имен',
  ),
);

bot.command('savechat', (ctx) => {
  console.log('incoming savechat');
  const text = ctx.update.message?.text;

  if (!text) {
    return;
  }
  const chatId = ctx.update.message?.chat.id;

  if (!chatId) {
    return;
  }
  const chatnameRe = /savechat ([^\s]+)$/;
  if (!chatnameRe.test(text)) {
    ctx.replyWithMarkdown('имя чата должно быть без пробелов');
    return;
  }

  const match = chatnameRe.exec(text);

  if (!match) {
    ctx.replyWithMarkdown('не смог распарсить имя чата');
    return;
  }

  const chatname = match[1];

  db.set(['chats', chatname], { chatname, chatId }).write();

  ctx.reply(`запомнил чат ${chatId} как ${chatname}`);
});

const server = fastify();

server.post('/', (request, reply) => {
  console.log('incomingEvent', request.body);

  reply.code(200);

  const message = getMessageFromRequest(request);
  const chatname = getChatnameFromRequest(request);

  if (!message) {
    reply.code(400);
    reply.send('provide message in body');
    return;
  }

  if (!chatname) {
    reply.code(400);
    reply.send('provide chatname in body');
    return;
  }

  const chatInfo = db.get(['chats', chatname]).value();

  if (!chatInfo) {
    reply.code(404);
    reply.send(`чата ${chatname} не существует`);
  }

  reply.code(200);
  reply.send('ok');

  bot.telegram.sendMessage(chatInfo.chatId, message);
});

server.post('/:chatname', (request, reply) => {
  console.log('incomingEvent', request.body);

  reply.code(200);

  const message = getMessageFromRequest(request);
  // @ts-ignore
  const { chatname } = request.params;
  if (!message) {
    reply.code(400);
    reply.send('provide message in body');
    return;
  }

  const chatInfo = db.get(['chats', chatname]).value();

  if (!chatInfo) {
    reply.code(404);
    reply.send(`чата ${chatname} не существует`);
  }

  reply.code(200);
  reply.send();

  bot.telegram.sendMessage(chatInfo.chatId, message);
});

bot.launch();

server.listen(8080, '0.0.0.0');

console.log('started');

function getMessageFromRequest(request: any): string | null {
  if (
    !request ||
    !request.body ||
    !request.body.message ||
    typeof request.body.message !== 'string'
  ) {
    return null;
  }
  return request.body.message;
}

function getChatnameFromRequest(request: any): string | null {
  if (!request || !request.body || !request.body.chat || typeof request.body.chat !== 'string') {
    return null;
  }
  return request.body.chat;
}
