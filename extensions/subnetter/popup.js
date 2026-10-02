'use strict';

/* global IpCalc, OUI_VENDORS */

const $ = (id) => document.getElementById(id);

const appTitle = document.querySelector('.app-header h1');
const toolChooser = $('toolChooser');
const subnetterTool = $('subnetterTool');
const macTool = $('macTool');
const backToChooserBtn = $('backToChooser');
const advancedControl = $('advancedToggle').closest('label');
const openTabBtn = $('openTab');

const ipInput = $('ipInput');
const errorMsg = $('errorMsg');
const resultCard = $('resultCard');
const resultRows = $('resultRows');
const advancedToggle = $('advancedToggle');
const bitBar = $('bitBar');
const bitBarSegments = $('bitBarSegments');
const bitBarLabel = $('bitBarLabel');
const splitCard = $('splitCard');
const splitPrefixSel = $('splitPrefix');
const splitCount = $('splitCount');
const splitWarning = $('splitWarning');
const splitList = $('splitList');
const specialRangesCard = $('specialRangesCard');
const specialRangesBody = $('specialRangesBody');

const showHostsToggle = $('showHosts');
const macInput = $('macInput');
const macErrorMsg = $('macErrorMsg');
const macResultCard = $('macResultCard');
const macRows = $('macRows');
const macVendorInfo = $('macVendorInfo');

const storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.local : null;
const params = new URLSearchParams(location.search);
const isTab = params.get('view') === 'tab';
const initialTool = params.get('tool');

const LABEL_W = 11; // "Broadcast:" + padding, ipcalc style
const VALUE_W = 22;
const MAX_HOST_COLS = 8; // beyond this the hosts table falls back to min/max

let state = null;        // { ip, prefix, format } of the last valid parse
let currentSubnets = []; // subnets of the last split render
let currentTool = 'chooser';

const MAC_FORMATS = [
  { label: 'xx:xx:xx:xx:xx:xx', format: (m) => m.match(/../g).join(':') },
  { label: 'xx-xx-xx-xx-xx-xx', format: (m) => m.match(/../g).join('-') },
  { label: 'xxxx.xxxx.xxxx', format: (m) => m.match(/.{4}/g).join('.') },
  { label: 'xxxxxxxxxxxx', format: (m) => m },
  { label: 'xxxxxx:xxxxxx', format: (m) => m.slice(0, 6) + ':' + m.slice(6) },
  { label: 'xxxxxx-xxxxxx', format: (m) => m.slice(0, 6) + '-' + m.slice(6) },
];

const SPECIAL_RANGE_GROUPS = [
  {
    title: 'Private networks (RFC 1918)',
    ranges: [
      ['10.0.0.0/8', 'Private-use network'],
      ['172.16.0.0/12', 'Private-use network'],
      ['192.168.0.0/16', 'Private-use network'],
    ],
  },
  {
    title: 'Documentation and examples',
    ranges: [
      ['192.0.2.0/24', 'TEST-NET-1 (RFC 5737)'],
      ['198.51.100.0/24', 'TEST-NET-2 (RFC 5737)'],
      ['203.0.113.0/24', 'TEST-NET-3 (RFC 5737)'],
      ['233.252.0.0/24', 'MCAST-TEST-NET (RFC 5771)'],
    ],
  },
  {
    title: 'Multicast',
    ranges: [
      ['224.0.0.0/4', 'IPv4 multicast'],
      ['224.0.0.0/24', 'Local network control block'],
      ['224.0.1.0/24', 'Internetwork control block'],
      ['239.0.0.0/8', 'Administratively scoped multicast'],
    ],
  },
  {
    title: 'Other special-purpose ranges',
    ranges: [
      ['0.0.0.0/8', 'Current network / source-only special use'],
      ['0.0.0.0/32', 'Unspecified address'],
      ['100.64.0.0/10', 'Carrier-grade NAT shared address space'],
      ['127.0.0.0/8', 'Loopback'],
      ['169.254.0.0/16', 'Link-local autoconfiguration'],
      ['192.0.0.0/24', 'IETF protocol assignments'],
      ['192.0.0.8/32', 'IPv4 dummy address'],
      ['192.0.0.9/32', 'Port Control Protocol anycast'],
      ['192.0.0.10/32', 'TURN anycast'],
      ['192.0.0.170/32', 'NAT64/DNS64 discovery'],
      ['192.0.0.171/32', 'NAT64/DNS64 discovery'],
      ['192.31.196.0/24', 'AS112-v4'],
      ['192.52.193.0/24', 'Automatic Multicast Tunneling'],
      ['192.88.99.0/24', 'Deprecated 6to4 relay anycast'],
      ['192.175.48.0/24', 'Direct Delegation AS112 service'],
      ['198.18.0.0/15', 'Benchmark testing'],
      ['240.0.0.0/4', 'Reserved for future use'],
      ['255.255.255.255/32', 'Limited broadcast'],
    ],
  },
];

