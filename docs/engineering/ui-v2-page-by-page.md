# UI v2 閫愰〉瀵圭収琛紙钀藉疄鍒伴〉闈綔鍙仛瑙勫垝锛?
> 瀵圭収鐩爣锛歚docs/engineering/ui-v2-spec.md`  
> 璇存槑锛氭湰鏂囦欢鏄€滈€愰〉浠诲姟鎷嗚В + 楠屾敹鍙ｅ緞鈥濓紝涓嶅仛浠讳綍浠ｇ爜鏀瑰姩銆?>
> 琛ュ厖锛氱瓫閫?鎺掑簭/鍒嗙被鐨勫弬鏁板榻愯〃瑙?`docs/engineering/ui-v2-filter-mapping.md`锛圤penAPI 鈫?UI 閫愰」瀵归綈锛夈€?
## 0. 鍏堜慨鐨勭‖椋庨櫓锛圥0锛屽奖鍝嶅叏灞€浣撻獙锛?
### RISK-P0-01锛氭潈闄愭牎楠屽鑷撮〉闈⑩€滃崱鍦?Loading鈥?
鐜扮姸妯″紡锛堝椤靛瓨鍦級锛?
- `load()` 鍐呯涓€琛?`if (!ensureApproved()) return;`
- 椤甸潰鍒濆 `loading=true`
- 缁撴灉锛氭湭瀹℃牳閫氳繃鏃堕〉闈㈠仠鐣欏湪 LoadingCard锛堢敤鎴锋劅鐭ヤ负鈥滅┖鐧?鍗℃鈥濓級

娑夊強椤甸潰锛堟寜褰撳墠瀹炵幇蹇€熸壂鎻忥級锛?
- `apps/client/src/pages/favorites/index.tsx`
- `apps/client/src/pages/orders/index.tsx`
- `apps/client/src/pages/orders/detail/index.tsx`
- `apps/client/src/pages/my-listings/index.tsx`

v2 瑙勮寖瑕佹眰锛?
- 椤甸潰绾?`approved-required` 蹇呴』鏄惧紡娓叉煋 `Permission/Audit` 鐘舵€侊紙鑰屼笉鏄湪璇锋眰鍓?return锛?- loading/error/empty 鍙兘鐢ㄤ簬鈥滄暟鎹姸鎬佲€濓紝涓嶈兘鎵挎媴鈥滄潈闄愮姸鎬佲€?
楠屾敹锛?
- 鏈櫥褰?鏈€夋嫨韬唤/瀹℃牳鏈€氳繃鏃讹紝涓婅堪椤甸潰涓嶅嚭鐜?LoadingCard 鍗℃锛涙湁鏄庣‘鐨勪笅涓€姝ユ寜閽?
### RISK-P0-02锛欸ET 鍙傛暟姹℃煋锛坄q=undefined`锛?
鐜扮姸锛?
- 閮ㄥ垎椤甸潰鎶?`undefined` 浣滀负 data 浼犲叆 GET锛岃姹備細鍙樻垚 `q=undefined`

娑夊強椤甸潰锛堝凡澶嶇幇锛夛細

- `apps/client/src/pages/inventors/index.tsx`
- `apps/client/src/pages/organizations/index.tsx`

v2 瑙勮寖瑕佹眰锛?
- 鍙傛暟娓呮礂锛氱姝?`undefined/null/''` 杩涘叆 query锛堥櫎闈炲瓧娈垫槑纭厑璁革級

楠屾敹锛?
- 鎶撳寘涓笉鍐嶅嚭鐜?`q=undefined`

## 1. Client锛坅pps/client锛夐€愰〉浠诲姟鎷嗚В

> 椤甸潰璺緞锛歚apps/client/src/pages/**/index.tsx`  
> 妯℃澘瀹氫箟锛氳 `docs/engineering/ui-v2-spec.md`

### 1.1 Tab 椤?
#### Home锛坄pages/home/index`锛?
- 妯℃澘锛欰锛圱ab Landing锛?- 椤甸潰绛栫暐锛歱ublic锛涘姩浣滐紙鏀惰棌/鍜ㄨ/涓嬪崟锛? approved-required
- P0锛堝繀椤伙級
  - 鍏ュ彛鍗＄墖娓愬彉缁熶竴涓衡€滄笎鍙?token鈥濓紙绂佹鏁ｈ惤纭紪鐮佹笎鍙橈級
  - Home 椤堕儴鍝佺墝鍖猴紙Logo/鏍囪/楂樺害/鐣欑櫧锛夊浐鍖栦负妯℃澘瑙勫垯锛岄伩鍏嶅悗缁〉闈㈤殢鎰忔敼
  - 鍒楄〃鍖哄煙鐨?Loading/Error/Empty 缁熶竴鐢?v2 鐘舵€佹満鍙ｅ緞锛堟枃妗堜笌鎸夐挳浣嶇疆涓€鑷达級
  - 首页推荐专利卡片与专利结果卡片统一（复用 ListingCard）
