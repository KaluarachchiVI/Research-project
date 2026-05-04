import execa from "execa";
import * as path from "path";
import * as log from "../util/logger";
import { getDesktopAppRoot } from "../util/paths";

const PROXY_PORT = 8888;

export async function enableSystemProxy(): Promise<void> {
  const script = path.join(getDesktopAppRoot(), "scripts", "set-proxy.ps1");
  log.log("Enabling system proxy via", script);
  await execa("powershell", ["-ExecutionPolicy", "Bypass", "-File", script, "-ProxyHost", "127.0.0.1", "-Port", String(PROXY_PORT)], {
    stdio: "inherit",
  });
}

export async function disableSystemProxy(): Promise<void> {
  const script = path.join(getDesktopAppRoot(), "scripts", "unset-proxy.ps1");
  log.log("Disabling system proxy via", script);
  await execa("powershell", ["-ExecutionPolicy", "Bypass", "-File", script], {
    stdio: "inherit",
    reject: false,
  });
}

export const FOCUS_PROXY_PORT = PROXY_PORT;
