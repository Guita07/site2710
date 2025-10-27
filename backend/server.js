import express from "express"
import http from "http"
import { WebSocketServer } from "ws"

const PORT = process.env.PORT || 8080
const CROSS_ONLY = true // esp -> site e site -> esp

const app = express()

const server = http.createServer(app)
const wss = new WebSocketServer({ server }) // WS compartilhando a mesma porta do Express

wss.on("connection", (ws, req) => {
    // diferencia pela query: ws(s)://host:porta/?from=esp|site
    let role = "unknown"
    try {
        const url = new URL(req.url, "http://local")
        const from = (url.searchParams.get("from") || "").toLowerCase()
        if (from === "esp" || from === "site") role = from
    } catch { }
    ws.role = role

    console.log(`[WS] conectado: ${ws.role} de ${req.socket.remoteAddress}`)

    ws.on("message", (msg, isBinary) => {
        // garanta string:
        const texto = isBinary
            ? msg.toString("utf8")
            : (typeof msg === "string" ? msg : msg.toString("utf8"))
        for (const client of wss.clients) {
            if (client === ws || client.readyState !== client.OPEN) continue;

            if (CROSS_ONLY) {
                if (ws.role === "esp" && client.role === "site") {
                    client.send(texto)
                    console.log(texto)
                }
                else if (ws.role === "site" && client.role === "esp") {
                    client.send(texto)
                    console.log(texto)
                }
            } else {
                client.send(texto)
            }
        }
    });

    ws.on("close", () => console.log(`[WS] fechado: ${ws.role}`))
});

server.listen(PORT, () => {
    console.log(`HTTP on :${PORT} | WS on :${PORT}`)
});