- P1锛堝缓璁級
  - 鈮?68px 妗岄潰瀹藉害锛氭寜鈥滃眳涓墜鏈哄搴︹€濆睍绀猴紙閿佸畾瀛楀彿/鍐呭鍖哄眳涓?鍚稿簳瀵归綈锛夛紱鍙屽垪浣滀负 P2 鍙€?
#### Search锛坄pages/search/index`锛?
- 妯℃澘锛欰 + B锛圱ab + Filter List锛?- 椤甸潰绛栫暐锛歱ublic锛涘姩浣滐紙鏀惰棌/鍜ㄨ锛? approved-required
- P0锛堝繀椤伙級
  - 绛涢€?Popup锛氱粺涓€鈥滄墦寮€/鍏抽棴/閲嶇疆/搴旂敤鈥濈殑浜や簰涓庢寜閽『搴忥紙涓?v2 妯℃澘涓€鑷达級
  - Chip 缁勪欢锛氶€変腑鎬?绂佺敤鎬?瀵嗗害缁熶竴锛堥伩鍏嶇瓫閫夊尯鍚庣画鎵╁睍鍙戞暎锛?  - 鏂囨涓庡瓧娈?label 鍏ㄩ儴璧扮粺涓€鏈锛堟敹钘?鍜ㄨ/浠锋牸绫诲瀷绛夛級
  - 鎼滅储鏉′笅鏂板鎺掑簭 Chip 琛岋紙缁煎悎鎺ㄨ崘/浠锋牸鍗囧簭/浠锋牸闄嶅簭/鏈€鏂板彂甯冿級锛屾浛浠ｆ棫鎺掑簭鍏ュ彛鐨勨€滄洿澶氬脊灞傗€濅綋楠?  - 妫€绱㈤〉鑳屾櫙涓庣粨鏋滃崱鐗囪壊璋冨榻愮洰鏍囪璁★紙绫崇櫧鑳屾櫙銆佸崱鐗囬槾褰便€佹鑹?鏆栫伆寮鸿皟锛?- P1锛堝缓璁級
  - 鎼滅储璇锋眰骞跺彂鎺у埗锛氱瓫閫夊揩閫熷垏鎹㈡椂涓㈠純杩囨湡璇锋眰缁撴灉锛堥伩鍏嶁€滃洖璺虫棫缁撴灉鈥濓級

#### Publish锛坄pages/publish/index`锛?
- 妯℃澘锛欰锛圱ab Landing锛?- 椤甸潰绛栫暐锛歭ogin-required锛涘彂甯冨姩浣?= approved-required
- P0锛堝繀椤伙級
  - 鍘婚櫎鐢ㄦ埛鍙鈥淧0/婕旂ず鈥濇枃妗堬紙浠?dev-only 鍙锛?  - 鏉冮檺鍒嗘敮锛堟湭鐧诲綍/鏈€夎韩浠?鏈鏍革級缁熶竴浣跨敤 v2 鐨?Permission/Audit 缁勪欢瑙勮寖锛堟爣棰樸€佽鏄庛€佹寜閽枃妗堬級
- P1锛堝缓璁級
  - 鍙戝竷鍏ュ彛鍗＄墖锛氫负 Demand/Achievement 琛ラ綈鈥滃崰浣嶇姸鎬佲€濊鑼冿紙瑙佸搴旈〉闈級

  - PullToRefresh (NutUI) for conversation list; keep manual refresh button for desktop/H5
