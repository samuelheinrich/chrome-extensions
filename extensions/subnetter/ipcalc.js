/*
 * ipcalc.js — pure IPv4 subnet math, no DOM dependencies.
 * All addresses are handled as 32-bit unsigned integers (>>> 0).
 */
'use strict';

const IpCalc = (() => {
  const U32 = (n) => n >>> 0;

  function ipToInt(str) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(str.trim());
    if (!m) return null;
    let ip = 0;
    for (let i = 1; i <= 4; i++) {
      const o = Number(m[i]);
      if (o > 255) return null;
      ip = U32((ip << 8) | o);
    }
    return ip;
  }

  function intToIp(ip) {
    return [(ip >>> 24) & 255, (ip >>> 16) & 255, (ip >>> 8) & 255, ip & 255].join('.');
  }

  function prefixToMask(prefix) {
    return prefix === 0 ? 0 : U32(0xffffffff << (32 - prefix));
  }

  // Returns prefix length, or null if the mask has non-contiguous 1-bits.
  function maskToPrefix(mask) {
    mask = U32(mask);
    if (mask === 0) return 0;
    let prefix = 0;
    let seenZero = false;
    for (let i = 31; i >= 0; i--) {
      const bit = (mask >>> i) & 1;
      if (bit === 1) {
        if (seenZero) return null;
        prefix++;
      } else {
        seenZero = true;
      }
    }
    return prefix;
  }

  function classOf(ip) {
    const first = ip >>> 24;
    if (first < 128) return 'A';
    if (first < 192) return 'B';
    if (first < 224) return 'C';
    if (first < 240) return 'D';
    return 'E';
  }

  function defaultPrefix(ip) {
    switch (classOf(ip)) {
      case 'A': return 8;
      case 'B': return 16;
      case 'C': return 24;
      default: return 24;
    }
  }

  function inBlock(ip, blockIp, blockPrefix) {
    const mask = prefixToMask(blockPrefix);
    return U32(ip & mask) === U32(blockIp & mask);
  }

  function scopeOf(ip) {
    if (inBlock(ip, ipToInt('10.0.0.0'), 8) ||
        inBlock(ip, ipToInt('172.16.0.0'), 12) ||
        inBlock(ip, ipToInt('192.168.0.0'), 16)) return 'Private Internet';
    if (inBlock(ip, ipToInt('127.0.0.0'), 8)) return 'Loopback';
    if (inBlock(ip, ipToInt('169.254.0.0'), 16)) return 'Link-Local (APIPA)';
    if (inBlock(ip, ipToInt('100.64.0.0'), 10)) return 'Shared Address Space (CGN)';
    if (inBlock(ip, ipToInt('224.0.0.0'), 4)) return 'Multicast';
    if (inBlock(ip, ipToInt('240.0.0.0'), 4)) return 'Reserved';
    return 'Public Internet';
  }

  /*
   * Accepts: "10.1.1.10/24", "10.1.1.0 255.255.255.0", "10.1.1.10"
   * (host addresses inside a subnet are fine — the network is derived).
   * Returns { ip, prefix, format: 'cidr'|'dotted'|'bare' } or { error }.
   */
  function parse(input) {
    const s = String(input).trim().replace(/\s+/g, ' ');
    if (!s) return { error: 'Enter an address' };

    let m = /^(\S+)\s*\/\s*(\d{1,2})$/.exec(s);
    if (m) {
      const ip = ipToInt(m[1]);
      if (ip === null) return { error: 'Invalid IP address' };
      const prefix = Number(m[2]);
      if (prefix > 32) return { error: 'Prefix must be 0–32' };
      return { ip, prefix, format: 'cidr' };
    }

    m = /^(\S+)\s+(\S+)$/.exec(s);
    if (m) {
      const ip = ipToInt(m[1]);
      if (ip === null) return { error: 'Invalid IP address' };
      const mask = ipToInt(m[2]);
      if (mask === null) return { error: 'Invalid netmask' };
      const prefix = maskToPrefix(mask);
      if (prefix === null) return { error: 'Netmask bits are not contiguous' };
      return { ip, prefix, format: 'dotted' };
    }

    const ip = ipToInt(s);
    if (ip === null) return { error: 'Invalid input — use e.g. 10.1.1.0/24 or 10.1.1.0 255.255.255.0' };
    return { ip, prefix: defaultPrefix(ip), format: 'bare' };
  }

  function calc(ip, prefix) {
    const mask = prefixToMask(prefix);
    const wildcard = U32(~mask);
    const network = U32(ip & mask);
    const broadcast = U32(network | wildcard);

    let hosts, hostMin, hostMax;
    if (prefix === 32) {
      hosts = 1;
      hostMin = hostMax = ip;
    } else if (prefix === 31) {
      hosts = 2; // RFC 3021 point-to-point
      hostMin = network;
      hostMax = broadcast;
    } else {
      hosts = Math.pow(2, 32 - prefix) - 2;
      hostMin = U32(network + 1);
      hostMax = U32(broadcast - 1);
    }

    return {
      ip, prefix, mask, wildcard, network, broadcast, hostMin, hostMax, hosts,
      hasBroadcast: prefix <= 30,
      addressStr: intToIp(ip),
      maskStr: intToIp(mask),
      wildcardStr: intToIp(wildcard),
      networkStr: intToIp(network),
      cidrStr: intToIp(network) + '/' + prefix,
      broadcastStr: prefix <= 30 ? intToIp(broadcast) : '—',
      hostMinStr: intToIp(hostMin),
      hostMaxStr: intToIp(hostMax),
      ipClass: classOf(ip),
      scope: scopeOf(ip),
    };
  }

  const SPLIT_LIMIT = 4096;

  /*
   * Splits network/fromPrefix into subnets of toPrefix.
   * Returns { count } plus { subnets: [{network, prefix, cidr}] } when
   * count <= SPLIT_LIMIT, otherwise { tooMany: true }.
   */
  function split(network, fromPrefix, toPrefix) {
    if (toPrefix <= fromPrefix || toPrefix > 32) return { count: 0, subnets: [] };
    const count = Math.pow(2, toPrefix - fromPrefix);
    if (count > SPLIT_LIMIT) return { count, tooMany: true };
    const step = Math.pow(2, 32 - toPrefix);
    const base = U32(network & prefixToMask(fromPrefix));
    const subnets = [];
    for (let i = 0; i < count; i++) {
      const net = U32(base + i * step);
      subnets.push({ network: net, prefix: toPrefix, cidr: intToIp(net) + '/' + toPrefix });
    }
    return { count, subnets };
  }

  // "11000000.10101000.00000000 .00000001" — space marks the prefix boundary.
  function toBinary(ip, prefix) {
    let out = '';
    for (let i = 0; i < 32; i++) {
      if (i === prefix && prefix > 0 && prefix < 32) out += ' ';
      if (i > 0 && i % 8 === 0) out += '.';
      out += (ip >>> (31 - i)) & 1;
    }
    return out;
  }

  return {
    ipToInt, intToIp, prefixToMask, maskToPrefix,
    classOf, scopeOf, parse, calc, split, toBinary, SPLIT_LIMIT,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IpCalc;
}
