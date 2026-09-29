# 馥味香點餐頁

這是一個靜態點餐頁，客人選好商品後，頁面會產生訂單文字並開啟 LINE 官方帳號。**客人仍須在 LINE 聊天室送出訊息，店家才會收到訂單。**本頁沒有後端資料庫或自動接單功能。

## 日常維護

- 商品名稱、價格、組合優惠：修改 `index.html` 中的 `menu` 陣列。
- 商品照片：放在 `images/`，並修改 `index.html` 中的 `PHOTOS` 對應路徑。
- LINE 官方帳號：修改 `redirectToLine()` 中的 `lineId`。
- 付款 QR 圖目前保留原始 PNG，避免有損壓縮影響掃描。

本機預覽可在專案目錄執行 `python -m http.server 8000`，再用瀏覽器打開 `http://localhost:8000`。更新商品價格後可執行 `node --test tests/order.test.cjs`，並用手機實際測一次「選品、優惠、複製、貼到 LINE」流程。歷史訂單儲存在客人自己的瀏覽器內，最多五筆；重新點餐時會使用目前菜單價格。