#### Messages锛坄pages/messages/index`锛?
- 妯℃澘锛欰锛圱ab Landing + 浼氳瘽鍒楄〃锛?- 椤甸潰绛栫暐锛歭ogin-required锛涜繘鍏ヤ細璇?= approved-required
- P0锛堝繀椤伙級
  - 绌烘€佹枃妗堝幓鈥滄紨绀衡€濆瓧鏍凤紱绌烘€佸繀椤荤粰鈥滄€庝箞浜х敓浼氳瘽鈥濈殑鍙鍔ㄥ紩瀵硷紙鍘昏鎯呴〉鍜ㄨ/鍘绘悳绱級
  - 浼氳瘽鍒楄〃 cell 鐨勫瘑搴?澶村儚/鏃堕棿灞曠ず缁熶竴锛堥厤鍚堟椂闂存牸寮忓寲锛?  - 浼氳瘽鍒楄〃浼樺厛鐢?NutUI 鐜版垚缁勪欢鏀跺彛锛歚Avatar` + `Badge` + `Tag` + `Cell`锛堟洿鍍忓井淇★紝鍑忓皯鑷粯鏍峰紡锛?- P1锛堝缓璁級
  - 鍒锋柊绛栫暐锛氫笅鎷夊埛鏂?杩涘叆椤甸潰鑷姩鍒锋柊鑺傛祦锛堥伩鍏嶉绻佽姹傦級

#### Me锛坄pages/me/index`锛?
- 妯℃澘锛欰锛圱ab Landing锛?- 椤甸潰绛栫暐锛歱ublic锛涜祫鏂?閫€鍑?璋冭瘯 = login-required
- P0锛堝繀椤伙級
  - 璋冭瘯鍖猴紙Mock 鍦烘櫙锛夊繀椤讳弗鏍?dev-only锛堝凡鏈夊紑鍏筹紝浣嗛渶瑙勮寖锛歎I 涓嶄笌姝ｅ紡鍖烘贩鎺掞紝涓旀枃妗堜笉褰卞搷婕旂ず瑙傛劅锛?  - 璧勬枡鍗＄墖鐨勫竷灞€锛堟樀绉?鎵嬫満鍙?璁よ瘉 tag锛夌粺涓€ token 涓庨棿璺濓紙鍑忓皯 inline style锛?- P1锛堝缓璁級
  - 鈥滆璇佺姸鎬佲€濆睍绀烘爣鍑嗗寲锛欰PPROVED/PENDING/REJECTED 鐨勮В閲婃枃妗堜笌涓嬩竴姝ュ姩浣滀竴鑷?
### 1.2 闈?Tab锛氬垪琛ㄤ笌璇︽儏

#### Inventors锛坄pages/inventors/index`锛?
- Template: List-only (no search/sort/filter) - Public
- P0
  - Ranking card layout: left rank badge (number centered + label below), middle name + optional location/tags, right stats (专利数/关联上架).
  - Top1-3 visual highlight; #4+ use muted badge style (no TOP tag).
#### Organizations锛坄pages/organizations/index`锛?
- 妯℃澘锛欱锛圠ist + Search锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - 淇 GET 鍙傛暟姹℃煋锛氱姝㈠嚭鐜?`q=undefined`
  - 鍒楄〃鍗＄墖淇℃伅灞傜骇缁熶竴锛堝悕绉?绫诲瀷 tag/鍦板尯/缁熻/绠€浠嬭鏁帮級
- P1锛堝缓璁級
  - 鏀寔鈥滅瓫閫夛細鍦板尯/绫诲瀷/鐑棬鈥濈瓑锛堜笌 Search 鐨勭瓫閫変綋绯诲鐢級

#### Patent Map锛坄pages/patent-map/index`锛?
- 妯℃澘锛欱锛圠ist锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - 鈥滄殏鏃犳暟鎹€濇枃妗堝幓 P0 瀛楁牱锛涚┖鎬佸繀椤荤粰涓嬩竴姝ュ姩浣滐紙鍒锋柊/鑱旂郴鍚庡彴缁存姢锛?  - 骞翠唤 Segmented锛氶€変腑鎬?婊氬姩绛栫暐涓庡叾瀹?Segmented 涓€鑷?- P1锛堝缓璁級
  - 鍦板浘灞傜骇锛堢渷/甯傦級涓庣瓫閫夌瓥鐣ワ紙鍚庣画鎵╁睍鐨勬ā鏉块鐣欙級

#### Patent Map Region Detail锛坄pages/patent-map/region-detail/index`锛?
- 妯℃澘锛欳锛圖etail锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - 椤堕儴淇℃伅鍖烘敹鍙ｏ細鐢?NutUI `Tag`/`Space` 灞曠ず 骞翠唤/涓撳埄鏁?鏇存柊鏃堕棿锛堥伩鍏?MetaPills 涓庤嚜缁?tag 娣锋帓锛?  - 璇︽儏鍒嗗潡锛堜骇涓氬垎甯?閲嶇偣鍗曚綅锛夌粺涓€ list-item 瑙嗚涓庣┖鎬佹枃妗堬紙鈥滐紙鏆傛棤锛夆€濈粺涓€涓?v2 绌烘€佹牱寮忥級
- P1锛堝缓璁級
  - 澧炲姞鈥滆繑鍥?鍒囨崲骞翠唤鈥濅竴鑷寸殑椤堕儴鎿嶄綔鍖猴紙閬垮厤鐢ㄦ埛杩疯矾锛?
#### Organization Detail锛坄pages/organizations/detail/index`锛?
- 妯℃澘锛欳锛圖etail锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱锛涜鏄庢枃妗堢缉鐭苟鍙壂璇?  - 璇︽儏淇℃伅甯冨眬缁熶竴锛氬ご鍍?鍚嶇О/鏍囩/缁熻淇℃伅鐨勫榻愪笌鏂瑙勫垯
  - 椤堕儴淇℃伅鍖烘敹鍙ｏ細鐢?NutUI `Avatar` + `Tag` + `Space` 灞曠ず 鏈烘瀯绫诲瀷/鍦板尯/涓婃灦鏁?涓撳埄鏁帮紙閬垮厤 MetaPills 涓庤嚜缁?tag 娣锋帓锛?- P1锛堝缓璁級
  - 澧炲姞鈥滆仈绯?鍜ㄨ鈥濆叆鍙ｏ紙濡傛灉浜у搧闇€瑕侊級锛屽苟缁熶竴鏉冮檺绛栫暐

