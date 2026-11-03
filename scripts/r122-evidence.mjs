/** Append-only CDP evidence. Navigation never clears earlier stages. */
export function createEvidence(record = () => {}) {
  const events = [];
  const requests = new Map();
  let stage = "setup";
  const add = (method, params) => {
    const event = { sequence: events.length + 1, at: new Date().toISOString(), stage, method, params };
    events.push(event);
    record(event);
  };
  return {
    events,
    stage(name) { stage = name; add("Evidence.stage", { name }); },
    receive({ method, params = {} }) {
      if (method === "Network.requestWillBeSent") {
        requests.set(params.requestId, { url: params.request.url, stage });
      } else if (method === "Network.loadingFinished") {
        requests.delete(params.requestId);
      } else if (method === "Network.loadingFailed") {
        add(method, { ...params, request: requests.get(params.requestId) ?? null });
        requests.delete(params.requestId);
      } else if (method === "Network.responseReceived" && params.response.status >= 400) {
        add(method, { ...params, request: requests.get(params.requestId) ?? null });
      } else if (method?.startsWith("Runtime.console") || method === "Runtime.exceptionThrown" ||
        method === "Runtime.executionContextsCleared" || method === "Log.entryAdded") {
        add(method, params);
      }
    },
  };
}

export function summarize(events) {
  return {
    consoleErrors: events.filter(e => e.method === "Runtime.consoleAPICalled" && e.params.type === "error").length,
    consoleWarnings: events.filter(e => e.method === "Runtime.consoleAPICalled" && e.params.type === "warning").length,
    exceptions: events.filter(e => e.method === "Runtime.exceptionThrown").length,
    browserErrors: events.filter(e => e.method === "Log.entryAdded" && e.params.entry.level === "error").length,
    browserWarnings: events.filter(e => e.method === "Log.entryAdded" && e.params.entry.level === "warning").length,
    httpErrors: events.filter(e => e.method === "Network.responseReceived").length,
    networkFailures: events.filter(e => e.method === "Network.loadingFailed" && !e.params.canceled).length,
    canceledRequests: events.filter(e => e.method === "Network.loadingFailed" && e.params.canceled).length,
  };
}