/* ---------- clipboard ---------- */

function copyText(text, el) {
  navigator.clipboard.writeText(text).then(() => {
    if (!el) return;
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 500);
  });
}

/* ---------- tool switching ---------- */

function showTool(tool) {
  currentTool = tool;
  const showSubnetter = tool === 'subnetter';
  const showMac = tool === 'mac';

  toolChooser.hidden = tool !== 'chooser';
  subnetterTool.hidden = !showSubnetter;
  macTool.hidden = !showMac;
  backToChooserBtn.hidden = tool === 'chooser';
  advancedControl.hidden = !showSubnetter;
  openTabBtn.hidden = !showSubnetter || isTab;
  appTitle.textContent = showSubnetter ? 'Subnetter' : (showMac ? 'MAC Converter' : 'Tools');
  document.body.classList.toggle('advanced', showSubnetter && advancedToggle.checked);

  if (showSubnetter) {
    ipInput.focus();
    ipInput.select();
  } else if (showMac) {
    macInput.focus();
    macInput.select();
  }
}

/* ---------- rendering ---------- */

function binarySpans(ip, prefix) {
  const bin = IpCalc.toBinary(ip, prefix);
  const frag = document.createDocumentFragment();
  let bitIndex = 0;
  let run = '';
  let runIsNet = prefix > 0;
  const flush = () => {
    if (!run) return;
    const span = document.createElement('span');
    span.className = runIsNet ? 'b-net' : 'b-host';
    span.textContent = run;
    frag.appendChild(span);
    run = '';
  };
  for (const ch of bin) {
    const isNet = bitIndex < prefix;
    if (isNet !== runIsNet) { flush(); runIsNet = isNet; }
    run += ch;
    if (ch === '0' || ch === '1') bitIndex++;
  }
  flush();
  return frag;
}

function makeRow({ label, value, copy, suffix, note, bin, binPrefix }) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('span');
  lab.className = 'label';
  lab.textContent = label;
  row.appendChild(lab);

  if (copy !== undefined) {
    const btn = document.createElement('button');
    btn.className = 'value';
    btn.title = 'Click to copy';
    btn.textContent = value;
    btn.addEventListener('click', () => copyText(copy, btn));
    row.appendChild(btn);
  } else {
    const span = document.createElement('span');
    span.textContent = value;
    row.appendChild(span);
  }
  if (suffix) {
    const s = document.createElement('span');
    s.className = 'suffix';
    s.textContent = ' ' + suffix;
    row.appendChild(s);
  }
  if (note) {
    const n = document.createElement('span');
    n.className = 'note';
    n.textContent = '  ' + note;
    row.appendChild(n);
  }
  if (bin !== undefined) {
    const b = document.createElement('span');
    b.className = 'bin';
    b.appendChild(binarySpans(bin, binPrefix));
    row.appendChild(b);
  }
  return row;
}

function sepRow(arrow) {
  const row = document.createElement('div');
  row.className = arrow ? 'row arrow' : 'row sep';
  if (arrow) row.textContent = '=>';
  return row;
}