#### Listing Detail锛坄pages/listing/detail/index`锛?
- 妯℃澘锛欳锛圖etail + Sticky CTA锛?- 椤甸潰绛栫暐锛歱ublic锛涘姩浣滐紙鏀惰棌/鍜ㄨ/璁㈤噾锛? approved-required
- P0锛堝繀椤伙級
  - 璇︽儏棣栧睆淇℃伅灞傜骇鍥哄寲锛氭爣棰?绫诲瀷/浠锋牸/璁㈤噾/鍗栧/鐑害鐨勫睍绀洪『搴忎笌瀵嗗害
  - 棣栧睆銆屽垎绫?鏍囩銆嶅尯鍒嗗眰绾э細鍏抽敭鏍囩锛堢被鍨?浜ゆ槗/浠锋牸绫诲瀷/鐗硅壊锛? 娆¤鏍囩锛堝湴鍖?琛屼笟锛夛紱鐢?NutUI `Tag`/`Space` 鏀跺彛锛岄伩鍏?MetaPills 鍫嗘弧涓€灞?  - 鍗栧淇℃伅鐢?NutUI `Avatar` + `Tag`锛堣璇佺被鍨嬶級锛岀儹搴︼紙娴忚/鏀惰棌/鍜ㄨ锛変篃鐢?`Tag` 缁熶竴锛堥伩鍏嶉灞?MetaPills/鑷粯娣风敤锛?  - 姒傝/鎽樿/淇℃伅鍒嗗伐锛氭瑙堝睍绀烘寕鐗屼俊鎭?涓撳埄淇℃伅+鏃堕棿淇℃伅锛涙憳瑕佸睍绀烘妧鏈憳瑕?闄勫浘锛涗俊鎭睍绀烘潈鍒╀汉淇℃伅+璇存槑涔︾粺璁★紙閬垮厤閲嶅灞曠ず锛?  - 绉婚櫎鈥滃叧鑱斾笓鍒?鐐瑰嚮鏌ョ湅涓撳埄璇︽儏鈥濊烦杞紝鍦ㄦ寕鐗岃鎯呴〉鍐呭祵涓撳埄璇︽儏妯″潡锛堟憳瑕?闄勫浘/涓撳埄淇℃伅/鏉冨埄浜?璇存槑涔︾粺璁★級锛岄伩鍏嶉噸澶嶅睍绀?  - StickyBar锛氫笁鎸夐挳涓绘瑙勫垯缁熶竴锛堟渶澶?1 涓?primary锛涘叾浣?ghost锛?  - 缂哄弬鍏滃簳宸插瓨鍦紝浣嗘枃妗堥渶缁熶竴鏈锛堝弬鏁扮己澶?鈫?杩斿洖锛?- P1锛堝缓璁級
  - 浠锋牸/璁㈤噾/缁熻/鏃堕棿缁熶竴鏍煎紡鍖栵紙閲戦涓や綅灏忔暟銆佹椂闂村彲璇伙級

#### Demand Detail (`pages/demand/detail/index`)

- Template: C (Detail + Sticky CTA)
- Page policy: public; actions (favorite/consult) = approved-required
- P0 (must)
  - Detail hero: cover/title/meta density aligned with Listing Detail
  - ?????coverUrl ??/??????????? IMAGE ????????????
  - 椤堕儴淇℃伅鍖虹敤鎴愮啛缁勪欢鏀跺彛锛歂utUI `Tag`/`Space`锛堥绠?鍚堜綔鏂瑰紡/琛屼笟/鍦板尯/鍙戝竷鏃堕棿/鐑害锛夛紱鍙戝竷鏂圭敤 `Avatar` + 璁よ瘉绫诲瀷 label
  - Meta formatting: createdAt uses formatTimeSmart; region/time/stats are scannable
  - Media section: reuse shared MediaSection (IMAGE/VIDEO/FILE) with preview + copy link
  - VIDEO 鍏滃簳锛氭挱鏀惧け璐ヤ笉搴旂櫧灞?鎶涘紓甯革紱澧炲姞 `onError` toast + 澶嶅埗閾炬帴锛沠ixtures 閲岀殑瑙嗛 URL 涓嶇敤 `example.com`锛堝彲鏀逛负鍙挱鏀剧ず渚嬶紝濡?MDN `cc0-videos/flower.mp4`锛?  - Reduce inline styles: prefer shared components (Surface/SectionHeader/Spacer)
- P1 (suggest)
  - Long text UX: expand/collapse for description when too long

