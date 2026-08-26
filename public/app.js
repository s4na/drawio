import {
  DRAWIO_ORIGIN,
  buildDrawioUrl,
  createBlankDiagram,
  decodeSvgDataUri,
  parseEmbedMessage,
} from "./converter.js";

let frame = document.querySelector("#drawio-frame");
const xmlInput = document.querySelector("#xml-input");
const loadXmlButton = document.querySelector("#load-xml-button");
const fileInput = document.querySelector("#file-input");
const newButton = document.querySelector("#new-button");
const templateButton = document.querySelector("#template-button");
const downloadDrawioButton = document.querySelector("#download-drawio-button");
const exportSvgButton = document.querySelector("#export-svg-button");
const svgOutput = document.querySelector("#svg-output");
const retryButton = document.querySelector("#retry-button");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const preview = document.querySelector("#preview");
const previewEmpty = document.querySelector("#preview-empty");
const status = document.querySelector("#status");
const awsLibraryCheckbox = document.querySelector("#library-aws");
const gcpLibraryCheckbox = document.querySelector("#library-gcp");
const embedImagesCheckbox = document.querySelector("#embed-images");

let editorReady = false;
let diagramLoaded = false;
let xmlDownloadPending = false;
let editorReloadPending;
let currentXml = createBlankDiagram();
let lastLoadedXml = currentXml;
let activeLibraries = selectedLibraries();
let xmlInputDirty = false;
let hasUnsavedChanges = false;
let pendingUnsavedState;
let svgSourceXml;
let previewUrl;
let timeoutId;
let initializationTimeoutId;

xmlInput.value = currentXml;

function setStatus(message, kind = "idle") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function selectedLibraries() {
  return [
    awsLibraryCheckbox.checked && "aws4",
    gcpLibraryCheckbox.checked && "gcp2",
  ].filter(Boolean);
}

function buildEditorUrl() {
  return buildDrawioUrl(frame.dataset.src, selectedLibraries());
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

function clearInitializationTimer() {
  if (initializationTimeoutId) {
    window.clearTimeout(initializationTimeoutId);
    initializationTimeoutId = undefined;
  }
}

function setEditorActionsDisabled(disabled) {
  for (const button of [newButton, templateButton, downloadDrawioButton, exportSvgButton]) {
    button.disabled = disabled;
  }
  loadXmlButton.disabled = disabled;
  fileInput.disabled = disabled;
  xmlInput.disabled = disabled;
  awsLibraryCheckbox.disabled = disabled;
  gcpLibraryCheckbox.disabled = disabled;
  embedImagesCheckbox.disabled = disabled;
  frame.classList.toggle("is-busy", disabled);
  frame.toggleAttribute("inert", disabled);
  frame.setAttribute("aria-busy", String(disabled));
}

function beginInitializationTimeout() {
  clearInitializationTimer();
  initializationTimeoutId = window.setTimeout(() => {
    if (!editorReady) {
      setStatus("draw.ioを準備できませんでした。再接続してください。", "error");
      retryButton.hidden = false;
    }
  }, 15_000);
}

function resetEditor(message = "draw.ioへ再接続しています…") {
  clearTimer();
  clearInitializationTimer();
  xmlDownloadPending = false;
  editorReloadPending = undefined;
  editorReady = false;
  diagramLoaded = false;
  setEditorActionsDisabled(true);
  retryButton.hidden = true;

  const replacement = frame.cloneNode();
  frame.replaceWith(replacement);
  frame = replacement;
  frame.src = buildEditorUrl();

  setStatus(message);
  beginInitializationTimeout();
}

function beginTimeout() {
  clearTimer();
  timeoutId = window.setTimeout(() => {
    resetEditor("書き出しがタイムアウトしたため、draw.ioへ再接続しています…");
  }, 30_000);
}

function beginLoadTimeout() {
  clearTimer();
  timeoutId = window.setTimeout(() => {
    pendingUnsavedState = undefined;
    syncXml(lastLoadedXml);
    resetOutput();
    resetEditor("図の読み込みがタイムアウトしたため、直前の図を復元しています…");
  }, 30_000);
}

function resetOutput() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }

  svgOutput.value = "";
  svgSourceXml = undefined;
  preview.removeAttribute("src");
  preview.hidden = true;
  previewEmpty.hidden = false;
  copyButton.disabled = true;
  downloadButton.disabled = true;
}