function rowSpecs(r, advanced) {
  const maskSuffix = '= ' + r.prefix;
  const hostsNote = r.prefix === 31 ? '(PtP link, RFC 3021)' : '(' + r.scope + ')';
  if (!advanced) {
    return [
      { label: 'Address:', value: r.addressStr, copy: r.addressStr },
      { label: 'Netmask:', value: r.maskStr, copy: r.maskStr, suffix: maskSuffix },
      { label: 'Wildcard:', value: r.wildcardStr, copy: r.wildcardStr },
      { label: 'Hosts/Net:', value: String(r.hosts), copy: String(r.hosts) },
      null,
      { label: 'Network:', value: r.cidrStr, copy: r.cidrStr },
      { label: 'Broadcast:', value: r.broadcastStr, copy: r.hasBroadcast ? r.broadcastStr : undefined },
      null,
      { label: 'HostMin:', value: r.hostMinStr, copy: r.hostMinStr },
      { label: 'HostMax:', value: r.hostMaxStr, copy: r.hostMaxStr },
    ];
  }
  const specs = [
    { label: 'Address:', value: r.addressStr, copy: r.addressStr, bin: r.ip, binPrefix: r.prefix },
    { label: 'Netmask:', value: r.maskStr, copy: r.maskStr, suffix: maskSuffix, bin: r.mask, binPrefix: r.prefix },
    { label: 'Wildcard:', value: r.wildcardStr, copy: r.wildcardStr, bin: r.wildcard, binPrefix: r.prefix },
    'arrow',
    { label: 'Network:', value: r.cidrStr, copy: r.cidrStr, bin: r.network, binPrefix: r.prefix, note: '(Class ' + r.ipClass + ')' },
  ];
  if (r.hasBroadcast) {
    specs.push({ label: 'Broadcast:', value: r.broadcastStr, copy: r.broadcastStr, bin: r.broadcast, binPrefix: r.prefix });
  }
  specs.push(
    { label: 'HostMin:', value: r.hostMinStr, copy: r.hostMinStr, bin: r.hostMin, binPrefix: r.prefix },
    { label: 'HostMax:', value: r.hostMaxStr, copy: r.hostMaxStr, bin: r.hostMax, binPrefix: r.prefix },
    { label: 'Hosts/Net:', value: String(r.hosts), copy: String(r.hosts), note: hostsNote },
  );
  return specs;
}

function renderResult() {
  if (!state) return;
  const r = IpCalc.calc(state.ip, state.prefix);
  const advanced = advancedToggle.checked;

  resultRows.textContent = '';
  for (const spec of rowSpecs(r, advanced)) {
    if (spec === null) resultRows.appendChild(sepRow(false));
    else if (spec === 'arrow') resultRows.appendChild(sepRow(true));
    else resultRows.appendChild(makeRow(spec));
  }
  resultCard.hidden = false;
  resultCard.classList.remove('stale');

  // bit bar (advanced only)
  bitBar.hidden = !advanced;
  if (advanced) {
    bitBarSegments.textContent = '';
    for (let i = 0; i < 32; i++) {
      const seg = document.createElement('span');
      seg.className = 'seg' + (i < r.prefix ? ' net' : '') + (i > 0 && i % 8 === 0 ? ' octet-start' : '');
      bitBarSegments.appendChild(seg);
    }
    bitBarLabel.textContent = r.prefix + ' network bits · ' + (32 - r.prefix) + ' host bits';
  }

  renderSplitOptions(r);
}