#### Achievement Detail (`pages/achievement/detail/index`)

- Template: C (Detail + Sticky CTA)
- Page policy: public; actions (favorite/consult) = approved-required
- P0 (must)
  - Detail hero: cover/title/meta density aligned with Listing Detail
  - ?????coverUrl ??/??????????? IMAGE ????????????
  - 椤堕儴淇℃伅鍖虹敤鎴愮啛缁勪欢鏀跺彛锛歂utUI `Tag`/`Space`锛堟垚鐔熷害/鍚堜綔鏂瑰紡/琛屼笟/鍦板尯/鍙戝竷鏃堕棿/鐑害锛夛紱鍙戝竷鏂圭敤 `Avatar` + 璁よ瘉绫诲瀷 label
  - Meta formatting: createdAt uses formatTimeSmart; region/time/stats are scannable
  - Media section: reuse shared MediaSection (IMAGE/VIDEO/FILE) with preview + copy link
  - VIDEO 鍏滃簳锛氭挱鏀惧け璐ヤ笉搴旂櫧灞?鎶涘紓甯革紱澧炲姞 `onError` toast + 澶嶅埗閾炬帴锛沠ixtures 閲岀殑瑙嗛 URL 涓嶇敤 `example.com`锛堝彲鏀逛负鍙挱鏀剧ず渚嬶紝濡?MDN `cc0-videos/flower.mp4`锛?  - Reduce inline styles: prefer shared components (Surface/SectionHeader/Spacer)
- P1 (suggest)
  - Add share entry if product needs it

#### Patent Detail锛坄pages/patent/detail/index`锛?
- Template: C (Detail)
- Page policy: public
- P0 (must)
  - Map legalStatus to readable label + tone (avoid showing UNKNOWN/raw enum)
  - Key info uses consistent blocks (MetaPills/SectionHeader) and avoids redundant separators
  - Dates are formatted consistently (no raw ISO)
  - 椤堕儴淇℃伅鍖烘敹鍙ｏ細鐢?NutUI `Tag`/`Space` 灞曠ず 绫诲瀷/娉曞緥鐘舵€?鐢宠鍙凤紝骞舵彁渚涒€滃鍒剁敵璇峰彿鈥濆姩浣滐紙閬垮厤淇℃伅鏁ｈ惤锛?  - 姒傝/鎽樿/淇℃伅/璇勮鍚堝苟涓哄崟椤靛睍绀猴紝閬垮厤瀛愰〉璺宠浆
- P1 (suggest)
  - Add quick actions (copy applicationNo, share) if product needs

#### Trade Rules锛坄pages/trade-rules/index`锛?
- 妯℃澘锛欸锛圥olicy锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱
  - 瑙勫垯椤靛繀椤烩€滃彲鎵鈥濓細鍒嗚妭鏍囬 + 瑕佺偣鍒楄〃 + 鍏抽敭鏁板瓧寮鸿皟锛堥伩鍏嶉暱娈佃惤锛?  - 鍏抽敭鏁板瓧/鍙傛暟灞曠ず鐢?NutUI `Tag`/`Space` 鏀跺彛锛堥伩鍏?MetaPills 涓庤嚜缁?tag 娣锋帓锛?- P1锛堝缓璁級
  - 澧炲姞鈥滅ず渚?FAQ鈥濇姌鍙犲尯锛堝噺灏戣瑙ｄ笌瀹㈡湇鎴愭湰锛?
### 1.3 闇€瑕佸鏍哥殑鈥滄垜鐨勨€濈被椤甸潰锛堥噸鐐逛慨澶?Loading 鍗℃锛?
#### Favorites锛坄pages/favorites/index`锛?
- 妯℃澘锛欱锛圠ist锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 淇 RISK-P0-01锛氭湭閫氳繃瀹℃牳鏃朵笉鑳藉崱 Loading锛屽繀椤绘樉绀?Audit/Permission 鐘舵€佸苟缁欒烦杞?  - 绌烘€佸紩瀵硷細鏃犳敹钘忔椂缁欌€滃幓鎼滅储鈥濆叆鍙ｏ紙涓嶅彧鍒锋柊锛?- P1锛堝缓璁級
  - 鏀寔鍒嗛〉涓庢壒閲忔搷浣滐紙濡傞渶瑕侊級

#### Orders锛坄pages/orders/index`锛?
- 妯℃澘锛欱锛圠ist锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 淇 RISK-P0-01锛氬鏍告湭閫氳繃鏃朵笉鑳藉崱 Loading
  - 璁㈠崟鐘舵€侊紙status锛夊繀椤绘湁鐢ㄦ埛鍙鏄犲皠锛堜笉鐩存帴灞曠ず鏋氫妇鍊硷級
  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱
- P1锛堝缓璁級
  - 绛涢€変笌鍒嗛〉锛氭寜鐘舵€佺瓫閫夈€佸垎椤靛姞杞姐€佷笅鎷夊埛鏂?