function validateXml(xml) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return !document.querySelector("parsererror")
    && ["mxfile", "mxGraphModel"].includes(document.documentElement.localName);
}

function syncXml(xml, force = false) {
  if (typeof xml !== "string" || !validateXml(xml)) {
    return false;
  }

  currentXml = xml;
  if (force || !xmlInputDirty) {
    xmlInput.value = xml;
    xmlInputDirty = false;
  }
  return true;
}

function loadDiagram(xml, message = "図を読み込みました。") {
  if (!editorReady) {
    return;
  }

  diagramLoaded = false;
  setEditorActionsDisabled(true);
  postToDrawio({
    action: "load",
    xml,
    autosave: 1,
    noExitBtn: 1,
    saveAndExit: 0,
    title: "diagram.drawio",
    libs: selectedLibraries().join(";"),
    fit: 1,
  });
  setStatus(message);
  beginLoadTimeout();
}

function downloadText(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function confirmReplacement(includeXmlDraft = false) {
  if (!hasUnsavedChanges && (!includeXmlDraft || !xmlInputDirty)) {
    return true;
  }

  return window.confirm("保存していない内容を破棄して、別の図を読み込みますか？");
}

function restoreActiveLibraries() {
  awsLibraryCheckbox.checked = activeLibraries.includes("aws4");
  gcpLibraryCheckbox.checked = activeLibraries.includes("gcp2");
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

  if (message.error) {
    clearTimer();
    xmlDownloadPending = false;
    if (editorReloadPending) {
      restoreActiveLibraries();
    }
    editorReloadPending = undefined;

    if (message.event === "load" && !diagramLoaded) {
      pendingUnsavedState = undefined;
      syncXml(lastLoadedXml);
      resetOutput();
      resetEditor("図を読み込めなかったため、直前の図を復元しています…");
      return;
    }

    setEditorActionsDisabled(!diagramLoaded);
    setStatus(`draw.ioエラー: ${message.error}`, "error");
    return;
  }

  if (message.event === "init") {
    clearInitializationTimer();
    editorReady = true;
    retryButton.hidden = true;
    loadDiagram(currentXml, "draw.ioエディタを読み込んでいます…");
    return;
  }

  if (message.event === "load") {
    clearTimer();
    diagramLoaded = true;
    lastLoadedXml = currentXml;
    activeLibraries = selectedLibraries();
    if (pendingUnsavedState !== undefined) {
      hasUnsavedChanges = pendingUnsavedState;
      pendingUnsavedState = undefined;
    }
    setEditorActionsDisabled(false);
    setStatus("図を編集できます。", "success");
    return;
  }

  if (message.event === "template") {
    if (!syncXml(message.xml)) {
      setStatus("選択したテンプレートを読み込めませんでした。", "error");
      return;
    }

    pendingUnsavedState = true;
    resetOutput();
    loadDiagram(currentXml, "テンプレートを読み込んでいます…");
    return;
  }

  if (message.event === "autosave" || message.event === "save") {
    if (!diagramLoaded) {
      return;
    }

    const diagramChanged = message.xml !== currentXml;
    if (syncXml(message.xml)) {
      lastLoadedXml = currentXml;
      hasUnsavedChanges ||= diagramChanged;
      const svgWasStale = Boolean(svgSourceXml && svgSourceXml !== currentXml);
      if (svgWasStale) {
        resetOutput();
      }
      setStatus(
        svgWasStale
          ? "編集内容を同期しました。SVGを再度書き出してください。"
          : message.event === "save" ? "編集内容を同期しました。" : "編集中の内容を同期しました。",
        "success",
      );
    }
    return;
  }

  if (message.event === "export") {
    try {
      if (message.format === "xml") {
        const diagramChanged = message.data !== currentXml;
        if (!syncXml(message.data)) {
          throw new Error("draw.ioから編集内容を取得できませんでした。");
        }
        lastLoadedXml = currentXml;
        hasUnsavedChanges ||= diagramChanged;
        if (xmlDownloadPending) {
          downloadText(currentXml, "application/xml", "diagram.drawio");
          hasUnsavedChanges = false;
          setStatus("draw.ioファイルをダウンロードしました。", "success");
        }
        if (editorReloadPending) {
          const reloadMessage = editorReloadPending;
          editorReloadPending = undefined;
          resetOutput();
          resetEditor(reloadMessage);
        }
      } else if (message.format === "svg" || message.data?.startsWith("data:image/svg+xml")) {
        const diagramChanged = typeof message.xml === "string" && message.xml !== currentXml;
        if (syncXml(message.xml)) {
          lastLoadedXml = currentXml;
          hasUnsavedChanges ||= diagramChanged;
        }
        showSvg(decodeSvgDataUri(message.data));
        svgSourceXml = currentXml;
        setStatus("現在の図からSVGを生成しました。", "success");
      }
    } catch (error) {
      if (editorReloadPending) {
        restoreActiveLibraries();
      }
      editorReloadPending = undefined;
      setStatus(error.message, "error");
    } finally {
      clearTimer();
      xmlDownloadPending = false;
      setEditorActionsDisabled(!diagramLoaded);
    }
    return;
  }

});