function copyAllText() {
  const r = IpCalc.calc(state.ip, state.prefix);
  const advanced = advancedToggle.checked;
  const lines = [];
  for (const spec of rowSpecs(r, advanced)) {
    if (spec === null) { lines.push(''); continue; }
    if (spec === 'arrow') { lines.push('=>'); continue; }
    let line = spec.label.padEnd(LABEL_W) + spec.value + (spec.suffix ? ' ' + spec.suffix : '');
    if (advanced && (spec.bin !== undefined || spec.note)) {
      line = line.padEnd(LABEL_W + VALUE_W);
      if (spec.bin !== undefined) line += IpCalc.toBinary(spec.bin, spec.binPrefix);
      if (spec.note) line += (spec.bin !== undefined ? ' ' : '') + spec.note;
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n') + '\n';
}

function specialRangesText() {
  const lines = [];
  for (const group of SPECIAL_RANGE_GROUPS) {
    lines.push(group.title);
    for (const [cidr, desc] of group.ranges) {
      lines.push(cidr.padEnd(18) + desc);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function renderSpecialRanges() {
  specialRangesBody.textContent = '';
  const frag = document.createDocumentFragment();

  for (const group of SPECIAL_RANGE_GROUPS) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.className = 'special-group-title';
    title.textContent = group.title;
    section.appendChild(title);

    for (const [cidr, desc] of group.ranges) {
      const row = document.createElement('div');
      row.className = 'special-range-row';

      const value = document.createElement('button');
      value.className = 'special-range-value';
      value.title = 'Click to copy';
      value.textContent = cidr;
      value.addEventListener('click', () => copyText(cidr, value));
      row.appendChild(value);

      const description = document.createElement('span');
      description.className = 'special-range-desc';
      description.textContent = desc;
      row.appendChild(description);

      section.appendChild(row);
    }
    frag.appendChild(section);
  }

  specialRangesBody.appendChild(frag);
}

/* ---------- split section ---------- */

function renderSplitOptions(r) {
  if (r.prefix >= 32) {
    splitCard.hidden = true;
    return;
  }
  splitCard.hidden = false;

  const prev = Number(splitPrefixSel.value);
  splitPrefixSel.textContent = '';
  for (let p = r.prefix + 1; p <= 32; p++) {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    splitPrefixSel.appendChild(opt);
  }
  splitPrefixSel.value = (prev > r.prefix && prev <= 32) ? String(prev) : String(r.prefix + 1);
  renderSplitList();
}

function renderSplitList() {
  const r = IpCalc.calc(state.ip, state.prefix);
  const toPrefix = Number(splitPrefixSel.value);
  const res = IpCalc.split(r.network, r.prefix, toPrefix);

  splitCount.textContent = '= ' + res.count.toLocaleString('en-US') + ' subnets';
  splitList.textContent = '';
  currentSubnets = [];

  if (res.tooMany) {
    splitWarning.textContent = 'Too many subnets to display (limit ' +
      IpCalc.SPLIT_LIMIT.toLocaleString('en-US') + '). Choose a shorter target prefix.';
    splitWarning.hidden = false;
    return;
  }
  splitWarning.hidden = true;
  currentSubnets = res.subnets;
  splitList.classList.toggle('tall', res.count > 8);

  if (showHostsToggle.checked) {
    renderHostsTable(res.subnets);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const sn of res.subnets) {
    const row = document.createElement('div');
    row.className = 'subnet-row';

    const exp = document.createElement('button');
    exp.className = 'expander';
    exp.textContent = '▸';
    exp.title = 'Show details';

    const cidr = document.createElement('button');
    cidr.className = 'cidr';
    cidr.textContent = sn.cidr;
    cidr.title = 'Click to copy';
    cidr.addEventListener('click', () => copyText(sn.cidr, cidr));

    let details = null;
    exp.addEventListener('click', () => {
      if (details) {
        const open = !details.hidden;
        details.hidden = open;
        exp.textContent = open ? '▸' : '▾';
        return;
      }
      details = buildSubnetDetails(sn);
      row.after(details);
      exp.textContent = '▾';
    });

    row.appendChild(exp);
    row.appendChild(cidr);
    frag.appendChild(row);
  }
  splitList.appendChild(frag);
}

/*
 * Tabular hosts view: one row per subnet, one column per host address.
 * Falls back to HostMin/HostMax/Hosts when a subnet has more than
 * MAX_HOST_COLS hosts.
 */
function hostsTableData(subnets) {
  const first = IpCalc.calc(subnets[0].network, subnets[0].prefix);
  const compact = first.hosts <= MAX_HOST_COLS;
  const header = compact
    ? ['Subnet', ...Array.from({ length: first.hosts }, (_, i) => 'Host ' + (i + 1))]
    : ['Subnet', 'HostMin', 'HostMax', 'Hosts'];
  const rows = subnets.map((sn) => {
    const d = IpCalc.calc(sn.network, sn.prefix);
    if (compact) {
      const hosts = Array.from({ length: d.hosts }, (_, i) => IpCalc.intToIp((d.hostMin + i) >>> 0));
      return [sn.cidr, ...hosts];
    }
    return [sn.cidr, d.hostMinStr, d.hostMaxStr, String(d.hosts)];
  });
  return { header, rows };
}

function renderHostsTable(subnets) {
  const { header, rows } = hostsTableData(subnets);
  const table = document.createElement('table');
  table.className = 'hosts-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of header) {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    row.forEach((value, i) => {
      const td = document.createElement('td');
      if (i === 0) td.className = 'subnet';
      const btn = document.createElement('button');
      btn.className = 'value';
      btn.title = 'Click to copy';
      btn.textContent = value;
      btn.addEventListener('click', () => copyText(value, btn));
      td.appendChild(btn);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  splitList.appendChild(table);
}

function buildSubnetDetails(sn) {
  const d = IpCalc.calc(sn.network, sn.prefix);
  const div = document.createElement('div');
  div.className = 'subnet-details';
  const lines = [
    ['Netmask:  ', d.maskStr],
    ['Broadcast:', d.broadcastStr],
    ['HostMin:  ', d.hostMinStr],
    ['HostMax:  ', d.hostMaxStr],
    ['Hosts:    ', String(d.hosts)],
  ];
  for (const [label, value] of lines) {
    div.appendChild(document.createTextNode(label + ' '));
    const v = document.createElement('span');
    v.className = 'value';
    v.title = 'Click to copy';
    v.textContent = value;
    v.addEventListener('click', () => copyText(value, v));
    div.appendChild(v);
    div.appendChild(document.createTextNode('\n'));
  }
  return div;
}

/* ---------- MAC converter ---------- */

function parseMac(input) {
  const value = input.trim();
  if (!value) return { empty: true };
  const compact = value.replace(/[\s:.-]/g, '');

  const patterns = [
    /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i,
    /^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i,
    /^[0-9a-f]{4}(\.[0-9a-f]{4}){2}$/i,
    /^[0-9a-f]{12}$/i,
    /^[0-9a-f]{6}:[0-9a-f]{6}$/i,
    /^[0-9a-f]{6}-[0-9a-f]{6}$/i,
  ];
  if (!patterns.some((pattern) => pattern.test(value)) && !/^[0-9a-f]{12}$/i.test(compact)) {
    return { error: 'Enter a valid MAC address with 12 hex digits (0-9, a-f).' };
  }
  return { mac: compact.toLowerCase() };
}

function parseMacFromClipboard(text) {
  const parsed = parseMac(text);
  if (parsed.mac) return parsed;

  const patterns = [
    /(?:^|[^0-9a-f])([0-9a-f]{2}(?::[0-9a-f]{2}){5})(?:[^0-9a-f]|$)/i,
    /(?:^|[^0-9a-f])([0-9a-f]{2}(?:-[0-9a-f]{2}){5})(?:[^0-9a-f]|$)/i,
    /(?:^|[^0-9a-f])([0-9a-f]{4}(?:\.[0-9a-f]{4}){2})(?:[^0-9a-f]|$)/i,
    /(?:^|[^0-9a-f])([0-9a-f]{12})(?:[^0-9a-f]|$)/i,
    /(?:^|[^0-9a-f])([0-9a-f]{6}[:\-][0-9a-f]{6})(?:[^0-9a-f]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseMac(match[1]);
  }
  return { empty: true };
}

function macFormatsText(mac) {
  return MAC_FORMATS.map((spec) => spec.format(mac)).join('\n') + '\n';
}

function vendorCode(mac) {
  return mac.slice(0, 6).toUpperCase();
}

function formatVendorCode(code) {
  return code.match(/../g).join(':');
}

function isLocallyAdministered(mac) {
  return (parseInt(mac.slice(0, 2), 16) & 2) !== 0;
}

function renderMacVendor(mac) {
  const code = vendorCode(mac);
  const vendor = (typeof OUI_VENDORS === 'object' && OUI_VENDORS) ? OUI_VENDORS[code] : null;
  const rows = [
    ['Vendor code', formatVendorCode(code)],
    ['Vendor', vendor || 'Not found in local IEEE MA-L database'],
  ];

  macVendorInfo.textContent = '';
  for (const [label, value] of rows) {
    const lab = document.createElement('span');
    lab.className = 'vendor-label';
    lab.textContent = label + ':';
    macVendorInfo.appendChild(lab);

    const val = document.createElement('span');
    val.className = 'vendor-value';
    val.textContent = value;
    macVendorInfo.appendChild(val);
  }

  if (isLocallyAdministered(mac)) {
    const note = document.createElement('span');
    note.className = 'vendor-note';
    note.textContent = 'Note: Locally administered MAC; the OUI vendor may not apply.';
    macVendorInfo.appendChild(note);
  }
  macVendorInfo.hidden = false;
}

function renderMacFormats(mac) {
  macRows.textContent = '';
  const frag = document.createDocumentFragment();

  for (const spec of MAC_FORMATS) {
    const value = spec.format(mac);
    const row = document.createElement('div');
    row.className = 'mac-row';

    const label = document.createElement('span');
    label.className = 'mac-label';
    label.textContent = spec.label;
    row.appendChild(label);

    const output = document.createElement('span');
    output.className = 'mac-value';
    output.textContent = value;
    row.appendChild(output);

    const lower = document.createElement('button');
    lower.className = 'btn small mac-copy';
    lower.textContent = 'a';
    lower.title = 'Copy lowercase';
    lower.addEventListener('click', () => copyText(value.toLowerCase(), lower));
    row.appendChild(lower);

    const upper = document.createElement('button');
    upper.className = 'btn small mac-copy';
    upper.textContent = 'A';
    upper.title = 'Copy uppercase';
    upper.addEventListener('click', () => copyText(value.toUpperCase(), upper));
    row.appendChild(upper);

    frag.appendChild(row);
  }
  macRows.appendChild(frag);
  renderMacVendor(mac);
  macResultCard.hidden = false;
}

function handleMacInput() {
  const parsed = parseMac(macInput.value);
  if (parsed.empty) {
    macInput.classList.remove('invalid');
    macErrorMsg.hidden = true;
    macResultCard.hidden = true;
    macVendorInfo.hidden = true;
    save();
    return;
  }
  if (parsed.error) {
    macInput.classList.add('invalid');
    macErrorMsg.textContent = parsed.error;
    macErrorMsg.hidden = false;
    macResultCard.hidden = true;
    macVendorInfo.hidden = true;
    save();
    return;
  }
  macInput.classList.remove('invalid');
  macErrorMsg.hidden = true;
  renderMacFormats(parsed.mac);
  save();
}

function tryAutofillMacFromClipboard({ switchToMac } = {}) {
  if (!navigator.clipboard || !navigator.clipboard.readText) return Promise.resolve(false);
  return navigator.clipboard.readText().then((text) => {
    const parsed = parseMacFromClipboard(text);
    if (!parsed.mac) return false;
    macInput.value = MAC_FORMATS[0].format(parsed.mac);
    handleMacInput();
    if (switchToMac) showTool('mac');
    return true;
  }).catch(() => false);
}

/* ---------- CSV export ---------- */

function csvFor(entries) {
  const header = 'network,prefix,netmask,broadcast,hostmin,hostmax,hosts';
  const rows = entries.map((e) => {
    const d = IpCalc.calc(e.network, e.prefix);
    return [d.networkStr, d.prefix, d.maskStr, d.hasBroadcast ? d.broadcastStr : '',
            d.hostMinStr, d.hostMaxStr, d.hosts].join(',');
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- input handling ---------- */

function handleInput() {
  const parsed = IpCalc.parse(ipInput.value);
  if (parsed.error) {
    ipInput.classList.add('invalid');
    errorMsg.textContent = parsed.error;
    errorMsg.hidden = false;
    resultCard.classList.add('stale');
    splitCard.classList.add('stale');
    return;
  }
  ipInput.classList.remove('invalid');
  errorMsg.hidden = true;
  splitCard.classList.remove('stale');
  state = parsed;
  renderResult();
  save();
}

function setPrefix(delta) {
  if (!state) return;
  const p = Math.min(32, Math.max(0, state.prefix + delta));
  if (p === state.prefix) return;
  state = { ...state, prefix: p };
  if (state.format === 'dotted') {
    ipInput.value = IpCalc.intToIp(state.ip) + ' ' + IpCalc.intToIp(IpCalc.prefixToMask(p));
  } else {
    state.format = 'cidr';
    ipInput.value = IpCalc.intToIp(state.ip) + '/' + p;
  }
  ipInput.classList.remove('invalid');
  errorMsg.hidden = true;
  renderResult();
  save();
}

/* ---------- persistence ---------- */

function save() {
  if (!storage) return;
  storage.set({
    input: ipInput.value,
    macInput: macInput.value,
    advanced: advancedToggle.checked,
    splitPrefix: Number(splitPrefixSel.value) || null,
    showHosts: showHostsToggle.checked,
  });
}

function init(saved) {
  ipInput.value = saved.input || '192.168.0.1/24';
  macInput.value = saved.macInput || '';
  advancedToggle.checked = Boolean(saved.advanced);
  showHostsToggle.checked = Boolean(saved.showHosts);
  document.body.classList.toggle('tab', isTab);
  if (saved.splitPrefix) {
    const opt = document.createElement('option');
    opt.value = saved.splitPrefix;
    splitPrefixSel.appendChild(opt);
    splitPrefixSel.value = String(saved.splitPrefix);
  }
  renderSpecialRanges();
  handleInput();
  handleMacInput();
  if (initialTool === 'mac') {
    showTool('mac');
    tryAutofillMacFromClipboard({ switchToMac: false });
  } else if (isTab || initialTool === 'subnetter') {
    showTool('subnetter');
  } else {
    showTool('chooser');
    tryAutofillMacFromClipboard({ switchToMac: true });
  }
}

/* ---------- events ---------- */

$('chooseSubnetter').addEventListener('click', () => showTool('subnetter'));
$('chooseMacConverter').addEventListener('click', () => {
  showTool('mac');
  tryAutofillMacFromClipboard({ switchToMac: false });
});
backToChooserBtn.addEventListener('click', () => showTool('chooser'));

ipInput.addEventListener('input', handleInput);
ipInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { e.preventDefault(); setPrefix(1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); setPrefix(-1); }
});
$('prefixMinus').addEventListener('click', () => setPrefix(-1));
$('prefixPlus').addEventListener('click', () => setPrefix(1));
$('specialRangesToggle').addEventListener('click', () => {
  specialRangesCard.hidden = !specialRangesCard.hidden;
});
$('copySpecialRanges').addEventListener('click', (e) => copyText(specialRangesText(), e.target));

advancedToggle.addEventListener('change', () => {
  document.body.classList.toggle('advanced', currentTool === 'subnetter' && advancedToggle.checked);
  renderResult();
  save();
});

macInput.addEventListener('input', handleMacInput);

$('copyAllMacFormats').addEventListener('click', (e) => {
  const parsed = parseMac(macInput.value);
  if (parsed.mac) copyText(macFormatsText(parsed.mac), e.target);
});

$('copyAll').addEventListener('click', (e) => {
  if (state) copyText(copyAllText(), e.target);
});
$('exportResultCsv').addEventListener('click', () => {
  if (!state) return;
  const r = IpCalc.calc(state.ip, state.prefix);
  downloadCsv(csvFor([{ network: r.network, prefix: r.prefix }]),
    'subnetter_' + r.networkStr + '-' + r.prefix + '.csv');
});

splitPrefixSel.addEventListener('change', () => { renderSplitList(); save(); });

$('copyList').addEventListener('click', (e) => {
  if (!currentSubnets.length) return;
  if (showHostsToggle.checked) {
    // TSV so the table pastes cleanly into Excel & co.
    const { header, rows } = hostsTableData(currentSubnets);
    copyText([header, ...rows].map((r) => r.join('\t')).join('\n') + '\n', e.target);
  } else {
    copyText(currentSubnets.map((s) => s.cidr).join('\n') + '\n', e.target);
  }
});
$('exportSplitCsv').addEventListener('click', () => {
  if (!currentSubnets.length || !state) return;
  const r = IpCalc.calc(state.ip, state.prefix);
  const name = 'subnetter_' + r.networkStr + '-' + r.prefix + '_to-' + currentSubnets[0].prefix + '.csv';
  if (showHostsToggle.checked) {
    const { header, rows } = hostsTableData(currentSubnets);
    downloadCsv([header, ...rows].map((row) => row.join(',')).join('\n') + '\n', name);
  } else {
    downloadCsv(csvFor(currentSubnets), name);
  }
});
showHostsToggle.addEventListener('change', () => { renderSplitList(); save(); });

openTabBtn.addEventListener('click', () => {
  const url = 'popup.html?view=tab&tool=subnetter';
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    window.close();
  } else {
    window.open(url);
  }
});

if (storage) {
  storage.get(['input', 'macInput', 'advanced', 'splitPrefix', 'showHosts'], init);
} else {
  init({});
}
