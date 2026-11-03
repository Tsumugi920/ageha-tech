import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence, summarize } from "../scripts/r122-evidence.mjs";

test("R12.2-A retains the historical React warning across navigation and stages", () => {
  const written = [];
  const evidence = createEvidence(event => written.push(event));
  evidence.stage("first-page");
  evidence.receive({ method: "Runtime.consoleAPICalled", params: { type: "error", args: [{ value: "Attempted to synchronously unmount a root while React was already rendering." }] } });
  evidence.receive({ method: "Runtime.executionContextsCleared" });
  evidence.stage("second-page");
  evidence.receive({ method: "Runtime.consoleAPICalled", params: { type: "warning", args: [{ value: "second warning" }] } });
  assert.equal(summarize(evidence.events).consoleErrors, 1);
  assert.equal(summarize(evidence.events).consoleWarnings, 1);
  assert.equal(evidence.events[1].stage, "first-page");
  assert.match(evidence.events[1].params.args[0].value, /synchronously unmount/);
  assert.deepEqual(written, evidence.events);
  assert.deepEqual(written.map(e => e.sequence), [1, 2, 3, 4, 5]);
});

test("R12.2-A distinguishes HTTP failures, failed resources and navigation cancellations without dropping evidence", () => {
  const evidence = createEvidence();
  evidence.stage("resource-page");
  evidence.receive({ method: "Network.requestWillBeSent", params: { requestId: "1", request: { url: "http://localhost/missing.png" } } });
  evidence.receive({ method: "Network.responseReceived", params: { requestId: "1", response: { status: 404 } } });
  evidence.stage("next-page");
  evidence.receive({ method: "Network.loadingFailed", params: { requestId: "1", errorText: "ERR_ABORTED", canceled: true } });
  evidence.receive({ method: "Network.loadingFailed", params: { requestId: "2", errorText: "ERR_CONNECTION_REFUSED", canceled: false } });
  evidence.receive({ method: "Runtime.exceptionThrown", params: { exceptionDetails: { text: "uncaught" } } });
  evidence.receive({ method: "Log.entryAdded", params: { entry: { level: "warning", text: "WebGL warning" } } });
  const counts = summarize(evidence.events);
  assert.equal(counts.httpErrors, 1);
  assert.equal(counts.networkFailures, 1);
  assert.equal(counts.canceledRequests, 1);
  assert.equal(counts.exceptions, 1);
  assert.equal(counts.browserWarnings, 1);
  const canceled = evidence.events.find(e => e.method === "Network.loadingFailed");
  assert.deepEqual(canceled.params.request, { url: "http://localhost/missing.png", stage: "resource-page" });
});
