import net from "node:net";

const SOCKET_PATH = `${process.env.HOME}/Library/Application Support/cmux/cmux.sock`;

export type RpcResponse = {
  ok: boolean;
  result?: any;
  error?: { code?: string; message?: string };
};

export function rpc(method: string, params: object = {}): Promise<RpcResponse> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SOCKET_PATH);
    let buf = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      sock.end();
      fn();
    };

    sock.on("connect", () => {
      sock.write(JSON.stringify({ id: "1", method, params }) + "\n");
    });

    sock.on("data", (d) => {
      buf += d.toString();
      // Try parse — once we have a complete JSON object, resolve
      try {
        const parsed: RpcResponse = JSON.parse(buf);
        finish(() => resolve(parsed));
      } catch {
        // incomplete, keep buffering
      }
    });

    sock.on("end", () => {
      if (settled) return;
      try {
        resolve(JSON.parse(buf));
      } catch {
        reject(new Error(`Invalid cmux response: ${JSON.stringify(buf)}`));
      }
    });

    sock.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(new Error(`cmux socket error: ${e.message}`));
    });
  });
}

export async function rpcOrThrow(method: string, params: object = {}): Promise<any> {
  const res = await rpc(method, params);
  if (!res.ok) {
    throw new Error(`cmux ${method} failed: ${res.error?.message ?? "unknown"}`);
  }
  return res.result;
}
