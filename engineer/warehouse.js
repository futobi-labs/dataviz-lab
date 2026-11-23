/* The Engineer's Eye: one synthetic warehouse shared by every page in this section.
   Load after d3 and lab.js. Exposes window.WH.

   A fictional distributor's Fabric-style medallion warehouse: 6 source systems,
   16 Bronze tables, 12 Silver, 13 Gold (7 dims, 6 facts). A year of nightly loads
   (2025-11-23 to 2026-11-22) is simulated with a list scheduler, so every start
   time, wait and cascade follows from dependencies, source arrival and slots.
   Everything is seeded: a reload is the same year. No real client, table or number. */
(function () {
  "use strict";
  const WH = {};
  WH.company = "Ridgeway Supply";            // fictional
  WH.first = "2025-11-23"; WH.last = "2026-11-22";
  WH.slaMinutes = 6 * 60;                   // Gold ready by 06:00
  WH.runStartMinutes = 60;                  // orchestrator kicks off at 01:00
  WH.slots = 4;                             // concurrent copy/notebook activities

  /* Source systems in fixed categorical order: source i wears --series-(i+1). */
  WH.sources = [
    { id: "erp", name: "ERP",            kind: "SQL database",  arrival: "ready at 00:45" },
    { id: "crm", name: "CRM",            kind: "REST API",      arrival: "extract ~01:05, sometimes hours late" },
    { id: "wms", name: "Warehouse mgmt", kind: "SFTP drop",     arrival: "file ~01:30, occasionally after 03:00" },
    { id: "web", name: "Web events",     kind: "Event stream",  arrival: "continuous" },
    { id: "gl",  name: "General ledger", kind: "SQL database",  arrival: "ready 01:00; month-end volume x5" },
    { id: "hr",  name: "HR",             kind: "Weekly flat file", arrival: "Sundays only" },
  ];
  WH.sourceIndex = Object.fromEntries(WH.sources.map((s, i) => [s.id, i]));
  WH.sourceColor = (id) => `var(--series-${WH.sourceIndex[id] + 1})`;
  WH.layers = ["bronze", "silver", "gold"];

  /* Column spec: "name" inherits from the same-named column of the first dep that has it.
     "name<-a,b.c" lists explicit upstream columns; a bare name resolves to the first dep that has it. */
  const T = [
    // ---------------- Bronze: raw, append-only landings ----------------
    ["brz_erp_orders", "bronze", "erp", [], 2.4e6, 2600, 4,
      "order_id order_date customer_id ship_to_id sales_rep_id channel_code status currency order_total _ingested_at"],
    ["brz_erp_order_lines", "bronze", "erp", [], 9.1e6, 9800, 7,
      "order_id line_no item_id qty unit_price discount_pct warehouse_id _ingested_at"],
    ["brz_erp_items", "bronze", "erp", [], 38000, "full", 2,
      "item_id sku item_desc category subcategory unit_of_measure list_price unit_cost vendor_id private_label_flag _ingested_at"],
    ["brz_erp_customers", "bronze", "erp", [], 61000, "full", 2,
      "customer_id cust_name segment region city state created_date _ingested_at"],
    ["brz_erp_invoices", "bronze", "erp", [], 2.2e6, 2400, 3,
      "invoice_id order_id invoice_date due_date amount paid_date _ingested_at"],
    ["brz_crm_accounts", "bronze", "crm", [], 74000, "full", 6,
      "account_id erp_customer_id account_name industry employee_band annual_revenue_band owner_id _ingested_at"],
    ["brz_crm_contacts", "bronze", "crm", [], 310000, 900, 4,
      "contact_id account_id title email_domain created_at _ingested_at"],
    ["brz_crm_opportunities", "bronze", "crm", [], 520000, 1300, 5,
      "opp_id account_id stage amount close_date owner_id forecast_category _ingested_at"],
    ["brz_wms_shipments", "bronze", "wms", [], 1.9e6, 2300, 5,
      "shipment_id order_id warehouse_id carrier shipped_at delivered_at cartons weight_lb _source_file"],
    ["brz_wms_inventory_snap", "bronze", "wms", [], 4.4e7, 120000, 14,
      "snap_date warehouse_id item_id on_hand allocated on_order in_transit _source_file"],
    ["brz_wms_locations", "bronze", "wms", [], 14, "full", 1,
      "warehouse_id wh_name city state sq_ft opened_date _source_file"],
    ["brz_web_events", "bronze", "web", [], 6.3e8, 1.7e6, 22,
      "event_id session_id event_ts event_type page_path item_id customer_id referrer_campaign _ingested_at"],
    ["brz_web_sessions", "bronze", "web", [], 4.1e7, 110000, 6,
      "session_id started_at device referrer landing_page customer_id _ingested_at"],
    ["brz_gl_journal", "bronze", "gl", [], 1.6e7, 42000, 6,
      "journal_id line_id account_no posting_date debit credit cost_center source_system _ingested_at"],
    ["brz_gl_accounts", "bronze", "gl", [], 1900, "full", 1,
      "account_no account_name account_type rollup_l1 rollup_l2 _ingested_at"],
    ["brz_hr_employees", "bronze", "hr", [], 1150, "full", 1,
      "employee_id full_name_hash title department region hire_date manager_id _source_file"],

    // ---------------- Silver: cleaned, typed, conformed ----------------
    ["slv_orders", "silver", null, ["brz_erp_orders"], 2.4e6, 2600, 5,
      "order_id order_date customer_id sales_rep_id channel_code status fx_rate<-currency order_total_usd<-order_total,currency"],
    ["slv_order_lines", "silver", null, ["brz_erp_order_lines"], 9.1e6, 9800, 9,
      "order_id line_no item_id qty unit_price discount_pct net_amount<-qty,unit_price,discount_pct warehouse_id"],
    ["slv_items", "silver", null, ["brz_erp_items"], 38000, "full", 2,
      "item_id sku item_desc category subcategory unit_of_measure list_price unit_cost is_private_label<-private_label_flag"],
    ["slv_customers", "silver", null, ["brz_erp_customers", "brz_crm_accounts"], 61000, "full", 5,
      "customer_id cust_name segment region city state industry employee_band annual_revenue_band account_owner_id<-brz_crm_accounts.owner_id"],
    ["slv_invoices", "silver", null, ["brz_erp_invoices"], 2.2e6, 2400, 3,
      "invoice_id order_id invoice_date due_date amount paid_date days_to_pay<-invoice_date,paid_date"],
    ["slv_opportunities", "silver", null, ["brz_crm_opportunities"], 520000, 1300, 3,
      "opp_id account_id stage amount close_date owner_id forecast_category"],
    ["slv_shipments", "silver", null, ["brz_wms_shipments"], 1.9e6, 2300, 4,
      "shipment_id order_id warehouse_id carrier shipped_at delivered_at transit_hours<-shipped_at,delivered_at cartons weight_lb"],
    ["slv_inventory", "silver", null, ["brz_wms_inventory_snap"], 4.4e7, 120000, 12,
      "snap_date warehouse_id item_id on_hand allocated available<-on_hand,allocated in_transit"],
    ["slv_warehouses", "silver", null, ["brz_wms_locations"], 14, "full", 1,
      "warehouse_id wh_name city state sq_ft"],
    ["slv_sessions", "silver", null, ["brz_web_sessions", "brz_web_events"], 4.1e7, 110000, 26,
      "session_id started_at device referrer customer_id referrer_campaign<-brz_web_events.referrer_campaign page_views<-brz_web_events.event_id add_to_carts<-brz_web_events.event_type"],
    ["slv_gl_entries", "silver", null, ["brz_gl_journal", "brz_gl_accounts"], 1.6e7, 42000, 5,
      "journal_id line_id account_no posting_date amount<-debit,credit cost_center source_system account_type<-brz_gl_accounts.account_type"],
    ["slv_employees", "silver", null, ["brz_hr_employees"], 1150, "full", 1,
      "employee_id title department region hire_date manager_id"],

    // ---------------- Gold: dimensional model ----------------
    ["dim_date", "gold", null, [], 7305, "full", 1,
      "date_key date week month quarter fiscal_period fiscal_week is_business_day"],
    ["dim_customer", "gold", null, ["slv_customers"], 61000, "full", 2,
      "customer_key<-customer_id customer_id cust_name customer_segment<-segment region industry employee_band annual_revenue_band"],
    ["dim_product", "gold", null, ["slv_items"], 38000, "full", 2,
      "product_key<-item_id sku item_desc category subcategory is_private_label"],
    ["dim_warehouse", "gold", null, ["slv_warehouses"], 14, "full", 1,
      "warehouse_key<-warehouse_id wh_name city state"],
    ["dim_employee", "gold", null, ["slv_employees"], 1150, "full", 1,
      "employee_key<-employee_id title department region"],
    ["dim_channel", "gold", null, ["slv_orders"], 6, "full", 1,
      "channel_key<-channel_code channel_name<-channel_code"],
    ["dim_gl_account", "gold", null, ["slv_gl_entries"], 1900, "full", 1,
      "account_key<-account_no account_type"],
    ["fct_sales", "gold", null, ["slv_orders", "slv_order_lines", "slv_items", "dim_date", "dim_customer", "dim_product", "dim_employee", "dim_channel", "dim_warehouse"], 9.1e6, 9800, 11,
      "date_key<-slv_orders.order_date,dim_date.date_key customer_key<-slv_orders.customer_id,dim_customer.customer_key product_key<-slv_order_lines.item_id,dim_product.product_key employee_key<-slv_orders.sales_rep_id,dim_employee.employee_key channel_key<-slv_orders.channel_code,dim_channel.channel_key warehouse_key<-slv_order_lines.warehouse_id,dim_warehouse.warehouse_key order_id<-slv_orders.order_id line_no qty net_amount discount_amount<-slv_order_lines.unit_price,slv_order_lines.discount_pct,slv_order_lines.qty cost_amount<-slv_order_lines.qty,slv_items.unit_cost"],
    ["fct_shipments", "gold", null, ["slv_shipments", "dim_date", "dim_warehouse", "dim_customer", "slv_orders"], 1.9e6, 2300, 4,
      "date_key<-slv_shipments.shipped_at,dim_date.date_key warehouse_key<-slv_shipments.warehouse_id,dim_warehouse.warehouse_key customer_key<-slv_orders.customer_id,dim_customer.customer_key shipment_id cartons weight_lb transit_hours"],
    ["fct_inventory_daily", "gold", null, ["slv_inventory", "dim_date", "dim_product", "dim_warehouse"], 4.4e7, 120000, 16,
      "date_key<-slv_inventory.snap_date,dim_date.date_key product_key<-slv_inventory.item_id,dim_product.product_key warehouse_key<-slv_inventory.warehouse_id,dim_warehouse.warehouse_key on_hand available in_transit"],
    ["fct_web_sessions", "gold", null, ["slv_sessions", "dim_date", "dim_customer"], 4.1e7, 110000, 9,
      "date_key<-slv_sessions.started_at,dim_date.date_key customer_key<-slv_sessions.customer_id,dim_customer.customer_key session_id device referrer_campaign page_views add_to_carts"],
    ["fct_gl", "gold", null, ["slv_gl_entries", "dim_date", "dim_gl_account"], 1.6e7, 42000, 6,
      "date_key<-slv_gl_entries.posting_date,dim_date.date_key account_key<-slv_gl_entries.account_no,dim_gl_account.account_key amount cost_center"],
    ["fct_receivables", "gold", null, ["slv_invoices", "dim_date", "dim_customer", "slv_orders"], 2.2e6, 2400, 3,
      "date_key<-slv_invoices.invoice_date,dim_date.date_key customer_key<-slv_orders.customer_id,dim_customer.customer_key invoice_id amount days_to_pay"],
    ["fct_pipeline", "gold", null, ["slv_opportunities", "dim_date", "dim_customer", "dim_employee"], 520000, 1300, 3,
      "date_key<-slv_opportunities.close_date,dim_date.date_key customer_key<-slv_opportunities.account_id,dim_customer.customer_key employee_key<-slv_opportunities.owner_id,dim_employee.employee_key stage amount forecast_category"],
  ];

  WH.tables = T.map(([id, layer, source, deps, size, nightly, minutes, cols]) => ({
    id, layer, source, deps, size, nightly, baseMinutes: minutes,
    kind: id.startsWith("fct_") ? "fact" : id.startsWith("dim_") ? "dim" : layer,
    columns: cols.split(/\s+/).map((c) => { const [name, from] = c.split("<-"); return { name, spec: from || null }; }),
  }));
  WH.byId = Object.fromEntries(WH.tables.map((t) => [t.id, t]));

  // Silver and Gold inherit their source systems from upstream (a set, for lineage coloring).
  function sourcesOf(t) {
    if (t._sources) return t._sources;
    const s = new Set(t.source ? [t.source] : []);
    t.deps.forEach((d) => sourcesOf(WH.byId[d]).forEach((x) => s.add(x)));
    return (t._sources = s);
  }
  WH.tables.forEach((t) => { t.sources = [...sourcesOf(t)]; });
  WH.tables.forEach((t) => { t.downstream = WH.tables.filter((u) => u.deps.includes(t.id)).map((u) => u.id); });

  /* Column-level lineage. WH.columnEdges: [{from:"tbl.col", to:"tbl.col"}]. */
  WH.columnEdges = [];
  WH.tables.forEach((t) => {
    t.columns.forEach((c) => {
      if (c.name.startsWith("_")) return;
      const refs = c.spec ? c.spec.split(",") : [c.name];
      refs.forEach((r) => {
        let tbl, col;
        if (r.includes(".")) [tbl, col] = r.split(".");
        else { tbl = t.deps.find((d) => WH.byId[d].columns.some((x) => x.name === r)); col = r; }
        if (tbl && WH.byId[tbl] && WH.byId[tbl].columns.some((x) => x.name === col))
          WH.columnEdges.push({ from: tbl + "." + col, to: t.id + "." + c.name });
      });
    });
  });
  /** All upstream "tbl.col" ids of a column, transitively, with depth. */
  WH.upstreamColumns = function (id) {
    const out = new Map(), q = [[id, 0]];
    while (q.length) {
      const [cur, d] = q.shift();
      WH.columnEdges.filter((e) => e.to === cur).forEach((e) => { if (!out.has(e.from)) { out.set(e.from, d + 1); q.push([e.from, d + 1]); } });
    }
    return out;
  };
  WH.downstreamColumns = function (id) {
    const out = new Map(), q = [[id, 0]];
    while (q.length) {
      const [cur, d] = q.shift();
      WH.columnEdges.filter((e) => e.from === cur).forEach((e) => { if (!out.has(e.to)) { out.set(e.to, d + 1); q.push([e.to, d + 1]); } });
    }
    return out;
  };

  /* Topological order (deps before dependents). */
  WH.order = (function () {
    const seen = new Set(), out = [];
    const visit = (id) => { if (seen.has(id)) return; seen.add(id); WH.byId[id].deps.forEach(visit); out.push(id); };
    WH.tables.forEach((t) => visit(t.id));
    return out;
  })();

  /* ---------------- calendar helpers ---------------- */
  const parse = d3.utcParse("%Y-%m-%d"), fmtDay = d3.utcFormat("%Y-%m-%d");
  WH.parse = parse; WH.fmtDay = fmtDay;
  WH.days = d3.utcDay.range(parse(WH.first), d3.utcDay.offset(parse(WH.last), 1));
  WH.clock = (m) => { if (m == null) return ""; const h = Math.floor(m / 60), mm = Math.round(m % 60); return String(h).padStart(2, "0") + ":" + String(mm === 60 ? 0 : mm).padStart(2, "0"); };
  const inRange = (d, a, b) => d >= parse(a) && d <= parse(b);

  /* ---------------- schema drift ----------------
     Every column in the final schemas above exists today; events record how they got there. */
  WH.schemaEvents = [
    ["2025-12-03", "brz_web_events", "add", "referrer_campaign", "Marketing started tagging campaign links"],
    ["2025-12-15", "brz_gl_journal", "add", "source_system", "GL began tagging subledger origin"],
    ["2025-12-17", "slv_sessions", "add", "referrer_campaign", "Conformed two weeks after Bronze"],
    ["2026-01-07", "fct_web_sessions", "add", "referrer_campaign", "Exposed to the semantic model"],
    ["2026-01-12", "slv_gl_entries", "add", "source_system", ""],
    ["2026-01-20", "brz_crm_accounts", "add", "annual_revenue_band", "New CRM picklist"],
    ["2026-02-03", "slv_customers", "add", "annual_revenue_band", ""],
    ["2026-02-10", "brz_erp_items", "rename", "unit_of_measure", "Unannounced ERP upgrade renamed uom; load failed two nights", "uom"],
    ["2026-02-18", "dim_customer", "add", "annual_revenue_band", ""],
    ["2026-03-02", "brz_erp_orders", "type", "order_total", "decimal(12,2) to decimal(18,4) for multi-currency"],
    ["2026-03-16", "slv_orders", "add", "fx_rate", "Multi-currency conversion moved into Silver"],
    ["2026-04-06", "brz_wms_shipments", "add", "tracking_url", "Vendor added a column nobody asked for"],
    ["2026-04-14", "brz_hr_employees", "drop", "home_zip", "Dropped at the source for privacy"],
    ["2026-04-20", "brz_wms_shipments", "drop", "tracking_url", "Vendor removed it again"],
    ["2026-04-21", "brz_erp_items", "add", "private_label_flag", "Private-label program launch"],
    ["2026-04-28", "slv_items", "add", "is_private_label", "Typed to boolean"],
    ["2026-05-04", "dim_product", "add", "is_private_label", ""],
    ["2026-06-22", "fct_sales", "add", "discount_amount", "Finance asked for discount dollars, not percent"],
    ["2026-07-13", "brz_crm_opportunities", "add", "forecast_category", ""],
    ["2026-07-27", "slv_opportunities", "add", "forecast_category", ""],
    ["2026-08-03", "dim_date", "add", "fiscal_week", "FP&A moved to a 4-4-5 calendar"],
    ["2026-08-10", "fct_pipeline", "add", "forecast_category", ""],
    ["2026-08-24", "brz_web_events", "type", "event_ts", "string to timestamp at the stream"],
    ["2026-09-08", "brz_wms_inventory_snap", "add", "in_transit", ""],
    ["2026-09-22", "slv_inventory", "add", "in_transit", ""],
    ["2026-10-05", "fct_inventory_daily", "add", "in_transit", ""],
    ["2026-10-19", "brz_erp_customers", "drop", "credit_limit", "Moved to the credit system"],
    ["2026-11-02", "dim_customer", "rename", "customer_segment", "Renamed for the semantic model", "segment"],
  ].map(([date, table, change, column, note, oldName]) => ({ date, day: parse(date), table, change, column, note, oldName: oldName || null }));

  /** Column count of a table at the end of a given day (Date or "YYYY-MM-DD"). */
  WH.columnCountOn = function (tableId, day) {
    const d = typeof day === "string" ? parse(day) : day;
    let n = WH.byId[tableId].columns.length;
    WH.schemaEvents.filter((e) => e.table === tableId && e.day > d).forEach((e) => {
      if (e.change === "add") n -= 1; else if (e.change === "drop") n += 1;
    });
    return n;
  };

  /* ---------------- the year of nightly runs ---------------- */
  // Named incidents: the stories hidden in the logs. Pages may reference them.
  WH.incidents = [
    { id: "bf",      from: "2025-11-29", to: "2025-12-02", title: "Black Friday weekend", note: "Order and web volumes 2.5 to 4 times normal; loads ran long and missed the 06:00 SLA once." },
    { id: "uom",     from: "2026-02-10", to: "2026-02-11", title: "Unannounced ERP rename", note: "uom became unit_of_measure. brz_erp_items failed both retries two nights running; everything downstream of items was skipped." },
    { id: "orphans", from: "2026-03-01", to: "2026-05-31", title: "Orphan CRM accounts", note: "CRM accounts with no ERP customer id leaked into slv_customers. Referential tests warned most nights until a match rule shipped June 1." },
    { id: "throttle",from: "2026-06-01", to: "2026-06-14", title: "Capacity throttling", note: "Shared capacity was over its limit. Every activity ran about 1.8 times longer; SLA missed most of the fortnight." },
    { id: "bots",    from: "2026-09-15", to: "2026-09-17", title: "Bot traffic", note: "A scraper quadrupled web events. Volume anomaly tests failed and fct_web_sessions was published with bad numbers on the 15th." },
    { id: "crmapi",  from: "2026-10-26", to: "2026-10-30", title: "CRM API rate limits", note: "The vendor cut the API rate limit. CRM extracts finished between 03:30 and 05:00 all week." },
  ].map((i) => ({ ...i, fromDay: parse(i.from), toDay: parse(i.to) }));
  WH.incidentOn = (d) => WH.incidents.filter((i) => d >= i.fromDay && d <= i.toDay);

  let _runs = null;
  /** WH.runs(): one object per night, oldest first.
      run = { date:"YYYY-MM-DD", day:Date, start, end (minutes after midnight; end may pass 360),
              slaMet, status:"succeeded"|"partial"|"failed", incidents:[...],
              tasks:[{ table, layer, source, status:"succeeded"|"retried"|"failed"|"upstream_failed"|"no_new_file",
                       start, end, minutes, rows, attempts, waitedOn:"source"|"dependency"|"slot"|null, readyAt, arrival }] } */
  WH.runs = function () {
    if (_runs) return _runs;
    const rand = Lab.rng(1979), N = (m, s) => m + s * Lab.randn(rand);
    const lognorm = (med, sigma) => med * Math.exp(sigma * Lab.randn(rand));
    _runs = WH.days.map((day, di) => {
      const date = fmtDay(day);
      const biz = d3.utcDay.offset(day, -1);              // the business day being loaded
      const dow = biz.getUTCDay();                        // 0 Sun
      const weekendBiz = dow === 0 || dow === 6;
      const growth = 0.8 + 0.2 * (di / WH.days.length);   // ~25% growth across the year
      const monthDay = day.getUTCDate();
      const monthEnd = monthDay >= 1 && monthDay <= 3;
      const inc = (id) => WH.incidentOn(day).some((i) => i.id === id);

      // source arrival, minutes after midnight
      const arrival = {
        erp: 45,
        crm: inc("crmapi") ? 210 + 80 * rand() : (rand() < 0.07 ? 95 + lognorm(70, 0.5) : 60 + 10 * rand()),
        wms: rand() < 0.04 ? 185 + 60 * rand() : N(90, 12),
        web: 0,
        gl: 60,
        hr: 60,
      };
      const hrFileToday = day.getUTCDay() === 0;

      const slowdown = inc("throttle") ? 1.8 : 1;
      const tasks = new Map();
      WH.order.forEach((id) => {
        const t = WH.byId[id];
        let volume = 1;
        if (["erp", "web", "wms"].some((s) => t.sources.includes(s)) && weekendBiz) volume *= 0.38;
        if (t.sources.includes("gl") && monthEnd) volume *= 5;
        if (inc("bf") && (t.sources.includes("erp") || t.sources.includes("web"))) volume *= 2.5 + 1.5 * rand();
        if (inc("bots") && t.sources.includes("web")) volume *= 4;
        const rows = t.nightly === "full" ? Math.round(t.size * (0.9 + 0.1 * growth)) : Math.round(t.nightly * growth * volume * (0.92 + 0.16 * rand()));
        const volFactor = t.nightly === "full" ? 1 : Math.pow(growth * volume, 0.75);
        const minutes = Math.max(0.6, 2.6 * t.baseMinutes * volFactor * slowdown * Math.exp(0.18 * Lab.randn(rand)));
        tasks.set(id, { table: id, layer: t.layer, source: t.source, rows, minutes, attempts: 1, status: "succeeded",
          start: null, end: null, readyAt: null, waitedOn: null, arrival: t.source ? arrival[t.source] : null });
      });

      // failures
      const fail = (id, kind) => { const k = tasks.get(id); k.status = kind; };
      if (inc("uom")) fail("brz_erp_items", "failed");
      WH.order.forEach((id) => {
        const k = tasks.get(id);
        if (k.status !== "succeeded") return;
        if (rand() < 0.006) { k.status = rand() < 0.82 ? "retried" : "failed"; }
      });
      if (!hrFileToday) { const k = tasks.get("brz_hr_employees"); k.status = "no_new_file"; k.rows = 0; k.minutes = 0.4; }

      // list scheduler with WH.slots workers
      const free = Array(WH.slots).fill(WH.runStartMinutes);
      const done = new Set();
      const pending = new Set(WH.order);
      while (pending.size) {
        let best = null, bestReady = Infinity, bestWait = null;
        pending.forEach((id) => {
          const t = WH.byId[id];
          if (!t.deps.every((d) => done.has(d))) return;
          const k = tasks.get(id);
          const depEnd = d3.max(t.deps, (d) => tasks.get(d).end ?? WH.runStartMinutes) ?? WH.runStartMinutes;
          const src = k.arrival ?? 0;
          const ready = Math.max(WH.runStartMinutes, depEnd, src);
          const wait = ready === WH.runStartMinutes ? null : src >= depEnd ? "source" : "dependency";
          if (ready < bestReady || (ready === bestReady && WH.order.indexOf(id) < WH.order.indexOf(best))) { best = id; bestReady = ready; bestWait = wait; }
        });
        const k = tasks.get(best), t = WH.byId[best];
        pending.delete(best); done.add(best);
        if (t.deps.some((d) => ["failed", "upstream_failed"].includes(tasks.get(d).status))) {
          k.status = "upstream_failed"; k.rows = 0; k.minutes = 0; continue;
        }
        const w = free.indexOf(d3.min(free));
        k.readyAt = bestReady;
        k.start = Math.max(bestReady, free[w]);
        k.waitedOn = free[w] > bestReady + 0.5 ? "slot" : bestWait;
        let m = k.minutes;
        if (k.status === "retried") { m = m * (0.3 + 0.5 * rand()) + 10 + m; k.attempts = 2; }
        if (k.status === "failed") { m = m * (0.2 + 0.3 * rand()) * 3 + 20; k.attempts = 3; k.rows = 0; }
        k.minutes = m; k.end = k.start + m; free[w] = k.end;
      }
      const list = WH.order.map((id) => tasks.get(id));
      const ran = list.filter((k) => k.end != null);
      const gold = list.filter((k) => k.layer === "gold" && k.end != null);
      const end = d3.max(ran, (k) => k.end);
      const goldEnd = d3.max(gold, (k) => k.end) ?? end;
      const broken = list.filter((k) => k.status === "failed" || k.status === "upstream_failed").length;
      return { date, day, index: di, start: WH.runStartMinutes, end, goldEnd, slaMet: goldEnd <= WH.slaMinutes && broken === 0,
        status: broken === 0 ? "succeeded" : list.some((k) => k.layer === "gold" && k.status === "succeeded") ? "partial" : "failed",
        rowsLoaded: d3.sum(list, (k) => k.rows), retries: list.filter((k) => k.status === "retried").length, broken,
        incidents: WH.incidentOn(day), tasks: list, arrival };
    });
    return _runs;
  };

  /** Critical path of a run: the chain of tasks that set its finish time (Gold end), last first. */
  WH.criticalPath = function (run) {
    const by = Object.fromEntries(run.tasks.map((k) => [k.table, k]));
    let cur = run.tasks.filter((k) => k.layer === "gold" && k.end != null).sort((a, b) => b.end - a.end)[0];
    const path = [];
    while (cur) {
      path.push(cur.table);
      const t = WH.byId[cur.table];
      const prev = t.deps.map((d) => by[d]).filter((k) => k.end != null && Math.abs(k.end - cur.readyAt) < 0.01)[0];
      cur = cur.waitedOn === "dependency" ? prev : null;
    }
    return path;
  };

  /* ---------------- data quality ----------------
     Tests per table, the way a dbt or notebook test suite would define them. */
  WH.testsFor = function (id) {
    const t = WH.byId[id], out = [];
    const pk = t.columns[0].name;
    out.push({ test: "not_null", column: pk });
    if (t.kind !== "fact") out.push({ test: "unique", column: pk });
    if (t.layer === "bronze") out.push({ test: "freshness", column: t.columns[t.columns.length - 1].name });
    if (t.nightly !== "full") out.push({ test: "volume", column: "*" });
    if (t.kind === "fact") t.columns.filter((c) => c.name.endsWith("_key")).forEach((c) => out.push({ test: "relationships", column: c.name }));
    if (id === "slv_customers") out.push({ test: "relationships", column: "customer_id" });
    return out;
  };
  let _dq = null;
  /** WH.dq(): per night, per table, test outcomes.
      [{ date, day, pass, warn, fail, results:[{table, test, column, outcome:"pass"|"warn"|"fail"|"not_run", note}] }] */
  WH.dq = function () {
    if (_dq) return _dq;
    const runs = WH.runs(), rand = Lab.rng(5150);
    _dq = runs.map((run, ri) => {
      const results = [];
      run.tasks.forEach((k) => {
        WH.testsFor(k.table).forEach((tt) => {
          let outcome = "pass", note = "";
          if (k.status === "failed" || k.status === "upstream_failed") { outcome = "not_run"; note = "Table not refreshed"; }
          else if (tt.test === "freshness" && k.arrival != null && k.arrival > 180) { outcome = k.arrival > 270 ? "fail" : "warn"; note = "Source arrived " + WH.clock(k.arrival); }
          else if (tt.test === "volume" && k.status !== "no_new_file") {
            // same weekday, prior four weeks
            const prior = [7, 14, 21, 28].map((o) => runs[ri - o]).filter(Boolean).map((r) => r.tasks.find((x) => x.table === k.table).rows).filter((v) => v > 0);
            if (prior.length >= 2) {
              const ratio = k.rows / d3.median(prior);
              if (ratio > 3 || ratio < 0.33) { outcome = "fail"; note = "Rows " + d3.format(".1f")(ratio) + "x the same weekday median"; }
              else if (ratio > 1.8 || ratio < 0.55) { outcome = "warn"; note = "Rows " + d3.format(".1f")(ratio) + "x the same weekday median"; }
            }
          }
          else if (tt.test === "relationships" && k.table === "slv_customers" && run.incidents.some((i) => i.id === "orphans") && rand() < 0.7) { outcome = "warn"; note = Math.round(40 + 260 * rand()) + " CRM accounts with no ERP customer"; }
          else if (tt.test === "relationships" && k.table.startsWith("fct_") && tt.column === "customer_key" && run.incidents.some((i) => i.id === "orphans") && rand() < 0.25) { outcome = "warn"; note = "Unknown-member rows above 0.1%"; }
          else if (rand() < 0.004) { outcome = rand() < 0.3 ? "fail" : "warn"; note = tt.test === "not_null" ? "Null keys in late-arriving rows" : tt.test === "unique" ? "Duplicate keys from a source replay" : "Threshold crossed"; }
          results.push({ table: k.table, layer: k.layer, test: tt.test, column: tt.column, outcome, note });
        });
      });
      const c = d3.rollup(results, (v) => v.length, (r) => r.outcome);
      return { date: run.date, day: run.day, pass: c.get("pass") || 0, warn: c.get("warn") || 0, fail: c.get("fail") || 0, notRun: c.get("not_run") || 0, results };
    });
    return _dq;
  };

  WH.fmtRows = (v) => v >= 1e6 ? d3.format(".1f")(v / 1e6) + "M" : v >= 1e3 ? d3.format(".0f")(v / 1e3) + "K" : d3.format(",")(v);
  WH.source = "Synthetic. A fictional distributor's medallion warehouse and one simulated year of nightly loads (seeded, engineer/warehouse.js). No client names, tables or numbers.";

  window.WH = WH;
})();
