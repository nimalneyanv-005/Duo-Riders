import { sql } from "../lib/db";
import { normalizeTrace } from "../lib/normalize";
import { embedTexts, toVector } from "../lib/embed";

const T = (...lines: string[]) => lines.join("\n");

const data = [
  {
    title: "Redis connection timeouts on cart reads",
    service: "checkout-service",
    severity: "SEV2",
    category: "Resource exhaustion",
    trace: T(
      "Error: connect ETIMEDOUT 10.0.4.17:6379",
      "    at TCPConnectWrap.afterConnect (net.js:1157:16)",
      "    at RedisClient.onError (/app/node_modules/ioredis/built/redis/event_handler.js:182:21)",
      "    at CartCache.get (/app/src/cache/cartCache.js:41:19)",
    ),
    rootCause:
      "A new Redis client was created per request and never closed, exhausting the server's max client connections.",
    resolution:
      "Replaced per-request clients with a single shared ioredis instance and added a connection-count alert.",
    engineer: "Priya Raman",
    daysAgo: 210,
    mins: 95,
    hash: "a3f91c2",
    msg: "fix(cache): reuse a single ioredis client instead of per-request connections",
    files: "src/cache/cartCache.js",
  },
  {
    title: "Postgres connection pool exhausted",
    service: "orders-api",
    severity: "SEV1",
    category: "Resource exhaustion",
    trace: T(
      "error: remaining connection slots are reserved for non-replication superuser connections",
      "    at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:287:98)",
      "    at Pool.connect (/app/node_modules/pg-pool/index.js:45:11)",
      "    at OrderRepository.findById (/app/src/repos/orderRepository.ts:58:22)",
    ),
    rootCause:
      "The transaction helper did not release its client when a query threw, leaking one connection per failed request.",
    resolution:
      "Wrapped transactions in try/finally to always release the client and lowered the pool max below the DB limit.",
    engineer: "Arjun Mehta",
    daysAgo: 180,
    mins: 140,
    hash: "7be04d1",
    msg: "fix(db): always release pg client in finally block of withTransaction",
    files: "src/repos/orderRepository.ts,src/db/transaction.ts",
  },
  {
    title: "Invoice creation NullPointerException",
    service: "payments-service",
    severity: "SEV2",
    category: "Null reference",
    trace: T(
      'java.lang.NullPointerException: Cannot invoke "com.acme.payments.Customer.getBillingAddress()" because "customer" is null',
      "    at com.acme.payments.InvoiceService.buildInvoice(InvoiceService.java:112)",
      "    at com.acme.payments.InvoiceController.create(InvoiceController.java:47)",
    ),
    rootCause:
      "Guest checkouts created after a schema migration had no customer row, so the invoice builder dereferenced null.",
    resolution:
      "Added a null guard with a guest-billing fallback and backfilled the missing customer rows.",
    engineer: "Sneha Iyer",
    daysAgo: 160,
    mins: 70,
    hash: "c58d3e9",
    msg: "fix(invoice): handle guest checkout with null customer and backfill rows",
    files:
      "InvoiceService.java,db/migrations/V42__backfill_guest_customers.sql",
  },
  {
    title: "Product list page crashes with undefined map",
    service: "web-frontend",
    severity: "SEV3",
    category: "Null reference",
    trace: T(
      "TypeError: Cannot read properties of undefined (reading 'map')",
      "    at ProductList (webpack:///./src/components/ProductList.jsx:23:31)",
      "    at renderWithHooks (react-dom.development.js:14985:18)",
    ),
    rootCause:
      "The search API returned items: null when the search backend was degraded, and the component assumed an array.",
    resolution:
      "Defaulted items to an empty array in the component and fixed the API contract to always return a list.",
    engineer: "Divya Nair",
    daysAgo: 140,
    mins: 45,
    hash: "1d9a7f0",
    msg: "fix(ui): default items to [] and add empty state to ProductList",
    files: "src/components/ProductList.jsx",
  },
  {
    title: "Image worker out of memory",
    service: "image-processor",
    severity: "SEV2",
    category: "Memory",
    trace: T(
      "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
      "    at Sharp.toBuffer (/app/node_modules/sharp/lib/output.js:98:14)",
      "    at processUpload (/app/src/workers/imageWorker.js:77:10)",
    ),
    rootCause:
      "Large uploads were buffered fully in memory with no size cap and high worker concurrency.",
    resolution:
      "Switched to streaming, capped uploads at 10 MB and reduced worker concurrency.",
    engineer: "Karthik Subramanian",
    daysAgo: 120,
    mins: 180,
    hash: "e42b8a6",
    msg: "fix(worker): stream image processing and enforce 10MB upload limit",
    files: "src/workers/imageWorker.js,src/api/upload.js",
  },
  {
    title: "Kafka consumer commit failed after rebalance",
    service: "notification-service",
    severity: "SEV2",
    category: "Concurrency",
    trace: T(
      "org.apache.kafka.clients.consumer.CommitFailedException: Commit cannot be completed since the group has already rebalanced",
      "    at ConsumerCoordinator.sendOffsetCommitRequest (ConsumerCoordinator.java:1105)",
      "    at NotificationConsumer.poll (NotificationConsumer.java:64)",
    ),
    rootCause:
      "Emails were sent synchronously inside the poll loop, exceeding max.poll.interval.ms and triggering rebalances.",
    resolution:
      "Moved email sending to an async worker pool and raised max.poll.interval.ms.",
    engineer: "Arjun Mehta",
    daysAgo: 100,
    mins: 120,
    hash: "9f6c15b",
    msg: "fix(consumer): process notifications async and raise max.poll.interval.ms",
    files: "NotificationConsumer.java,config/consumer.properties",
  },
  {
    title: "Token signing fails after deploy",
    service: "auth-service",
    severity: "SEV1",
    category: "Configuration",
    trace: T(
      "JsonWebTokenError: secretOrPrivateKey must have a value",
      "    at Object.module.exports [as sign] (/app/node_modules/jsonwebtoken/sign.js:105:20)",
      "    at TokenService.issue (/app/src/auth/tokenService.js:29:12)",
    ),
    rootCause:
      "JWT_SECRET was renamed in the infra config but the deploy manifest still used the old name, so the secret was undefined.",
    resolution:
      "Restored the variable name and added startup validation that refuses to boot with missing secrets.",
    engineer: "Priya Raman",
    daysAgo: 90,
    mins: 35,
    hash: "b07e2d4",
    msg: "fix(config): restore JWT_SECRET and fail fast on missing env vars",
    files: "deploy/manifest.yaml,src/config/validate.js",
  },
  {
    title: "Deadlock on inventory reservation",
    service: "inventory-service",
    severity: "SEV2",
    category: "Concurrency",
    trace: T(
      "sqlalchemy.exc.OperationalError: (psycopg2.errors.DeadlockDetected) deadlock detected",
      '  File "/srv/inventory/stock.py", line 88, in reserve_items',
      "    session.commit()",
      '  File "/srv/inventory/api.py", line 142, in post_reserve',
    ),
    rootCause:
      "Concurrent reservations locked the same SKU rows in different orders, causing circular waits.",
    resolution:
      "Sorted SKU ids before locking and added a bounded retry on deadlock errors.",
    engineer: "Sneha Iyer",
    daysAgo: 75,
    mins: 110,
    hash: "4a3d9e8",
    msg: "fix(stock): lock SKUs in sorted order and retry on deadlock",
    files: "inventory/stock.py",
  },
  {
    title: "Geocoding API rate limited (429)",
    service: "address-service",
    severity: "SEV3",
    category: "Third-party dependency",
    trace: T(
      "HTTPError: 429 Too Many Requests",
      "    at ApiClient.request (/app/src/clients/geoClient.ts:73:15)",
      "    at AddressValidator.validate (/app/src/validators/address.ts:34:20)",
    ),
    rootCause:
      "A retry loop with no backoff multiplied traffic to the third-party API once it started throttling.",
    resolution:
      "Added exponential backoff with jitter and cached validated addresses for 24 hours.",
    engineer: "Divya Nair",
    daysAgo: 60,
    mins: 80,
    hash: "d81f6a3",
    msg: "fix(geo): exponential backoff with jitter and address cache",
    files: "src/clients/geoClient.ts,src/validators/address.ts",
  },
  {
    title: "Report generation stack overflow",
    service: "reporting-service",
    severity: "SEV3",
    category: "Logic error",
    trace: T(
      "RangeError: Maximum call stack size exceeded",
      "    at flattenTree (/app/src/reports/tree.js:19:12)",
      "    at flattenTree (/app/src/reports/tree.js:21:14)",
      "    at flattenTree (/app/src/reports/tree.js:21:14)",
    ),
    rootCause:
      "A data import created a circular category reference, and the recursive flatten had no cycle detection.",
    resolution:
      "Added a visited-set guard and cleaned the circular rows from the data.",
    engineer: "Karthik Subramanian",
    daysAgo: 45,
    mins: 60,
    hash: "62c0b9f",
    msg: "fix(reports): detect cycles in flattenTree with visited set",
    files: "src/reports/tree.js",
  },
  {
    title: "Internal TLS certificate expired",
    service: "api-gateway",
    severity: "SEV1",
    category: "Configuration",
    trace: T(
      "Error: certificate has expired",
      "    at TLSSocket.onConnectSecure (node:_tls_wrap:1600:34)",
      "    at ProxyClient.forward (/app/src/proxy/client.js:52:18)",
    ),
    rootCause:
      "An internal service certificate expired because the renewal cron job had been failing silently.",
    resolution:
      "Renewed the certificate, fixed the cron job and added an alert 14 days before expiry.",
    engineer: "Priya Raman",
    daysAgo: 30,
    mins: 55,
    hash: "f19a4c7",
    msg: "chore(tls): fix cert renewal job and add expiry alert",
    files: "infra/cron/renew-certs.sh,infra/alerts.yaml",
  },
  {
    title: "Log shipper fails, disk full",
    service: "log-ingest",
    severity: "SEV2",
    category: "Resource exhaustion",
    trace: T(
      "Error: ENOSPC: no space left on device, write",
      "    at WriteStream.write (node:internal/fs/streams:412:11)",
      "    at LogShipper.flush (/app/src/logging/shipper.js:63:9)",
    ),
    rootCause:
      "Log rotation was disabled when the base image changed, so logs filled the disk.",
    resolution:
      "Restored logrotate with a size cap and added a disk usage alert at 80%.",
    engineer: "Arjun Mehta",
    daysAgo: 15,
    mins: 90,
    hash: "08e5d2b",
    msg: "fix(infra): re-enable logrotate with size cap and disk alert",
    files: "Dockerfile,infra/logrotate.conf",
  },
];

