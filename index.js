const serverless = require("serverless-http");
const express = require("express");
const app = express();

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = process.env.TG_API_ID;
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_STRING_SESSION);

app.get("/groups/:group", async (req, res, next) => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    onError: (err) => console.log(err),
  });
  let messages = await client.getMessages(req.params.group, {limit: 1})

  return res.status(200).json({
    count: messages[0].id
  });
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
