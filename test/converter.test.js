import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDrawioUrl,
  createBlankDiagram,
  decodeXmlExportPayload,
  decodeSvgDataUri,
  parseEmbedMessage,
} from "../public/converter.js";

test("新規図として編集可能なdraw.io XMLを生成する", () => {
  const xml = createBlankDiagram();
  assert.match(xml, /<mxCell id="0"\/>/);
  assert.match(xml, /<mxCell id="1" parent="0"\/>/);
});

test("JSON文字列のembedメッセージを解析する", () => {
  assert.deepEqual(parseEmbedMessage('{"event":"init"}'), { event: "init" });
  assert.equal(parseEmbedMessage("invalid"), null);
});

test("オブジェクト形式のembedメッセージを受け入れる", () => {
  const message = { event: "load" };
  assert.equal(parseEmbedMessage(message), message);
  assert.equal(parseEmbedMessage(null), null);
});

test("XML exportの生XMLを取り出す", () => {
  const xml = "<mxfile><diagram /></mxfile>";
  assert.equal(decodeXmlExportPayload(xml), xml);
});

test("data URI形式のXML exportを復号する", () => {
  const xml = "<mxfile><diagram /></mxfile>";
  assert.equal(decodeXmlExportPayload(`data:application/xml,${encodeURIComponent(xml)}`), xml);
  assert.equal(
    decodeXmlExportPayload(`data:application/xml;base64,${Buffer.from(xml).toString("base64")}`),
    xml,
  );
});

test("無効なXML export候補を拒否する", () => {
  assert.equal(decodeXmlExportPayload("invalid"), null);
  assert.equal(decodeXmlExportPayload(null), null);
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

test("選択したクラウドアイコンライブラリをURLへ設定する", () => {
  const url = new URL(buildDrawioUrl("https://embed.diagrams.net/?embed=1", ["aws4", "gcp2", "aws4"]));
  assert.equal(url.searchParams.get("libs"), "aws4;gcp2");
});

test("ライブラリ未選択時は既存のlibs指定を削除する", () => {
  const url = new URL(buildDrawioUrl("https://embed.diagrams.net/?embed=1&libs=aws4", []));
  assert.equal(url.searchParams.has("libs"), false);
});