async function main() {
  console.log("Embedding incidents and commits...");
  const incidentVecs = await embedTexts(
    data.map((d) => `${d.title}\n${normalizeTrace(d.trace)}\n${d.rootCause}`),
  );
  const commitVecs = await embedTexts(data.map((d) => `${d.msg}\n${d.files}`));

  await sql`TRUNCATE postmortems, commits, incidents RESTART IDENTITY CASCADE`;

  for (let n = 0; n < data.length; n++) {
    const d = data[n];
    const occurred = new Date(Date.now() - d.daysAgo * 864e5);
    const resolved = new Date(occurred.getTime() + d.mins * 60000);
    const [row] = await sql`
      INSERT INTO incidents (title, service, severity, stack_trace, root_cause, root_cause_category, resolution, resolved_by, occurred_at, resolved_at, embedding)
      VALUES (${d.title}, ${d.service}, ${d.severity}, ${d.trace}, ${d.rootCause}, ${d.category}, ${d.resolution}, ${d.engineer},
              ${occurred.toISOString()}, ${resolved.toISOString()}, ${toVector(incidentVecs[n])}::vector)
      RETURNING id`;
    await sql`
      INSERT INTO commits (hash, author, message, files_changed, committed_at, incident_id, embedding)
      VALUES (${d.hash}, ${d.engineer}, ${d.msg}, string_to_array(${d.files}, ','), ${resolved.toISOString()}, ${row.id}, ${toVector(commitVecs[n])}::vector)`;
  }
  console.log(`Seeded ${data.length} incidents and ${data.length} commits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
