const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const https = require('https');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

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
  let messages = await client.getMessages(req.params.group, { limit: 10 })

  return res.status(200).json({
    messageIds: messages.map(m => m.id)
  });
});

app.get("/messages/cryptonear", async (req, res, next) => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    onError: (err) => console.log(err),
  });
  let messages = await client.getMessages('cryptonear', { limit: 10 })

  return res.status(200).json({
    messages
  });
})

app.get('/groups-ui/:group', async (req, res) => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    onError: (err) => console.log(err),
  });
  let { group } = req.params;

  let messages = await client.getMessages(group, { limit: 10 })

  let messageIds = messages.map(m => m.id);
  const urls = messageIds.map(id => `https://t.me/${group}/${id}?embed=1`);
  const divContents = new Array(messageIds.length);
  let groupName;

  const downloadPromises = urls.map((url, i) => {
    return new Promise((resolve, reject) => {
      // Download the web page
      https.get(url, (response) => {
        let body = '';

        // Concatenate the received chunks
        response.on('data', (chunk) => {
          body += chunk;
        });

        // When the response is complete
        response.on('end', () => {
          // Load the HTML using cheerio
          const $ = cheerio.load(body);

          // Find all div elements with class "tgme_widget_message_author"
          const divsWithClass = $('div.tgme_widget_message_author');

          // Remove all but the first child div
          divsWithClass.each((index, element) => {
            const firstChild = $(element).children().first();
            if (!groupName) {
              groupName = $(element).children().last();
            }
            $(element).empty().append(firstChild);
          });

          // Extract the <body> content
          const bodyContent = $('body').html();

          // Wrap the body content with a <div>
          const divContent = `<div style="margin-bottom:10px;width:100%;display:flex"><div class="widget_frame_base tgme_widget body_widget_post emoji_image force_userpic nodark" style="max-width:700px">${bodyContent}</div></div>`;

          divContents[i] = divContent;
          resolve();
        });
      }).on('error', (err) => {
        console.error('Error downloading the web page:', err);
        reject(err);
      });
    });
  });

  Promise.all(downloadPromises)
    .then(() => {
      // Combine the <div> contents into a single HTML string
      const combinedContent = '<div class="tgme_widget_message_author" style="color: black">Recent Posts in&nbsp;'+groupName+'</div>'+divContents.join('');

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
        <link href="https://telegram.org/css/widget-frame.css?66" rel="stylesheet" media="screen">
        <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.6/iframeResizer.contentWindow.js"></script>
        <link href='https://fonts.googleapis.com/css?family=Roboto' rel='stylesheet'>
        <style>
          :root {
            color-scheme: light !important;
          }
          a.tgme_widget_message_owner_name, a.tgme_widget_message_owner_name:hover, a.tgme_widget_message_owner_name:visited {
            color: var(--accent-color); 
            text-decoration: none;
            margin-bottom: 10px;
          }
        </style>
        </head>
        <body>
          <div style="display:flex;flex-wrap:wrap;justify-content:left;font-family:'Roboto'">${combinedContent}</div>
        </body>
      </html>
    `;

      res.send(html);
    })
    .catch((err) => {
      console.error('Error occurred while downloading web pages:', err);
      res.status(500).send('An error occurred while downloading web pages.');
    });

});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
