import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { connect } from "https://deno.land/x/redis@v0.31.0/mod.ts";

const redis = await connect({
  hostname: "frankfurt-keyvalue.render.com",
  port: 6379,
  password: "AfL6jiHOzZnSCGKCrvRSxCU9Tt6xq7d5",
  tls: true,
});

const clients = new Set<WebSocket>();

serve((req) => {
  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    clients.add(socket);
    console.log("Yeni bağlantı!");
  };

  socket.onmessage = async (e) => {
    // Mesajı Redis'e kaydet
    await redis.publish("cloudlink", e.data);
  };

  socket.onclose = () => clients.delete(socket);
  return response;
});

// Redis kanalından gelen mesajları herkese gönder
(async () => {
  const sub = await redis.subscribe("cloudlink");
  for await (const { message } of sub.receive()) {
    for (const client of clients) {
      client.send(message);
    }
  }
})();
