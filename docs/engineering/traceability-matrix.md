# 闇€姹?鈫?OpenAPI 鈫?鍓嶇瀹炵幇 鈫?Mock 瑕嗙洊鐭╅樀锛圥0锛?
> 鐩殑锛氭妸 `Ipmoney.md`锛堥渶姹?椤甸潰锛変笌 `docs/api/openapi.yaml`锛堟帴鍙ｅ绾︼級浠ュ強鍓嶇瀹炵幇锛坄apps/client`銆乣apps/admin-web`锛夊拰 Mock fixtures锛坄packages/fixtures/scenarios/*/index.json`锛夊榻愶紝蹇€熷彂鐜伴仐婕忎笌涓嶄竴鑷淬€?
琛ュ厖锛堟帴鍙ｅ眰鑷姩鍖栧璁★級锛?- 瑕嗙洊鎶ュ憡锛歚docs/engineering/openapi-coverage.md`锛堢敱 `scripts/audit-coverage.mjs` 鐢熸垚锛?- 鐢ㄩ€旓細蹇€熸牳瀵光€淥penAPI operation 鈫?鍓嶇鏄惁璋冪敤 鈫?fixtures 鏄惁瑕嗙洊鈥?
## 0. 鍙ｅ緞涓庢爣璁?
- **P0 宸插疄鐜?*锛氬墠绔〉闈?浜や簰/鐘舵€佹満鍙窇閫氾紙Mock 椹卞姩锛夛紝瀛楁浠?OpenAPI 涓哄噯銆?- **P0 鍗犱綅**锛氶〉闈㈠瓨鍦ㄤ絾浠呮彁绀?Toast/鍗犱綅鏂囨锛涘悗缁ˉ榻愪氦浜掍笌鎺ュ彛瀵规帴銆?- **P1**锛氭槑纭悗缁啀鍋氾紙涓嶉樆濉?P0 婕旂ず涓庡紑鍙戝紑宸ワ級銆?
Mock fixtures key 绾﹀畾锛?- `method + space + path`锛屼緥濡傦細`GET /search/listings`
- 璺緞鍙傛暟鐢?`:param`锛堜緥濡?`GET /public/listings/:listingId`锛夛紝涓?OpenAPI 鐨?`{param}` 瀵瑰簲銆?
## 1. 鐢ㄦ埛绔紙灏忕▼搴?H5锛宍apps/client`锛?
| 椤甸潰/鑳藉姏 | 闇€姹?璇存槑锛圥RD锛?| 鍓嶇鍏ュ彛 | OpenAPI锛坥perationId / method path锛?| Mock 瑕嗙洊 | 鐘舵€?|
|---|---|---|---|---|---|
| 棣栭〉鎺ㄨ崘 + 蹇嵎鍏ュ彛 + 鐗硅壊涓撳尯 | 娓稿鍙湅锛涙敹钘?鍜ㄨ/涓嬪崟闇€鐧诲綍涓斿鏍搁€氳繃锛涘揩鎹峰叆鍙?3脳2锛堝瑙備笓鍒?鍙戞槑涓撳埄/瀹炵敤涓撳埄/鍙戞槑浜烘/鎶€鏈粡鐞?浜旀槦涓撳埄锛夛紱鐗硅壊涓撳尯鏀寔 4 绫伙紙閫€褰逛笓鍒?娌夌潯涓撳埄/鑾峰涓撳埄/寮€鏀捐鍙級锛屽苟缁熶竴閫氳繃 `listingTopic` 璺宠浆鎼滅储椤点€?| `apps/client/src/pages/home/index.tsx` | `searchListings` `GET /search/listings`锛沗upsertListingConversation` `POST /listings/{listingId}/conversations` | `GET /search/listings`锛沗POST /listings/:listingId/conversations` | P0 宸插疄鐜?|
| 寰俊鐧诲綍 + 鎵嬫満鍙锋巿鏉冨脊绐?+ 韬唤閫夋嫨 | 寰俊鐧诲綍鎴愬姛鍚庯細鑻ユ墜鏈哄彿涓虹┖锛屽脊绐楁彁绀衡€滄巿鏉冩墜鏈哄彿鈥濓紙鍙烦杩囷級锛涢殢鍚庤繘鍏ヨ韩浠介€夋嫨椤碉紙涓汉/鏈烘瀯绛夛級銆?| `apps/client/src/subpackages/login/index.tsx`<br/>`apps/client/src/pages/me/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`锛沗authWechatPhoneBind` `POST /auth/wechat/phone-bind`锛沗submitMyVerification` `POST /me/verification` | `POST /auth/wechat/mp-login`锛沗POST /auth/wechat/phone-bind`锛沗POST /me/verification` | P0 宸插疄鐜?|
| 妫€绱紙绛涢€?鎺掑簭锛?| 杩涘叆鎼滅储涓婚摼璺細涓撳埄浜ゆ槗锛涙悳绱㈡潯涓嬫柊澧炴帓搴?Chip 琛岋紙缁煎悎鎺ㄨ崘/浠锋牸鍗囧簭/浠锋牸闄嶅簭/鏈€鏂板彂甯冿級锛涙父瀹㈠彲鐪嬶紱鍏抽敭鍔ㄤ綔闇€鐧诲綍涓斿鏍搁€氳繃 | `apps/client/src/subpackages/search/index.tsx` | `searchListings` `GET /search/listings` | `GET /search/listings` | P0 宸插疄鐜?|
| 检索（更多筛选对齐） | Search 主链路更多筛选（专利：类型/交易方式/价格/订金/地区/IPC/LOC/行业标签/转让次数/法律状态/特色标签）统一 `FilterSheet`；特色标签统一为 5 类：`HIGH_TECH_RETIRED/SLEEPING/AWARD_WINNING/OPEN_LICENSE/FIVE_STAR`。 | `apps/client/src/subpackages/search/index.tsx` | 同上（仅增加 query 参数） | 同上（补齐更多筛选场景 fixtures） | P0 已实现 |
| 璇︽儏椤碉紙鍏紑鍙锛?| 灞曠ず鎸傜墝淇℃伅 + 涓撳埄璇︽儏妯″潡锛堟憳瑕?闄勫浘/涓撳埄淇℃伅/鏉冨埄浜?璇存槑涔︾粺璁★級锛?*浜ゆ槗琛ュ厖瀛楁锛堝彲浜や粯娓呭崟/棰勮鍛ㄦ湡/鍙皥绌洪棿/璐ㄦ娂涓庤鍙幇鐘讹級**锛涘挩璇?鏀粯璁㈤噾锛堥渶瀹℃牳閫氳繃锛?| `apps/client/src/pages/listing/detail/index.tsx` | `getPublicListingById` `GET /public/listings/{listingId}`锛沗upsertListingConversation` `POST /listings/{listingId}/conversations`锛沗getPatentById` `GET /patents/{patentId}` | `GET /public/listings/:listingId`锛沗GET /patents/:patentId`锛沗POST /listings/:listingId/conversations` | P0 宸插疄鐜?|
| 涓撳埄涓绘暟鎹鎯呴〉锛堝叕寮€鍙锛?| 灞曠ず涓撳埄鍙锋/妗堜欢鐘舵€?涓诲垎绫诲彿/璇存槑涔︾粺璁★紱灞曠ず灏侀潰鍥?+ 璇存槑涔﹂檮鍥撅紱濡傛湁鍏宠仈涓婃灦锛屽睍绀轰环鏍间笌渚涚粰鏂圭被鍨嬶紱姒傝/鎽樿/淇℃伅/璇勮鍚堝苟涓哄崟椤靛睍绀猴紱鎸傜墝璇︽儏涓嶅啀鎻愪緵鈥滅偣鍑绘煡鐪嬩笓鍒╄鎯呪€濊烦杞?| `apps/client/src/pages/patent/detail/index.tsx` | `getPatentById` `GET /patents/{patentId}` | `GET /patents/:patentId` | P0 宸插疄鐜?|
| 鐣欒█鍖猴紙鍏紑锛?| 涓撳埄璇︽儏椤靛簳閮細鍏紑鐣欒█鍒楄〃 + 浜掑姩鍥炲锛涚暀瑷€/鍥炲/缂栬緫/鍒犻櫎闇€鐧诲綍涓斿鏍搁€氳繃锛堢紪杈?鍒犻櫎浠呮湰浜猴級锛涚煭鎸夎瘎璁洪粯璁ゅ洖澶嶅苟婊氬姩鑷宠緭鍏ユ爮锛岄暱鎸夊脊鍑衡€滃洖澶?缂栬緫/鍒犻櫎鈥濓紱鏈仛鐒︽樉绀哄ご鍍?+ 鍗犱綅鏂囨湰鈥滃啓涓嬩綘鐨勭暀瑷€锛屽叡鍚岃璁衡€濓紝鑱氱劍鍚庡湪閿洏涓婃柟鏄剧ず杈撳叆鏍?+ 鍙戝竷鎸夐挳锛堟棤鍐呭鐏拌壊涓嶅彲鐐癸紝鏈夊唴瀹圭偣浜級 | `apps/client/src/pages/listing/detail/index.tsx` | `listPublicListingComments` `GET /public/listings/{listingId}/comments`锛沗createListingComment` `POST /listings/{listingId}/comments`锛沗updateComment` `PATCH /comments/{commentId}`锛沗deleteComment` `DELETE /comments/{commentId}` | fixtures 宸茶鐩栵紙happy/empty/error/edge锛?| P0 宸插疄鐜?|
| 鍙戞槑浜烘锛堟帓鍚嶏級 | 鍙ｅ緞锛氭寜骞冲彴鍐呬笂浼犱笓鍒╃粺璁★紙鍘婚噸锛?| `apps/client/src/pages/inventors/index.tsx` | `searchInventorRankings` `GET /search/inventors` | `GET /search/inventors` | P0 宸插疄鐜?|
| 鎶€鏈粡鐞嗕汉鏍忕洰锛堟帓鍚?妫€绱級 | 灞曠ず瀹℃牳閫氳繃鎶€鏈粡鐞嗕汉锛涙敮鎸佹绱笌鍜ㄨ鍏ュ彛 | `apps/client/src/pages/tech-managers/index.tsx` | `searchTechManagers` `GET /search/tech-managers` | `GET /search/tech-managers` | P0 宸插疄鐜?|
| 鎶€鏈粡鐞嗕汉璇︽儏 | 灞曠ず绠€浠?璧勮川/鏈嶅姟鑼冨洿锛涙彁渚涘湪绾垮挩璇?| `apps/client/src/pages/tech-managers/detail/index.tsx` | `getPublicTechManagerById` `GET /public/tech-managers/{techManagerId}`锛沗upsertTechManagerConversation` `POST /tech-managers/{techManagerId}/conversations` | `GET /public/tech-managers/:techManagerId`锛沗POST /tech-managers/:techManagerId/conversations` | P0 宸插疄鐜?|
| 鏈烘瀯灞曠ず锛堜粎瀹℃牳閫氳繃锛?| 浼佷笟/闄㈡牎绛夊鏍搁€氳繃鍚庡睍绀?| `apps/client/src/pages/organizations/index.tsx` | `listPublicOrganizations` `GET /public/organizations` | `GET /public/organizations` | P0 宸插疄鐜帮紙鍒楄〃锛?|
| 鏈烘瀯璇︽儏 | 鏈烘瀯璇︽儏椤碉紙鍙偣鍙湅锛?| `apps/client/src/pages/organizations/detail/index.tsx` | `getPublicOrganizationById` `GET /public/organizations/{orgUserId}` | `GET /public/organizations/:orgUserId` | P0 宸插疄鐜?|
| 鐧诲綍 | 寰俊/鐭俊鐧诲綍 | `apps/client/src/subpackages/login/index.tsx` | `authWechatMpLogin` `POST /auth/wechat/mp-login`锛沗authSmsSend` `POST /auth/sms/send`锛沗authSmsVerify` `POST /auth/sms/verify` | `POST /auth/wechat/mp-login`锛沗POST /auth/sms/send`锛沗POST /auth/sms/verify` | P0 宸插疄鐜?|
| 棣栨杩涘叆锛氶€夋嫨韬唤 | 涓汉绉掗€氳繃锛涘叾浣欐彁浜よ祫鏂欏緟瀹℃牳 | `apps/client/src/pages/onboarding/choose-identity/index.tsx` | `submitMyVerification` `POST /me/verification` | `POST /me/verification` | P0 宸插疄鐜?|
| 璁よ瘉璧勬枡鎻愪氦 | 涓婁紶璇佹槑鏉愭枡锛涜繘鍏ュ鏍镐腑 | `apps/client/src/pages/onboarding/verification-form/index.tsx` | `uploadFile` `POST /files`锛沗submitMyVerification` `POST /me/verification` | `POST /files`锛沗POST /me/verification` | P0 宸插疄鐜?|
| 娑堟伅鍒楄〃 | 浼氳瘽鍒楄〃/鏈鏁帮紙浼氳瘽鍒涘缓闇€瀹℃牳閫氳繃锛?| `apps/client/src/pages/messages/index.tsx` | `listMyConversations` `GET /me/conversations` | `GET /me/conversations` | P0 宸插疄鐜?|
| 浼氳瘽鑱婂ぉ锛堝伐鍗曞紡娑堟伅锛?| P0 闈炲疄鏃讹紱鏀寔鍒锋柊涓庣暀鐥?| `apps/client/src/pages/messages/chat/index.tsx` | `listConversationMessages` `GET /conversations/{conversationId}/messages`锛沗sendConversationMessage` `POST /conversations/{conversationId}/messages`锛沗markConversationRead` `POST /conversations/{conversationId}/read` | 瀵瑰簲 3 涓?fixtures | P0 宸插疄鐜?|
| 鏀粯璁㈤噾锛堟紨绀猴級 | 灏忕▼搴忥細涓嬪崟鈫掕閲戞敮浠樻剰鍥锯啋缁撴灉椤碉紙寰呯‘璁わ紝涓撳埄锛夛紱H5锛氫粎寮曞鍥炲皬绋嬪簭锛堥渶瀹℃牳閫氳繃锛?| `apps/client/src/pages/checkout/deposit-pay/index.tsx` | `createOrder` `POST /orders`锛沗createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders`锛沗POST /orders/:orderId/payment-intents` | P0 宸插疄鐜帮紙婕旂ず璺宠浆锛?|
| 璁㈤噾缁撴灉椤碉紙寰呯‘璁わ級 | 灞曠ず璁㈠崟淇℃伅/涓嬩竴姝?| `apps/client/src/pages/checkout/deposit-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 宸插疄鐜?|
| 鏀粯灏炬锛堟紨绀猴級 | 灏忕▼搴忥細灏炬鏀粯鎰忓浘鈫掔粨鏋滈〉锛堝緟纭锛夛紱H5锛氫粎寮曞鍥炲皬绋嬪簭锛堥渶瀹℃牳閫氳繃锛?| `apps/client/src/pages/checkout/final-pay/index.tsx` | `createPaymentIntent` `POST /orders/{orderId}/payment-intents` | `POST /orders/:orderId/payment-intents` | P0 宸插疄鐜帮紙婕旂ず璺宠浆锛?|
| 灏炬缁撴灉椤碉紙寰呯‘璁わ級 | 灞曠ず璁㈠崟淇℃伅/涓嬩竴姝?| `apps/client/src/pages/checkout/final-success/index.tsx` | `getOrderById` `GET /orders/{orderId}` | `GET /orders/:orderId` | P0 宸插疄鐜?|
| 璁㈠崟璇︽儏锛堜笅涓€姝ュ叆鍙ｏ級 | 鐘舵€侀┍鍔細WAIT_FINAL_PAYMENT 鈫?鏀粯灏炬锛堣烦杞熬娆炬敮浠橀〉锛?| `apps/client/src/pages/orders/detail/index.tsx` | - | - | P0 宸插疄鐜?|
| 鍙戝竷鍏ュ彛锛堝崠瀹朵晶锛?| 鍙戝竷鍓嶉渶鐧诲綍+韬唤閫夋嫨锛涢潪涓汉闇€瀹℃牳锛堜笓鍒╋級 | `apps/client/src/pages/publish/index.tsx` | `getMyVerification` `GET /me/verification`锛堝墠缃牎楠岋級 | `GET /me/verification` | P0 宸插疄鐜?|
| 发布专利交易（表单） | 权属/价格/地域/标签；**可交付清单/预计周期/可谈空间/质押与许可现状声明**；新增特色标签多选（写入 `listingTopics`，与 `tradeMode=LICENSE` 联动 `OPEN_LICENSE`）；草稿/提交审核 | `apps/client/src/subpackages/publish/patent/index.tsx` | `normalizePatentNumber` `POST /patents/normalize`；`uploadFile` `POST /files`；`createListing` `POST /listings`；`updateListing` `PATCH /listings/{listingId}`；`submitListing` `POST /listings/{listingId}/submit` | 对应 fixtures 已覆盖 | P0 已实现 |
| 鎴戠殑涓撳埄涓婃灦 | 鍙戝竷鏂规煡鐪?缂栬緫/涓嬫灦 | `apps/client/src/pages/my-listings/index.tsx` | `listMyListings` `GET /listings`锛沗offShelfListing` `POST /listings/{listingId}/off-shelf` | `GET /listings`锛沗POST /listings/:listingId/off-shelf` | P0 宸插疄鐜?|
| 鏀惰棌 | 鏀惰棌/鍙栨秷鏀惰棌/鏀惰棌鍒楄〃锛堜笓鍒╋級 | `apps/client/src/pages/favorites/index.tsx` | `favoriteListing` `POST /listings/{listingId}/favorites`锛沗unfavoriteListing` `DELETE /listings/{listingId}/favorites`锛沗listMyFavoriteListings` `GET /me/favorites` | `POST /listings/:listingId/favorites`锛沗DELETE /listings/:listingId/favorites`锛沗GET /me/favorites` | P0 宸插疄鐜?|
| 閫€娆撅紙涔板渚э級 | 閫€娆剧敵璇?杩涘害鏌ヨ锛堝叆鍙ｏ細璁㈠崟璇︽儏锛?| `apps/client/src/pages/orders/detail/index.tsx` | `createRefundRequest` `POST /orders/{orderId}/refund-requests`锛沗listRefundRequestsByOrder` `GET /orders/{orderId}/refund-requests` | `POST /orders/:orderId/refund-requests`锛沗GET /orders/:orderId/refund-requests` | P0 宸插疄鐜?|

## 2. 绠＄悊鍚庡彴锛圥C Web锛宍apps/admin-web`锛?
| 椤甸潰/鑳藉姏 | 闇€姹?璇存槑锛圥RD锛?| 鍓嶇鍏ュ彛 | OpenAPI锛坥perationId / method path锛?| Mock 瑕嗙洊 | 鐘舵€?|
|---|---|---|---|---|---|
| 鐧诲綍锛堟紨绀猴級 | P0 demo token | `apps/admin-web/src/views/LoginPage.tsx` |锛堟湭鎺ョ湡瀹炵櫥褰曪級 |锛堟棤锛?| P0 鍗犱綅 |
| 浠〃鐩?| 寰呭璁よ瘉/寰呭涓婃灦/璁㈠崟姒傝 | `apps/admin-web/src/views/DashboardPage.tsx` | `adminListUserVerifications`锛沗adminListListingsForAudit`锛沗listMyOrders` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 璁よ瘉瀹℃牳 | 瀹℃牳閫氳繃/椹冲洖 | `apps/admin-web/src/views/VerificationsPage.tsx` | `adminListUserVerifications`锛沗adminApproveUserVerification`锛沗adminRejectUserVerification` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 鎶€鏈粡鐞嗕汉鏍忕洰绠＄悊 | 灞曠ず寮€鍏?鎺ㄨ崘閰嶇疆/鏈嶅姟鏍囩缁存姢 | `apps/admin-web/src/views/TechManagersPage.tsx` | `adminListTechManagers` `GET /admin/tech-managers`锛沗adminUpdateTechManager` `PATCH /admin/tech-managers/{techManagerId}` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 涓婃灦瀹℃牳 | 瀹℃牳閫氳繃/椹冲洖/鐪佸競鐗硅壊缃《 | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminListListingsForAudit`锛沗adminApproveListing`锛沗adminRejectListing`锛沗adminSetListingFeatured` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 鐣欒█绠＄悊 | 鐣欒█鍒楄〃 + 鎼滅储/绛涢€?+ 闅愯棌/鎭㈠/鍒犻櫎 | `apps/admin-web/src/views/CommentsPage.tsx` | `adminListComments`锛沗adminUpdateComment` | `GET /admin/comments`锛沗PATCH /admin/comments/:commentId`锛坒ixtures 宸茶鐩栵級 | P0 宸插疄鐜?|
| 璁㈠崟绠＄悊 | 閲岀▼纰戯細鍚堝悓纭/鍙樻洿瀹屾垚 | `apps/admin-web/src/views/OrdersPage.tsx` | `listMyOrders`锛沗adminConfirmContractSigned`锛沗adminConfirmTransferCompleted` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 鏀粯纭锛堟墜宸ワ級 | 璁㈤噾/灏炬鏀粯寰呯‘璁?鈫?宸插叆璐︼紙婕旂ず锛?| `apps/admin-web/src/views/OrderDetailPage.tsx` | `adminManualConfirmPayment` `POST /admin/orders/{orderId}/payments/manual` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 閫€娆惧鎵?| 閫氳繃/椹冲洖锛涘け璐ユ彁绀?| `apps/admin-web/src/views/RefundsPage.tsx` | `listRefundRequestsByOrder`锛沗adminApproveRefundRequest`锛沗adminRejectRefundRequest` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 閫€娆惧畬鎴愶紙鎵嬪伐锛?| 閫€娆鹃€氳繃鍚庢墜宸ュ畬鎴愶紙婕旂ず锛?| `apps/admin-web/src/views/RefundsPage.tsx` | `adminCompleteRefundRequest` `POST /admin/refund-requests/{refundRequestId}/complete` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 缁撶畻/鏀炬 | 涓婁紶鍑瘉鈫掔‘璁ゆ斁娆?| `apps/admin-web/src/views/SettlementsPage.tsx` | `adminGetOrderSettlement`锛沗adminConfirmManualPayout`锛沗uploadFile` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 鍙戠エ涓婁紶/鍒犻櫎 | 绾夸笅寮€绁ㄥ悗涓婁紶闄勪欢锛涜鍗曞唴涓嬭浇 | `apps/admin-web/src/views/InvoicesPage.tsx` | `getOrderInvoice`锛沗adminUpsertOrderInvoice`锛沗adminDeleteOrderInvoice`锛沗uploadFile` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 浜ゆ槗瑙勫垯/鎺ㄨ崘閰嶇疆 | 璁㈤噾/浣ｉ噾/閫€娆剧獥鍙ｏ紱鎺ㄨ崘鏉冮噸绯绘暟 | `apps/admin-web/src/views/ConfigPage.tsx` | `adminGetTradeRulesConfig`锛沗adminUpdateTradeRulesConfig`锛沗adminGetRecommendationConfig`锛沗adminUpdateRecommendationConfig` | fixtures 宸茶鐩?| P0 宸插疄鐜?|
| 鍦板尯/浜т笟鏍囩 | 鍖哄煙涓績鐐?浜т笟鏍囩鐢ㄤ簬鍦板煙鎺ㄨ崘涓庤繍钀ラ厤缃?| `apps/admin-web/src/views/RegionsPage.tsx` | `adminListRegions`锛沗adminCreateRegion`锛沗adminUpdateRegion`锛沗adminListIndustryTags`锛沗adminCreateIndustryTag`锛沗adminSetRegionIndustryTags` | fixtures 宸茶鐩?| P0 宸插疄鐜?|

## 3. 褰撳墠鈥滅己鍙ｆ竻鍗曗€濓紙寤鸿鎸夋紨绀?楠屾敹浼樺厛绾ф帓锛?
- P0 鍓嶇楠ㄦ灦宸叉敹鍙ｏ細鏀惰棌銆佹満鏋勮鎯呫€佺櫥褰曘€佷拱瀹惰鍗?閫€娆惧叆鍙ｃ€佷氦鏄撹鍒欏墠鍙板睍绀虹瓑鍧囧凡瀵归綈 OpenAPI锛屽苟琛ラ綈 happy fixtures锛涙妧鏈粡鐞嗕汉鏍忕洰宸茶繘鍏?P0 宸插疄鐜般€?- 浠嶅睘鍚庣鑱旇皟椤癸細寰俊鏀粯/閫€娆惧洖璋冮獙绛句笌骞傜瓑锛坄POST /webhooks/wechatpay/notify`锛屽墠绔笉璋冪敤锛夈€?
### 3.1 OpenAPI 宸叉湁浣嗗墠绔殏鏈秷璐癸紙闇€纭 P0/P1锛?

### 3.2 P1 棰勭暀鑳藉姏锛圓I/鎵樼/鍛婅/骞冲彴鍐呭锛?
| 椤甸潰/鑳藉姏 | 闇€姹?璇存槑锛圥RD锛?| 鍓嶇鍏ュ彛 | OpenAPI锛坥perationId / method path锛?| Mock 瑕嗙洊 | 鐘舵€?|
|---|---|---|---|---|---|
| 鏅鸿兘浣撹涔夋绱紙鏂囨湰鍏ュ彛锛?| 鑷劧璇█ 鈫?缁撴瀯鍖栨绱㈡潯浠讹紱璇煶鍏ュ彛浠嶄负 P1 | `apps/client/src/pages/home/index.tsx`<br/>`apps/client/src/pages/search/index.tsx` | `createAiAgentQuery` `POST /ai/agent/query` | `POST /ai/agent/query` | P1锛堝凡钀藉湴鍩虹鐗堬級 |
| AI 瑙ｆ瀽鍗＄墖 + 璇勫垎 | 涓撳埄璇︽儏灞曠ず AI 瑙ｆ瀽骞惰瘎鍒嗙籂閿?| `apps/client/src/pages/listing/detail/index.tsx` | `createAiParseFeedback` `POST /ai/parse-results/{parseResultId}/feedback` | `POST /ai/parse-results/:parseResultId/feedback` | P1锛堝凡钀藉湴鍩虹鐗堬級 |
| 骞冲彴鑷湁鍐呭 CMS | 鍚庡彴鍒涘缓/缂栬緫/鍙戝竷/涓嬫灦鎸傜墝锛堜笓鍒╋級 | `apps/admin-web/src/views/ListingsAuditPage.tsx` | `adminCreateListing`/`adminUpdateListing`/`adminPublishListing`/`adminOffShelfListing` | fixtures 宸茶鐩栵紙happy锛?| P1锛堝凡钀藉湴鍩虹鐗堬級 |
| AI 瑙ｆ瀽澶嶆牳姹?| 浣庤瘎鍒?浣庣疆淇″害杩涘叆鍚庡彴澶嶆牳姹?| `apps/admin-web/src/views/AiParseResultsPage.tsx` | `adminListAiParseResults` `GET /admin/ai/parse-results` | - | P1锛堝凡钀藉湴鍩虹鐗堬級 |
| 涓撳埄鎵樼浠诲姟 | 骞磋垂鏃ョ▼ + 鎵樼浠诲姟鎸囨淳 | `apps/admin-web/src/views/MaintenancePage.tsx` | `adminListPatentMaintenanceSchedules` `GET /admin/patent-maintenance/schedules`锛沗adminListPatentMaintenanceTasks` `GET /admin/patent-maintenance/tasks` | - | P1锛堝凡钀藉湴鍩虹鐗堬級 |
| 鍛婅涓績 | 鐭俊/閭欢/绔欏唴鍛婅锛屾敮鎸佺‘璁?| `apps/admin-web/src/views/AlertsPage.tsx` | `adminListAlertEvents` `GET /admin/alerts`锛沗adminAcknowledgeAlertEvent` `POST /admin/alerts/{alertId}/ack` | - | P1锛堝凡钀藉湴鍩虹鐗堬級 |
| 澶ф暟鎹垎鏋愪腑蹇?| 浜ゆ槗搴?涓撳埄搴撴寚鏍囩湅鏉夸笌瀵煎嚭 | `apps/admin-web/src/views/PlaceholderPage.tsx`锛堝緟琛ワ級 | - | - | P1 |