#### Order Detail锛坄pages/orders/detail/index`锛?
- 妯℃澘锛欳锛圖etail + 鎿嶄綔锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 淇 RISK-P0-01锛氬鏍告湭閫氳繃鏃朵笉鑳藉崱 Loading
  - 閫€娆?Popup锛氬師鍥犻€夋嫨/杈撳叆妗?纭鎸夐挳瑙勮寖鍖栵紙鏂囨妯℃澘 + 鍗遍櫓鎿嶄綔鎻愮ず锛?  - 鍙戠エ/閫€娆?璺熷崟澶氫釜瀛愯姹傦細閿欒鎬侀渶缁熶竴锛堜笉鑳介潤榛樺け璐ュ鑷寸敤鎴疯鍒わ級
- P1锛堝缓璁級
  - 鏃堕棿/閲戦/姝ラ鑺傜偣灞曠ず缁熶竴锛堜笌鏀粯鎴愬姛椤?Steps 鍙ｅ緞瀵归綈锛?
#### My Listings锛坄pages/my-listings/index`锛?
- 妯℃澘锛欱锛圠ist锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 淇 RISK-P0-01锛氬鏍告湭閫氳繃鏃朵笉鑳藉崱 Loading
  - 鐘舵€佹爣绛撅紙涓婃灦/涓嬫灦/鎴愪氦 + 瀹℃牳鐘舵€侊級棰滆壊璇箟缁熶竴锛坰uccess/warn/danger锛?  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱
- P1锛堝缓璁級
  - 鏀寔鈥滅紪杈戣崏绋?澶嶅埗鍙戝竷/涓嬫灦鍘熷洜鎻愮ず鈥濈瓑锛堜骇鍝佺‘璁ゅ悗锛?
### 1.4 鍙戝竷涓庤〃鍗?
#### Publish Patent锛坄pages/publish/patent/index`锛?
- 妯℃澘锛欴锛團orm + Sticky锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 椤甸潰绾ф潈闄愶細鍗充娇浠庢繁閾捐繘鍏ワ紝涔熷繀椤诲厛鏄剧ず Permission/Audit 鐘舵€侊紙鑰屼笉鏄彧鍦ㄦ彁浜ゆ椂澶辫触锛?  - 鏂囨鍘?P0/婕旂ず锛涜〃鍗曡鏄庢敼涓虹敤鎴峰彲璇荤殑鈥滀负浠€涔堣濉?鎬庝箞濉€?  - 涓婁紶鍒楄〃锛氭枃浠堕」灞曠ず銆佸垹闄ょ‘璁ゃ€佸け璐ラ噸璇曠粺涓€瑙勮寖锛堝苟涓斾笉鏆撮湶鍐呴儴 id锛?- P1锛堝缓璁級
  - 闀胯〃鍗曢槻涓細鑷姩淇濆瓨鑽夌 + 绂诲紑鎻愮ず锛堜骇鍝佺‘璁ゅ悗锛?
#### Publish Demand锛坄pages/publish/demand/index`锛?
- 妯℃澘锛欴锛團orm 绠€鐗堬紝鍗犱綅锛?- 椤甸潰绛栫暐锛歛pproved-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 椤甸潰绾ф潈闄愶細鏈€氳繃瀹℃牳鏃朵笉瑕佽鐢ㄦ埛濉啓鍒颁竴鍗婃墠澶辫触
  - 琛ラ綈鐘舵€佹満锛歭oading/empty/error/permission/audit锛堝摢鎬曞綋鍓嶆棤鍚庣鎺ュ彛锛屼篃瑕佹湁鍗犱綅瑙勫垯锛?- P1锛堝缓璁級
  - 瀛楁/鏍￠獙/鎻愪氦缁撴灉椤碉細涓?OpenAPI/PRD 瀵归綈鍚庤ˉ鍏?
#### Publish Achievement锛坄pages/publish/achievement/index`锛?
- 鍚?Publish Demand锛堝悓绾у崰浣嶉〉锛?
#### Profile Edit锛坄pages/profile/edit/index`锛?
- 妯℃澘锛欴锛團orm锛?- 椤甸潰绛栫暐锛歭ogin-required锛堥〉闈㈢骇锛?- P0锛堝繀椤伙級
  - 椤甸潰绾ф潈闄愶細鏈櫥褰曟椂鐢?PermissionCard锛堣€屼笉鏄粎 navigateTo 璺宠蛋锛変互淇濊瘉涓€鑷存€?  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱
  - 鍦板尯閫夋嫨鍣ㄥ洖濉細浜や簰涓?RegionPicker 妯℃澘涓€鑷?- P1锛堝缓璁級
  - 杈撳叆鏍￠獙锛堟樀绉伴暱搴︺€佸湴鍖虹爜鏍煎紡锛変笌閿欒灞曠ず缁熶竴锛堜紭鍏?inline锛?
