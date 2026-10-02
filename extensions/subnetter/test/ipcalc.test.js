'use strict';
const test = require('node:test');
const assert = require('node:assert');
const IpCalc = require('../ipcalc.js');

test('parses CIDR input', () => {
  const p = IpCalc.parse('192.168.0.1/24');
  assert.strictEqual(p.error, undefined);
  assert.strictEqual(IpCalc.intToIp(p.ip), '192.168.0.1');
  assert.strictEqual(p.prefix, 24);
  assert.strictEqual(p.format, 'cidr');
});

test('parses IP + dotted mask', () => {
  const p = IpCalc.parse('10.1.1.0 255.255.255.0');
  assert.strictEqual(p.error, undefined);
  assert.strictEqual(p.prefix, 24);
  assert.strictEqual(p.format, 'dotted');
});

test('tolerates extra whitespace and spaced slash', () => {
  assert.strictEqual(IpCalc.parse('  10.1.1.0   255.255.255.0 ').prefix, 24);
  assert.strictEqual(IpCalc.parse('10.1.1.0 / 30').prefix, 30);
});

test('bare IP falls back to classful default', () => {
  assert.strictEqual(IpCalc.parse('10.0.0.5').prefix, 8);
  assert.strictEqual(IpCalc.parse('172.20.1.1').prefix, 16);
  assert.strictEqual(IpCalc.parse('192.168.1.1').prefix, 24);
});

test('rejects bad input', () => {
  assert.ok(IpCalc.parse('10.1.1.256/24').error);
  assert.ok(IpCalc.parse('10.1.1.0/33').error);
  assert.ok(IpCalc.parse('10.1.1.0 255.0.255.0').error); // non-contiguous mask
  assert.ok(IpCalc.parse('hello').error);
  assert.ok(IpCalc.parse('').error);
});

test('reference example 192.168.0.1/24', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('192.168.0.1'), 24);
  assert.strictEqual(r.addressStr, '192.168.0.1');
  assert.strictEqual(r.maskStr, '255.255.255.0');
  assert.strictEqual(r.wildcardStr, '0.0.0.255');
  assert.strictEqual(r.hosts, 254);
  assert.strictEqual(r.cidrStr, '192.168.0.0/24');
  assert.strictEqual(r.broadcastStr, '192.168.0.255');
  assert.strictEqual(r.hostMinStr, '192.168.0.1');
  assert.strictEqual(r.hostMaxStr, '192.168.0.254');
  assert.strictEqual(r.ipClass, 'C');
  assert.strictEqual(r.scope, 'Private Internet');
});

test('host address inside subnet derives the network', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('10.1.1.10'), 24);
  assert.strictEqual(r.cidrStr, '10.1.1.0/24');
  assert.strictEqual(r.hostMinStr, '10.1.1.1');
  assert.strictEqual(r.hostMaxStr, '10.1.1.254');
});

test('/31 point-to-point (RFC 3021)', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('10.0.0.0'), 31);
  assert.strictEqual(r.hosts, 2);
  assert.strictEqual(r.hostMinStr, '10.0.0.0');
  assert.strictEqual(r.hostMaxStr, '10.0.0.1');
  assert.strictEqual(r.hasBroadcast, false);
});

test('/32 single host', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('10.0.0.5'), 32);
  assert.strictEqual(r.hosts, 1);
  assert.strictEqual(r.hostMinStr, '10.0.0.5');
  assert.strictEqual(r.hostMaxStr, '10.0.0.5');
});

test('/8 large network', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('10.0.0.0'), 8);
  assert.strictEqual(r.hosts, 16777214);
  assert.strictEqual(r.broadcastStr, '10.255.255.255');
});

test('/0 whole internet', () => {
  const r = IpCalc.calc(IpCalc.ipToInt('1.2.3.4'), 0);
  assert.strictEqual(r.maskStr, '0.0.0.0');
  assert.strictEqual(r.cidrStr, '0.0.0.0/0');
  assert.strictEqual(r.broadcastStr, '255.255.255.255');
});

test('split /24 into /25', () => {
  const s = IpCalc.split(IpCalc.ipToInt('10.0.0.0'), 24, 25);
  assert.strictEqual(s.count, 2);
  assert.deepStrictEqual(s.subnets.map((x) => x.cidr), ['10.0.0.0/25', '10.0.0.128/25']);
});

test('split /24 into /30 gives 64 nets', () => {
  const s = IpCalc.split(IpCalc.ipToInt('10.0.0.0'), 24, 30);
  assert.strictEqual(s.count, 64);
  assert.strictEqual(s.subnets[0].cidr, '10.0.0.0/30');
  assert.strictEqual(s.subnets[63].cidr, '10.0.0.252/30');
});

test('split refuses oversized result sets', () => {
  const s = IpCalc.split(IpCalc.ipToInt('10.0.0.0'), 8, 30);
  assert.strictEqual(s.tooMany, true);
  assert.strictEqual(s.count, Math.pow(2, 22));
});

test('binary rendering with prefix gap', () => {
  assert.strictEqual(
    IpCalc.toBinary(IpCalc.ipToInt('192.168.0.1'), 24),
    '11000000.10101000.00000000 .00000001'
  );
  assert.strictEqual(
    IpCalc.toBinary(IpCalc.ipToInt('10.0.0.0'), 30),
    '00001010.00000000.00000000.000000 00'
  );
});

test('mask helpers round-trip', () => {
  for (let p = 0; p <= 32; p++) {
    assert.strictEqual(IpCalc.maskToPrefix(IpCalc.prefixToMask(p)), p);
  }
  assert.strictEqual(IpCalc.maskToPrefix(IpCalc.ipToInt('255.0.255.0')), null);
});
