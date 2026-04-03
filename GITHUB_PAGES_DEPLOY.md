# GitHub Pages 部署說明

這個專案已經包含一個可直接部署到 GitHub Pages 的純前端版本，放在 `docs/`。

## 目前已準備好的檔案

- `docs/index.html`
- `docs/app.js`
- `docs/songs_db_agent_v1.json`
- `docs/weekly_runtime_input_template.json`
- `.github/workflows/deploy-pages.yml`

## 第一次部署步驟

1. 把專案推到 GitHub 的 `main` branch。
2. 到 GitHub repo 頁面，開啟 `Settings`.
3. 進入 `Pages`.
4. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`.
5. 確認 repo 的預設 branch 是 `main`.
6. 之後每次 push 到 `main`，GitHub Actions 都會自動部署 `docs/`.

## Actions 會做什麼

這個 workflow 會：

1. checkout repo
2. upload `docs/` 內容為 Pages artifact
3. 自動部署到 GitHub Pages

## 部署後網址

部署成功後，網址通常會是：

- `https://<你的帳號>.github.io/<repo-name>/`

如果是 organization repo，則會是對應 organization 的 Pages 網址。

## 要注意的事

1. 這個版本是純前端，`docs/songs_db_agent_v1.json` 會被瀏覽器直接下載。
2. 如果歌庫內容不適合公開，請不要用 public repo。
3. 如果 repo 是 private，GitHub Pages 是否可用取決於你的 GitHub 方案與設定。

## 本地預覽

若要在本地先確認靜態版，可以用任何靜態伺服器開 `docs/`，例如：

```bash
cd /Users/enhung/Documents/worship-agent/docs
python3 -m http.server 8000
```

然後打開：

- `http://127.0.0.1:8000`

## 後續可再做的優化

1. 加 repo 名稱自動偵測與 base path 測試
2. 拆出前端 CSS/JS 檔案結構
3. 若未來歌庫要保密，可改回有登入保護的後端版本

