export const DRAWIO_ORIGIN = "https://embed.diagrams.net";

export function createBlankDiagram() {
  return `<mxfile host="embed.diagrams.net">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

export function buildDrawioUrl(baseUrl, libraries) {
  const url = new URL(baseUrl);
  const selectedLibraries = [...new Set(libraries.filter(Boolean))];

  if (selectedLibraries.length > 0) {
    url.searchParams.set("libs", selectedLibraries.join(";"));
  } else {
    url.searchParams.delete("libs");
  }

  return url.toString();
}

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

export function decodeXmlExportPayload(...values) {
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    if (/^\s*</.test(value)) {
      return value;
    }

    const separator = value.indexOf(",");
    if (/^data:/i.test(value) && separator >= 0) {
      const metadata = value.slice(0, separator);
      const payload = value.slice(separator + 1);
      try {
        if (/;base64(?:;|$)/i.test(metadata)) {
          const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
          const decoded = new TextDecoder().decode(bytes);
          if (/^\s*</.test(decoded)) {
            return decoded;
          }
        } else {
          const decoded = decodeURIComponent(payload);
          if (/^\s*</.test(decoded)) {
            return decoded;
          }
        }
      } catch {
        // Try the next candidate.
      }
    }

    try {
      const decoded = decodeURIComponent(value);
      if (/^\s*</.test(decoded)) {
        return decoded;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
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