#### Region Picker锛坄pages/region-picker/index`锛?
- 妯℃澘锛欴锛圲tility Picker锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - PageHeader 鍓爣棰樺幓 P0 瀛楁牱
  - SearchEntry 鈥渁ctionText=娓呯┖鈥?鐨勮涔変笌浜や簰缁熶竴锛堥伩鍏嶈瑙ｄ负鈥滄悳绱⑩€濓級
- P1锛堝缓璁級
  - 鏀寔灞傜骇閫夋嫨锛堢渷鈫掑競鈫掑尯锛変笌杩斿洖鍊肩粨鏋勶紙浜у搧纭锛?
### 1.5 鐧诲綍涓庡紩瀵?
#### Login锛坄pages/login/index`锛?
- 妯℃澘锛欴锛圓uth锛?- 椤甸潰绛栫暐锛歱ublic
- P0锛堝繀椤伙級
  - 鍘婚櫎鐢ㄦ埛鍙鐨?P0/Mock/婕旂ず鏂囨锛涗繚鐣?dev-only 璇存槑
  - 鐧诲綍鏂瑰紡鏂囨缁熶竴锛堝皬绋嬪簭 vs H5锛変笖涓嶆毚闇插疄鐜扮粏鑺傦紙code鈫抰oken 绛夛級
  - 鎴愬姛鍚庤烦杞瓥鐣ユ爣鍑嗗寲锛氫紭鍏堝洖鍒版潵婧愰〉锛屽惁鍒欏幓 Home锛涜嫢鏈畬鎴愯韩浠介€夋嫨鍒欒繘鍏?Onboarding
- P1锛堝缓璁級
  - 鐭俊鐧诲綍 UX锛氭墜鏈哄彿鏍煎紡鏍￠獙銆佸€掕鏃舵寜閽姸鎬併€侀敊璇彁绀烘洿绮剧‘

#### Choose Identity锛坄pages/onboarding/choose-identity/index`锛?
- 妯℃澘锛欴锛圵izard锛?- 椤甸潰绛栫暐锛歭ogin-required
- P0锛堝繀椤伙級
  - 娓愬彉纭紪鐮佹敼涓?token锛沬con 鐧借壊纭紪鐮佹敼涓?token
  - 韬唤鍗＄墖淇℃伅瀵嗗害涓?Tag 瑙勫垯缁熶竴锛堢閫氳繃/闇€瀹℃牳锛?  - 甯冨眬鏀逛负 2 鍒楁爡鏍煎崱鐗囷細鍦嗗舰鍥炬爣 + 鏍囬 + 鐘舵€佹爣绛?+ 璇存槑锛屽崱鐗囧眳涓榻愩€佺暀鐧戒竴鑷?  - 涓汉韬唤鈥滅閫氳繃鈥濇祦绋嬶細鎴愬姛/澶辫触鍙嶉鏂囨鍘绘紨绀哄懗
- P1锛堝缓璁級
  - 澧炲姞鈥滀负浠€涔堥渶瑕佽璇佲€濈殑瑙ｉ噴鎶樺彔鍖猴紙鍑忓皯璺冲嚭锛?
#### Verification Form锛坄pages/onboarding/verification-form/index`锛?
- 妯℃澘锛欴锛圵izard Form锛?- 椤甸潰绛栫暐锛歭ogin-required
- P0锛堝繀椤伙級
  - 涓婁紶璇佹嵁锛氬垹闄ら渶浜屾纭锛涙枃浠堕」灞曠ず涓嶅彲鏆撮湶鍐呴儴 id锛堣嚦灏戞樉绀衡€滄潗鏂?1/2/3鈥濓級
  - 琛ㄥ崟鏍￠獙浠?toast 閫愭鍗囩骇涓?inline锛堝叧閿瓧娈碉級
  - 鎻愪氦鎴愬姛鍚庣粺涓€钀藉湴鍒扳€滃鏍镐腑鈥濈姸鎬侀〉锛堟垨鍥?Me/Publish 骞舵彁绀猴級
- P1锛堝缓璁級
  - OCR/鑷姩濉厖锛堝鏋滆鍋氾級锛屼笌 API 瀵归綈鍚庤鍒?
### 1.6 鏀粯閾捐矾

#### Deposit Pay锛坄pages/checkout/deposit-pay/index`锛?
- 妯℃澘锛欵锛圥ayment锛?- 椤甸潰绛栫暐锛歱ublic锛堝彲娴忚锛? 鏀粯鍔ㄤ綔 approved-required
- P0锛堝繀椤伙級
  - 鏀粯璇存槑鏂囨鏍囧噯鍖栵紙閬垮厤杩囬暱/涓嶅彲鎵锛?  - StickyBar 涓绘鎸夐挳瑙勫垯缁熶竴锛堣繑鍥?ghost銆佹敮浠?primary锛?- P1锛堝缓璁級
  - H5/妗岄潰鏀粯鏂规锛堜簩缁寸爜/璺宠浆灏忕▼搴忥級浜у搧涓?UI 鏄庣‘鍖?
