import http from "http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.WS_PORT ?? "3001");

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/broadcast" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      broadcast("refresh");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

const broadcast = (message: string) => {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
};

wss.on("connection", (ws) => {
  ws.send("connected");
});

setInterval(() => {
  broadcast("refresh");
}, 60_000);

server.listen(PORT, () => {
  console.log(`WS server on :${PORT}`);
});
