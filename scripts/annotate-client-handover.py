#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Enhance client handover doc for client-facing readability:
- Remove internal Section 8.
- Add per-row Chinese explanation columns for page/route/API tables.
- Fill schema field description column.
- Add DB field description column.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def parse_cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def format_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def split_words(name: str) -> list[str]:
    s = name.replace("[]", "").replace("-", "_").replace(".", "_")
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return [p for p in s.split("_") if p]


WORD_MAP = {
    "home": "首页",
    "tech": "技术",
    "manager": "经理",
    "managers": "经理",
    "publish": "发布",
    "messages": "消息",
    "message": "消息",
    "me": "我的",
    "search": "搜索",
    "patent": "专利",
    "orders": "订单",
    "order": "订单",
    "checkout": "支付",
    "deposit": "订金",
    "final": "尾款",
    "success": "成功",
    "achievement": "成果",
    "achievements": "成果",
    "chat": "会话",
    "support": "客服",
    "faq": "常见问题",
    "contact": "联系",
    "legal": "法律",
    "privacy": "隐私",
    "terms": "条款",
    "guide": "指引",
    "onboarding": "新手引导",
    "choose": "选择",
    "identity": "身份",
    "verification": "认证",
    "form": "表单",
    "notifications": "通知",
    "notification": "通知",
    "announcements": "公告",
    "announcement": "公告",
    "listing": "挂牌",
    "listings": "挂牌",
    "favorites": "收藏",
    "organizations": "机构",
    "inventors": "发明人",
    "map": "地图",
    "trade": "交易",
    "rules": "规则",
    "contracts": "合同",
    "invoices": "发票",
    "addresses": "地址",
    "address": "地址",
    "edit": "编辑",
    "my": "我的",
    "claims": "认领",
    "claim": "认领",
    "maintenance": "维保",
    "settings": "设置",
    "about": "关于",
    "profile": "资料",
    "login": "登录",
    "ipc": "IPC",
    "picker": "选择器",
    "media": "媒体",
    "video": "视频",
    "preview": "预览",
    "cooperation": "合作",
    "modes": "方式",
    "mode": "方式",
    "line": "行",
    "json": "JSON",
    "at": "时间",
    "in": "内",
    "seconds": "秒",
    "second": "秒",
    "expires": "过期",
    "reply": "回复",
    "counterpart": "对方",
    "applicant": "申请人",
    "assignee": "受让方",
    "confidence": "置信度",
    "scope": "范围",
    "featured": "推荐",
    "rank": "排序位",
    "jurisdiction": "法域",
    "provider": "渠道",
    "ok": "成功",
    "key": "键",
    "job": "任务",
    "defaults": "默认配置",
    "defaults2": "默认配置",
    "window": "窗口",
    "minutes": "分钟",
    "minute": "分钟",
    "fen": "分",
    "evidence": "凭证",
    "masked": "脱敏",
    "note": "备注",
    "notes": "备注",
    "sla": "SLA",
    "can": "可",
    "auto": "自动",
    "payout": "放款",
    "timeout": "超时",
    "commission": "佣金",
    "deal": "成交",
    "plain": "文本",
    "features": "特征",
    "strategy": "策略",
    "hot": "热门",
    "sensitive": "敏感",
    "taxonomy": "分类",
    "rule": "规则",
    "rules2": "规则",
    "trade2": "交易",
    "template": "模板",
    "templates": "模板",
    "item": "项",
    "items": "条目",
    "offline": "下线",
    "publish2": "发布",
    "audio": "音频",
    "parse2": "解析",
    "agent": "坐席",
    "conversation": "会话",
    "display": "显示",
    "until": "截止",
    "level": "等级",
    "claim2": "认领",
    "event": "事件",
    "events": "事件",
    "summary2": "汇总",
    "stats": "统计",
    "recommendation": "推荐",
    "sensitivewords": "敏感词",
    "no": "编号",
    "admin": "后台",
    "verifications": "认证审核",
    "refunds": "退款",
    "settlements": "结算",
    "reports": "报表",
    "comments": "评论",
    "alerts": "告警",
    "audit": "审计",
    "logs": "日志",
    "rbac": "权限",
    "config": "配置",
    "regions": "地区",
    "operations": "业务操作",
    "conversations": "会话",
    "platform": "平台",
    "auth": "认证",
    "session": "会话",
    "user": "用户",
    "users": "用户",
    "role": "角色",
    "roles": "角色",
    "permission": "权限",
    "permissions": "权限",
    "id": "ID",
    "uuid": "唯一ID",
    "status": "状态",
    "type": "类型",
    "name": "名称",
    "title": "标题",
    "summary": "摘要",
    "description": "描述",
    "content": "内容",
    "phone": "手机号",
    "email": "邮箱",
    "avatar": "头像",
    "url": "地址",
    "code": "编码",
    "region": "地区",
    "province": "省",
    "city": "市",
    "district": "区",
    "amount": "金额",
    "price": "价格",
    "fee": "费用",
    "rate": "费率",
    "tax": "税额",
    "total": "总额",
    "count": "数量",
    "page": "页码",
    "size": "每页条数",
    "created": "创建",
    "updated": "更新",
    "deleted": "删除",
    "time": "时间",
    "date": "日期",
    "start": "开始",
    "end": "结束",
    "is": "是否",
    "has": "是否",
    "enabled": "启用",
    "disabled": "停用",
    "active": "有效",
    "default": "默认",
    "cover": "封面",
    "file": "文件",
    "files": "文件",
    "source": "来源",
    "target": "目标",
    "result": "结果",
    "results": "结果",
    "reason": "原因",
    "remark": "备注",
    "note": "说明",
    "operator": "操作人",
    "owner": "所有者",
    "buyer": "买家",
    "seller": "卖家",
    "cs": "客服",
    "finance": "财务",
    "invoice": "发票",
    "contract": "合同",
    "payment": "支付",
    "refund": "退款",
    "settlement": "结算",
    "parse": "解析",
    "ai": "AI",
    "hot": "热门",
    "banner": "横幅",
    "tag": "标签",
    "industry": "行业",
    "keyword": "关键词",
    "maturity": "成熟度",
    "sort": "排序",
    "wechat": "微信",
    "bind": "绑定",
    "unbind": "解绑",
    "approve": "审核通过",
    "reject": "审核驳回",
    "upload": "上传",
    "download": "下载",
    "send": "发送",
    "read": "已读",
    "unread": "未读",
    "detail": "详情",
    "list": "列表",
    "index": "首页",
}


