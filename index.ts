// src/index.ts

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// DATABASE_URL environment variable olarak panelden Secret eklenmeli
const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) throw new Error("DATABASE_URL tanımlı değil!");

const client = new Client(DATABASE_URL);
await client.connect();

const handler = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);

  if (pathname === "/wss") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.action === "register") {
          const { username, password } = data;
          const hashed = btoa(password); // basit hash (geliştirmek lazım)
          await client.queryObject`
            INSERT INTO kullanicilar (username, password) VALUES (${username}, ${hashed})
          `;
          socket.send(JSON.stringify({ status: "ok", message: "Kayıt başarılı" }));
        }

        if (data.action === "login") {
          const { username, password } = data;
          const res = await client.queryObject<{ password: string }>`
            SELECT password FROM kullanicilar WHERE username = ${username}
          `;
          if (res.rows.length && res.rows[0].password === btoa(password)) {
            socket.send(JSON.stringify({ status: "ok", message: "Giriş başarılı" }));
          } else {
            socket.send(JSON.stringify({ status: "error", message: "Kullanıcı bulunamadı veya şifre yanlış" }));
          }
        }

        if (data.action === "getUsers") {
          const res = await client.queryObject<{ username: string }>`SELECT username FROM kullanicilar`;
          socket.send(JSON.stringify({ status: "ok", users: res.rows.map(r => r.username) }));
        }

      } catch (err) {
        socket.send(JSON.stringify({ status: "error", message: err.message }));
      }
    };

    socket.onclose = () => console.log("WebSocket bağlantısı kapandı");

    return response;
  }

  return new Response("WebSocket server running", { status: 200 });
};

console.log("Sunucu başlatıldı, wss:// üzerinden bağlanabilirsiniz");
await serve(handler, { port: 8000 });
