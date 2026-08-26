import {
  DRAWIO_ORIGIN,
  decodeSvgDataUri,
  looksLikeDrawioXml,
  parseEmbedMessage,
} from "./converter.js";

const frame = document.querySelector("#drawio-frame");
const xmlInput = document.querySelector("#xml-input");
const svgOutput = document.querySelector("#svg-output");
const convertButton = document.querySelector("#convert-button");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const preview = document.querySelector("#preview");
const previewEmpty = document.querySelector("#preview-empty");
const status = document.querySelector("#status");

let editorReady = false;
let conversionPending = false;
let previewUrl;
let timeoutId;

function setStatus(message, kind = "idle") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function postToDrawio(message) {
  frame.contentWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN);
}

function clearTimer() {
  if (timeoutId) {
    window.clearTimeout(timeoutId);
    timeoutId = undefined;
  }
}

function beginTimeout() {
  clearTimer();
  timeoutId = window.setTimeout(() => {
    conversionPending = false;
    convertButton.disabled = !editorReady;
    setStatus("変換がタイムアウトしました。もう一度お試しください。", "error");
  }, 30_000);
}

function resetOutput() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }

  svgOutput.value = "";
  preview.removeAttribute("src");
  preview.hidden = true;
  previewEmpty.hidden = false;
  copyButton.disabled = true;
  downloadButton.disabled = true;
}

function validateXml(xml) {
  if (!looksLikeDrawioXml(xml)) {
    return false;
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  return !document.querySelector("parsererror");
}

function showSvg(svg) {
  resetOutput();
  svgOutput.value = svg;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  previewUrl = URL.createObjectURL(blob);
  preview.src = previewUrl;
  preview.hidden = false;
  previewEmpty.hidden = true;
  copyButton.disabled = false;
  downloadButton.disabled = false;
}

window.addEventListener("message", (event) => {
  if (event.origin !== DRAWIO_ORIGIN || event.source !== frame.contentWindow) {
    return;
  }

  const message = parseEmbedMessage(event.data);
  if (!message) {
    return;
  }

  if (message.event === "init") {
    editorReady = true;
    convertButton.disabled = false;
    setStatus("変換できます。", "success");
    return;
  }

  if (!conversionPending) {
    return;
  }

  if (message.event === "export") {
    try {
      showSvg(decodeSvgDataUri(message.data));
      setStatus("SVGを生成しました。", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      clearTimer();
      conversionPending = false;
      convertButton.disabled = false;
    }
    return;
  }

  if (message.error) {
    clearTimer();
    conversionPending = false;
    convertButton.disabled = false;
    setStatus(`draw.ioエラー: ${message.error}`, "error");
  }
});

convertButton.addEventListener("click", () => {
  const xml = xmlInput.value.trim();
  if (!validateXml(xml)) {
    setStatus("有効なdraw.io XMLを入力してください。", "error");
    xmlInput.focus();
    return;
  }

  resetOutput();
  conversionPending = true;
  convertButton.disabled = true;
  setStatus("SVGを書き出しています…");
  beginTimeout();
  postToDrawio({
    action: "export",
    format: "svg",
    xml,
    border: 8,
    embedImages: true,
  });
});

clearButton.addEventListener("click", () => {
  clearTimer();
  conversionPending = false;
  xmlInput.value = "";
  resetOutput();
  convertButton.disabled = !editorReady;
  setStatus(editorReady ? "変換できます。" : "draw.ioを準備しています…", editorReady ? "success" : "idle");
  xmlInput.focus();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(svgOutput.value);
    setStatus("SVGをクリップボードへコピーしました。", "success");
  } catch {
    svgOutput.select();
    if (document.execCommand("copy")) {
      setStatus("SVGをクリップボードへコピーしました。", "success");
    } else {
      setStatus("コピーできませんでした。SVGを選択して手動でコピーしてください。", "error");
    }
  }
});

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([svgOutput.value], { type: "image/svg+xml" }));
  link.download = "diagram.svg";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
});

window.addEventListener("beforeunload", () => {
  clearTimer();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});