ACTION_MAP = {
    "approve": "审核通过",
    "reject": "审核驳回",
    "publish": "发布",
    "off-shelf": "下架",
    "offshelf": "下架",
    "ack": "确认",
    "export": "导出",
    "upload": "上传",
    "download": "下载",
    "bind": "绑定",
    "unbind": "解绑",
    "login": "登录",
    "logout": "退出登录",
    "refresh": "刷新",
    "submit": "提交",
    "cancel": "取消",
    "close": "关闭",
    "open": "开启",
    "assign": "分配",
    "reply": "回复",
    "send": "发送",
    "read": "已读",
    "unread": "标记未读",
    "restore": "恢复",
    "delete": "删除",
    "remove": "移除",
}


PAGE_EXACT = {
    "pages/home/index": "首页",
    "pages/tech-managers/index": "技术经理页",
    "pages/publish/index": "发布页",
    "pages/messages/index": "消息页",
    "pages/me/index": "我的页",
    "subpackages/search/index": "搜索页",
    "subpackages/patent/detail/index": "专利详情",
    "subpackages/orders/index": "订单列表",
    "subpackages/orders/detail/index": "订单详情",
    "subpackages/checkout/deposit-pay/index": "订金支付",
    "subpackages/checkout/deposit-success/index": "订金支付成功",
    "subpackages/checkout/final-pay/index": "尾款支付",
    "subpackages/checkout/final-success/index": "尾款支付成功",
    "subpackages/publish/patent/index": "发布专利",
    "subpackages/publish/achievement/index": "发布成果",
    "subpackages/messages/chat/index": "聊天会话",
    "subpackages/support/index": "客服中心",
    "subpackages/support/faq/index": "常见问题",
    "subpackages/support/faq/detail/index": "问题详情",
    "subpackages/support/contact/index": "联系客服",
    "subpackages/legal/privacy/index": "隐私政策",
    "subpackages/legal/terms/index": "服务条款",
    "subpackages/legal/privacy-guide/index": "隐私指引",
    "subpackages/onboarding/choose-identity/index": "选择身份",
    "subpackages/onboarding/verification-form/index": "实名认证表单",
    "subpackages/notifications/index": "通知列表",
    "subpackages/notifications/detail/index": "通知详情",
    "subpackages/home-announcements/index": "首页公告列表",
    "subpackages/home-announcements/detail/index": "首页公告详情",
    "subpackages/listing/detail/index": "挂牌详情",
    "subpackages/achievement/detail/index": "成果详情",
    "subpackages/favorites/index": "我的收藏",
    "subpackages/organizations/index": "机构列表",
    "subpackages/organizations/detail/index": "机构详情",
    "subpackages/inventors/index": "发明人列表",
    "subpackages/patent-map/index": "专利地图",
    "subpackages/tech-managers/detail/index": "技术经理详情",
    "subpackages/trade-rules/index": "交易规则",
    "subpackages/contracts/index": "合同中心",
    "subpackages/invoices/index": "发票中心",
    "subpackages/addresses/index": "地址管理",
    "subpackages/addresses/edit/index": "地址编辑",
    "subpackages/my-listings/index": "我的挂牌",
    "subpackages/my-achievements/index": "我的成果",
    "subpackages/patent-claims/index": "专利认领",
    "subpackages/maintenance/index": "维保服务",
    "subpackages/settings/notifications/index": "通知设置",
    "subpackages/about/index": "关于我们",
    "subpackages/profile/edit/index": "资料编辑",
    "subpackages/login/index": "登录页",
    "subpackages/ipc-picker/index": "IPC 选择",
    "subpackages/media/video-preview/index": "视频预览",
}