loadXmlButton.addEventListener("click", () => {
  if (!confirmReplacement()) {
    return;
  }

  const xml = xmlInput.value.trim();
  if (!validateXml(xml)) {
    setStatus("有効なdraw.io XMLを入力してください。", "error");
    xmlInput.focus();
    return;
  }

  currentXml = xml;
  xmlInputDirty = false;
  pendingUnsavedState = true;
  resetOutput();
  loadDiagram(currentXml, "XMLをdraw.ioエディタへ読み込んでいます…");
});

xmlInput.addEventListener("input", () => {
  xmlInputDirty = true;
});

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  fileInput.value = "";
  if (!file) {
    return;
  }

  if (!confirmReplacement(true)) {
    return;
  }

  setEditorActionsDisabled(true);

  try {
    const xml = await file.text();
    if (!validateXml(xml)) {
      setEditorActionsDisabled(false);
      setStatus("有効な.drawioファイルを選択してください。", "error");
      return;
    }

    syncXml(xml, true);
    pendingUnsavedState = false;
    resetOutput();
    loadDiagram(currentXml, `${file.name}を読み込んでいます…`);
  } catch {
    setEditorActionsDisabled(false);
    setStatus(`${file.name}を読み込めませんでした。`, "error");
  }
});

newButton.addEventListener("click", () => {
  if (!window.confirm("現在の図を閉じて、新しい図を作成しますか？")) {
    return;
  }

  syncXml(createBlankDiagram(), true);
  pendingUnsavedState = false;
  resetOutput();
  loadDiagram(currentXml, "新しい図を作成しています…");
});

templateButton.addEventListener("click", () => {
  if (!confirmReplacement(true)) {
    return;
  }

  postToDrawio({ action: "template", callback: true, noExitOnCancel: true });
});

downloadDrawioButton.addEventListener("click", () => {
  xmlDownloadPending = true;
  setEditorActionsDisabled(true);
  setStatus("編集内容をdraw.ioファイルへ書き出しています…");
  beginTimeout();
  postToDrawio({ action: "export", format: "xml" });
});

exportSvgButton.addEventListener("click", () => {
  resetOutput();
  setEditorActionsDisabled(true);
  setStatus("現在の図をSVGへ書き出しています…");
  beginTimeout();
  postToDrawio({
    action: "export",
    format: "svg",
    border: 8,
    embedImages: embedImagesCheckbox.checked,
  });
});

retryButton.addEventListener("click", () => {
  resetEditor();
});

for (const checkbox of [awsLibraryCheckbox, gcpLibraryCheckbox]) {
  checkbox.addEventListener("change", () => {
    editorReloadPending = "クラウドアイコンライブラリを読み込み直しています…";
    setEditorActionsDisabled(true);
    setStatus("編集中の内容を保存してからライブラリを読み込み直します…");
    beginTimeout();
    postToDrawio({ action: "export", format: "xml" });
  });
}

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
  downloadText(svgOutput.value, "image/svg+xml", "diagram.svg");
});

window.addEventListener("beforeunload", (event) => {
  if (hasUnsavedChanges || xmlInputDirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    return;
  }

  clearTimer();
  clearInitializationTimer();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});

setEditorActionsDisabled(true);
frame.src = buildEditorUrl();
beginInitializationTimeout();