#### Final Pay锛坄pages/checkout/final-pay/index`锛?
- 鍚?Deposit Pay锛堝苟琛ラ綈 PageHeader/璇存槑妯℃澘涓€鑷存€э級

#### Deposit Success / Final Success锛坄pages/checkout/*-success/index`锛?
- 妯℃澘锛欵锛圥ayment Result锛?- 椤甸潰绛栫暐锛歭ogin-required锛堝缓璁ˉ榻?audit 鍒嗘敮锛?- P0锛堝繀椤伙級
  - 鎴愬姛椤垫ā鏉跨粺涓€锛氫俊鎭憳瑕併€佷笅涓€姝?Steps銆佷富 CTA锛堣繘鍏ユ秷鎭?璁㈠崟锛?  - PermissionCard 涔嬪琛ラ綈 AuditPending锛堥伩鍏嶁€滃凡鐧诲綍浣嗘湭瀹℃牳鈥濈殑灏村艾鐘舵€侊級
  - 鈥滆鍗曟憳瑕佲€濈敤 NutUI `Tag`/`Space` 鏀跺彛锛堥伩鍏?MetaPills 涓庝笟鍔?Tag 娣锋帓锛?- P1锛堝缓璁級
  - 璁㈠崟璇︽儏璺宠浆鍏ュ彛锛堝鏋滀骇鍝侀渶瑕侊級

### 1.7 鑱婂ぉ

#### Chat锛坄pages/messages/chat/index`锛?
- Template: F (Chat)
- Page policy: approved-required (page-level)
- P0 (must)
  - createdAt uses formatTimeSmart (no raw ISO strings)
  - ScrollView message list + auto scroll to latest; keep input fixed with safe-area padding
  - Render message types: TEXT/IMAGE/FILE/SYSTEM (image preview, file copy link)
  - Cursor pagination for history (pull-to-refresh / load more) without jumping scroll position
  - Sending state: optimistic bubble -> replace with server message; failure keeps bubble with retry
- P1 (suggest)
  - Unread divider / day grouping
  - Attachment upload (image/file)
  - Read receipt (if backend supports)

## 2. Admin锛坅pps/admin-web锛夐€愰〉浠诲姟鎷嗚В锛堣鍒掔骇锛?
> 鍚庡彴椤甸潰鏅亶涓?Table/Form/CMS锛寁2 鐨勯噸鐐规槸锛?*鍗遍櫓鎿嶄綔纭銆侀敊璇彁绀虹粺涓€銆佹枃妗堝幓婕旂ず銆佸璁＄暀鐥曞叆鍙ｆ竻鏅?*銆?
#### AppLayout锛坄apps/admin-web/src/ui/AppLayout.tsx`锛?
- P0锛氬乏渚?Logo 鍖虹殑棰滆壊纭紪鐮侊紙#fff 绛夛級绾冲叆 token 鎴栫櫧鍚嶅崟
- P0锛歁ock 鍦烘櫙鍒囨崲蹇呴』 dev-only锛屽苟閬垮厤褰卞搷姝ｅ紡婕旂ず瑙傛劅

#### Dashboard锛坄apps/admin-web/src/views/DashboardPage.tsx`锛?
- P0锛氬幓鈥滄紨绀?Mock fixtures鈥濇枃妗堬紱閿欒姹囨€绘彁绀烘爣鍑嗗寲锛堝彲閲嶈瘯銆佸彲瀹氫綅锛?
#### Verifications / Listings / Orders / Refunds / Settlements

- P0锛氭墍鏈夆€滈€氳繃/椹冲洖/纭閲岀▼纰?閫€娆锯€濈瓑涓嶅彲閫嗘搷浣滅粺涓€浜屾纭锛堝師鍥犺緭鍏?+ 瀹¤鎻愮ず锛?- P0锛氶敊璇彁绀虹粺涓€缁勪欢锛圧equestErrorAlert 瑙勮寖鍖栵細鐢ㄦ埛鍙 + debug 鍙睍寮€锛?- P1锛氱瓫閫夊尯/琛ㄦ牸瀵嗗害/瀵煎嚭鑳藉姏缁熶竴锛堟彁鍗囪繍钀ユ晥鐜囷級

#### Config锛坄apps/admin-web/src/views/ConfigPage.tsx`锛?
- P0锛氶厤缃彉鏇村繀椤讳簩娆＄‘璁?+ 鍙樻洿鎽樿锛堝姣?old/new锛? 瀹¤鐣欑棔鍏ュ彛
- P0锛氬幓 P0 鏂囨锛堜粎 dev-only锛?