ROUTE_EXACT = {
    "/login": "登录页",
    "/": "后台首页",
    "verifications": "实名认证审核管理",
    "listings": "挂牌审核管理",
    "tech-managers": "技术经理管理",
    "orders": "订单管理",
    "orders/:orderId": "订单详情",
    "cases": "客服工单管理",
    "refunds": "退款管理",
    "settlements": "结算管理",
    "invoices": "发票管理",
    "reports": "经营报表",
    "comments": "评论管理",
    "alerts": "告警中心",
    "audit-logs": "审计日志",
    "rbac": "权限角色管理",
    "config": "系统配置",
    "home-announcements": "首页公告管理",
    "maintenance": "专利维保管理",
    "regions": "地区字典管理",
    "patents": "专利库管理",
    "patents/operations": "专利业务操作",
    "patents/claims": "专利认领审核",
    "conversations/platform": "平台会话管理",
}


def translate_identifier(name: str) -> str:
    raw = name.strip("`")
    if not raw:
        return "-"

    clean = re.sub(r"[^A-Za-z0-9_-]", "", raw).lower()
    compact = clean.replace("-", "").replace("_", "")
    if compact in WORD_MAP:
        return WORD_MAP[compact]

    words = split_words(raw)
    out: list[str] = []
    for w in words:
        key = w.lower()
        if key in WORD_MAP:
            out.append(WORD_MAP[key])
        elif key in {"id", "ids"}:
            out.append("ID")
        elif key.isdigit():
            out.append(key)
        else:
            out.append(w.upper() if len(w) <= 3 else w)
    if not out:
        return raw
    return "".join(out).replace("是否是否", "是否")


def page_desc(full_path: str) -> str:
    p = full_path.strip("`").strip()
    if p in PAGE_EXACT:
        return PAGE_EXACT[p]
    tokens = [t for t in p.split("/") if t and t not in {"pages", "subpackages", "index"}]
    if not tokens:
        return "页面"
    zh = [translate_identifier(t) for t in tokens]
    if len(zh) >= 2 and zh[-1] in {"详情", "编辑"}:
        return zh[-2] + zh[-1]
    return "".join(zh)


def admin_route_desc(route_path: str) -> str:
    p = route_path.strip("`").strip()
    if p in ROUTE_EXACT:
        return ROUTE_EXACT[p]
    if p == "/" or p == "":
        return "后台首页"
    tokens = [t for t in p.strip("/").split("/") if t]
    if not tokens:
        return "后台页面"
    if tokens[-1].startswith(":"):
        base = translate_identifier(tokens[-2] if len(tokens) > 1 else tokens[0])
        return f"{base}详情"
    return "".join(translate_identifier(t) for t in tokens) + "管理"


def api_desc(side: str, method: str, path: str, operation_id: str) -> str:
    p = path.strip("`")
    tokens = [t for t in p.strip("/").split("/") if t]
    no_param = [t for t in tokens if not t.startswith("{")]

    client_side = "后台" if (side == "Admin" or (tokens and tokens[0] == "admin")) else "用户端"
    core = [t for t in no_param if t not in {"admin", "api", "v1"}]
    if core:
        if len(core) >= 2 and core[1] in {"claims", "operations", "platform", "announcements", "parse-results", "audit-logs"}:
            resource = translate_identifier(core[0]) + translate_identifier(core[1])
        else:
            resource = translate_identifier(core[0])
    else:
        resource = "系统"

    last = no_param[-1].lower() if no_param else ""
    has_param_tail = bool(tokens) and tokens[-1].startswith("{")

    if method == "GET":
        if has_param_tail:
            action = "查询详情"
        elif last in {"summary", "stats", "config", "session", "profile"}:
            action = "查询信息"
        else:
            action = "查询列表"
    elif method == "POST":
        if last in ACTION_MAP:
            action = ACTION_MAP[last]
        elif has_param_tail:
            action = "提交"
        else:
            action = "新增"
    elif method == "PATCH":
        action = ACTION_MAP.get(last, "更新")
    elif method == "PUT":
        action = "更新"
    elif method == "DELETE":
        action = "删除"
    else:
        action = "处理"

    opid = operation_id.lower()
    if "login" in opid:
        return f"{client_side}登录"
    if "logout" in opid:
        return f"{client_side}退出登录"
    if "session" in opid:
        return f"{client_side}会话查询"
    if "refresh" in opid:
        return f"{client_side}令牌刷新"

    return f"{client_side}{resource}{action}"


