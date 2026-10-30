const expression = process.argv[2];
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((item) => item.webSocketDebuggerUrl);
if (!target) throw new Error("no webview target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout")), 10000);
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true, awaitPromise: true },
      }),
    );
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  ws.addEventListener("error", reject);
});
ws.close();
const value = result?.result?.value ?? result?.result?.description ?? result;
console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
