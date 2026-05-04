import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as path from "path";
import * as log from "../util/logger";
import { getDesktopAppRoot } from "../util/paths";

export type LockPhase = "idle" | "work" | "break";

/** CONNECT target is `host:port` or `[ipv6]:port`. */
function parseConnectTarget(url: string): { hostname: string; port: number } {
  const raw = (url || "").trim();
  if (!raw) return { hostname: "", port: 443 };
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end > 1) {
      const hostname = raw.slice(1, end).toLowerCase();
      const rest = raw.slice(end + 1);
      const port = rest.startsWith(":") ? parseInt(rest.slice(1), 10) || 443 : 443;
      return { hostname, port };
    }
  }
  const idx = raw.lastIndexOf(":");
  if (idx > 0 && idx < raw.length - 1 && !raw.includes("]")) {
    const hostPart = raw.slice(0, idx).toLowerCase();
    const port = parseInt(raw.slice(idx + 1), 10) || 443;
    return { hostname: hostPart.trim(), port };
  }
  return { hostname: raw.toLowerCase().trim(), port: 443 };
}

export class UrlConnectProxy {
  private server?: http.Server;
  private blockBody: string;

  constructor(
    private readonly port: number,
    private getPhase: () => LockPhase,
    private isHostAllowed: (hostname: string) => boolean
  ) {
    const blockPath = path.join(getDesktopAppRoot(), "resources", "block-page.html");
    this.blockBody = fs.existsSync(blockPath)
      ? fs.readFileSync(blockPath, "utf8")
      : "<html><body>Blocked</body></html>";
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("IntentLock focus proxy (use HTTPS through CONNECT)\n");
      });

      server.on("connect", (req, clientSocket, head) => {
        const url = req.url ?? "";
        const { hostname, port } = parseConnectTarget(url);
        const phase = this.getPhase();
        const alwaysLocal =
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname.endsWith(".localhost");
        const allowed = alwaysLocal || phase !== "work" || this.isHostAllowed(hostname);

        if (!allowed) {
          log.log("CONNECT blocked:", hostname);
          clientSocket.write(
            "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n" +
              this.blockBody
          );
          clientSocket.end();
          return;
        }

        const serverSocket = net.connect(port, hostname, () => {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head?.length) serverSocket.write(head);
          serverSocket.pipe(clientSocket);
          clientSocket.pipe(serverSocket);
        });

        const onErr = () => {
          try {
            clientSocket.end();
          } catch {
            /* */
          }
          try {
            serverSocket.end();
          } catch {
            /* */
          }
        };
        serverSocket.on("error", onErr);
        clientSocket.on("error", onErr);
      });

      server.listen(this.port, "127.0.0.1", () => {
        this.server = server;
        log.log("CONNECT proxy listening on 127.0.0.1:" + this.port);
        resolve();
      });
      server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = undefined;
  }
}