def field_desc(field_path: str) -> str:
    fp = field_path.strip("`").strip()
    if not fp:
        return "-"
    parts = [p for p in fp.split(".") if p]
    last = parts[-1]
    parent = parts[-2] if len(parts) > 1 else ""
    last_zh = translate_identifier(last)
    parent_zh = translate_identifier(parent) if parent else ""
    if parent_zh and parent_zh not in {"items", "data", "result", "list", "root", "rows"}:
        if last_zh in {"ID", "状态", "类型", "名称", "标题", "描述", "摘要", "金额", "时间", "日期"}:
            return parent_zh + last_zh
    return last_zh


def enhance_document(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []

    # remove section 8 and anything after it
    cut_idx = None
    for idx, line in enumerate(lines):
        if line.startswith("## 8."):
            cut_idx = idx
            break
    if cut_idx is not None:
        lines = lines[:cut_idx]

    section = 0
    i = 0
    while i < len(lines):
        line = lines[i]

        if "阅读建议" in line:
            i += 1
            continue

        if line.startswith("## "):
            m = re.match(r"^##\s+(\d+)\.", line)
            if m:
                section = int(m.group(1))
            out.append(line)
            i += 1
            continue

        # Section 3 table
        if section == 3 and line.startswith("|") and i + 1 < len(lines) and lines[i + 1].startswith("|---"):
            header = parse_cells(line)
            if len(header) == 4:
                out.append(format_row(["页面编号", "包名", "页面路径", "完整路径", "页面说明"]))
                out.append("|---|---|---|---|---|")
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 4 and row[0].startswith("MP-"):
                        out.append(format_row([row[0], row[1], row[2], row[3], page_desc(row[3])]))
                    i += 1
                continue

        # Section 4 table
        if section == 4 and line.startswith("|") and i + 1 < len(lines) and lines[i + 1].startswith("|---"):
            header = parse_cells(line)
            if len(header) == 3:
                out.append(format_row(["路由编号", "类型", "路由路径", "功能说明"]))
                out.append("|---|---|---|---|")
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 3 and row[0].startswith("ADM-"):
                        out.append(format_row([row[0], row[1], row[2], admin_route_desc(row[2])]))
                    i += 1
                continue

        # Section 5 table
        if section == 5 and line.startswith("|") and i + 1 < len(lines) and lines[i + 1].startswith("|---"):
            header = parse_cells(line)
            if len(header) == 7:
                out.append(format_row(["端别", "方法", "路径", "OperationId", "鉴权", "标签", "关联 Schema", "接口中文说明"]))
                out.append("|---|---|---|---|---|---|---|---|")
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 7 and row[0]:
                        desc = api_desc(row[0], row[1], row[2], row[3])
                        out.append(format_row([row[0], row[1], row[2], row[3], row[4], row[5], row[6], desc]))
                    i += 1
                continue

        # Section 6 table(s): fill description column
        if section == 6 and line.startswith("|") and i + 1 < len(lines) and lines[i + 1].startswith("|---"):
            header = parse_cells(line)
            if len(header) == 5 and "字段" in header[0]:
                out.append(format_row(["字段路径", "类型", "必填", "枚举", "说明"]))
                out.append("|---|---|---|---|---|")
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and row[0].startswith("`"):
                        out.append(format_row([row[0], row[1], row[2], row[3], field_desc(row[0])]))
                    i += 1
                continue

        # Section 7 table(s): add description column
        if section == 7 and line.startswith("|") and i + 1 < len(lines) and lines[i + 1].startswith("|---"):
            header = parse_cells(line)
            if len(header) == 5 and header[0] in {"字段", "Field"}:
                out.append(format_row(["字段", "类型", "必填", "枚举", "Prisma 属性", "字段说明"]))
                out.append("|---|---|---|---|---|---|")
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and row[0].startswith("`"):
                        out.append(format_row([row[0], row[1], row[2], row[3], row[4], field_desc(row[0])]))
                    i += 1
                continue

        out.append(line)
        i += 1

    return "\n".join(out).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="docs/architecture/client-handover-mini-program-admin.md",
        help="Input markdown path",
    )
    parser.add_argument(
        "--output",
        default="docs/architecture/client-handover-mini-program-admin.md",
        help="Output markdown path",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)
    text = in_path.read_text(encoding="utf-8-sig")
    enhanced = enhance_document(text)
    out_path.write_text(enhanced, encoding="utf-8-sig", newline="\n")
    print(out_path)


if __name__ == "__main__":
    main()
