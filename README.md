# drawio SVG Converter

draw.ioの編集可能なXMLを、ブラウザ内でSVGへ変換する静的Webアプリです。

**[ブラウザで開く](https://s4na.github.io/drawio/)**

## 使い方

1. `.drawio`ファイルのXMLを入力欄へ貼り付ける
2. 「SVGに変換」を押す
3. 必要に応じてAWS・Google Cloudアイコンや外部画像の埋め込みを選ぶ
4. プレビューを確認し、SVGをコピーまたはダウンロードする

## 変換オプション

- **AWSアイコン**: draw.io公式の`aws4`ライブラリを読み込みます
- **Google Cloudアイコン**: draw.io公式の`gcp2`ライブラリを読み込みます
- **外部画像をSVGへ埋め込む**: 取得先が許可する画像をSVG内へ埋め込みます。取得先のCORS設定などにより埋め込めない場合があります

変換にはdraw.io公式の[embed mode](https://www.drawio.com/doc/faq/embed-mode)を使用します。入力したXMLはGitHub Pagesのサーバーには送られず、ブラウザから`embed.diagrams.net`の埋め込みエディタへ`postMessage`で渡されます。

## 開発

依存パッケージはありません。Node.js 24以降でテストできます。

```bash
npm test
```

ローカル表示は任意の静的Webサーバーで`public/`を配信してください。

```bash
python3 -m http.server 8000 -d public
```

## デプロイ

`main`へのpush時に`.github/workflows/pages.yml`がテストを実行し、成功後にGitHub Pagesへ`public/`をデプロイします。
