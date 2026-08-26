export const DRAWIO_ORIGIN = "https://embed.diagrams.net";

export function parseEmbedMessage(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value && typeof value === "object" ? value : null;
}

export function looksLikeDrawioXml(value) {
  const xml = value.trim();
  return /^<\?xml(?:\s[^>]*)?\?>\s*<(?:mxfile|mxGraphModel)\b/i.test(xml)
    || /^<(?:mxfile|mxGraphModel)\b/i.test(xml);
}

export function decodeSvgDataUri(dataUri) {
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/svg+xml")) {
    throw new Error("draw.ioからSVGデータを取得できませんでした。");
  }

  const separator = dataUri.indexOf(",");
  if (separator < 0) {
    throw new Error("SVGデータURIの形式が正しくありません。");
  }

  const metadata = dataUri.slice(0, separator);
  const payload = dataUri.slice(separator + 1);
  let svg;

  if (/;base64(?:;|$)/i.test(metadata)) {
    const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    svg = new TextDecoder().decode(bytes);
  } else {
    svg = decodeURIComponent(payload);
  }

  if (!/^\s*<svg\b/i.test(svg)) {
    throw new Error("変換結果がSVGではありません。");
  }

  return svg;
}
