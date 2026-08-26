import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeSvgDataUri,
  looksLikeDrawioXml,
  parseEmbedMessage,
} from "../public/converter.js";

test("JSON文字列のembedメッセージを解析する", () => {
  assert.deepEqual(parseEmbedMessage('{"event":"init"}'), { event: "init" });
  assert.equal(parseEmbedMessage("invalid"), null);
});

test("オブジェクト形式のembedメッセージを受け入れる", () => {
  const message = { event: "load" };
  assert.equal(parseEmbedMessage(message), message);
  assert.equal(parseEmbedMessage(null), null);
});

test("draw.io XMLのルート要素を判定する", () => {
  assert.equal(looksLikeDrawioXml("<mxfile><diagram /></mxfile>"), true);
  assert.equal(looksLikeDrawioXml('<?xml version="1.0"?><mxGraphModel />'), true);
  assert.equal(looksLikeDrawioXml("<svg />"), false);
});

test("URLエンコードされたSVG data URIを復号する", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>構成図</text></svg>';
  assert.equal(decodeSvgDataUri(`data:image/svg+xml,${encodeURIComponent(svg)}`), svg);
});

test("base64のSVG data URIをUTF-8で復号する", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>構成図</text></svg>';
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  assert.equal(decodeSvgDataUri(`data:image/svg+xml;base64,${encoded}`), svg);
});

test("SVG以外のdata URIを拒否する", () => {
  assert.throws(() => decodeSvgDataUri("data:image/png;base64,AAAA"), /SVGデータ/);
});
