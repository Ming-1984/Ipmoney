#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
统一修复甲方交接文档（小程序 + 管理后台）：
1) 插入目录
2) 补齐英文项的中文注释（页面域/标签/接口说明）
3) 统一第5/6章字段说明为中文可读表达
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


DOMAIN_MAP = {
    "public discovery/search": "公共浏览与检索",
    "public discovery/patent-map": "公共浏览与专利地图",
    "my-content create/update/submit": "我的内容创建、编辑与提交",
    "conversations + notifications": "会话消息与通知",
    "auth/me/verification": "登录态、个人中心与认证",
    "orders/payment/address/invoice": "订单、支付、地址与发票",
    "static/config (no critical API write)": "静态配置展示（无关键写接口）",
    "client/misc": "小程序通用能力",
    "favorites": "收藏能力",
    "admin/misc": "管理后台通用能力",
    "admin/verifications": "认证审核",
    "admin/listings-audit": "挂牌审核",
    "admin/tech-managers": "技术经理管理",
    "admin/orders": "订单管理",
    "admin/refunds": "退款管理",
    "admin/settlements": "结算管理",
    "admin/invoices": "发票管理",
    "admin/reports": "报表管理",
    "admin/comments": "评论管理",
    "admin/alerts": "告警管理",
    "admin/audit-logs": "审计日志",
    "admin/rbac": "权限管理",
    "admin/config": "系统配置",
    "admin/config-home-announcements": "首页公告配置",
    "admin/patent-maintenance": "专利维保管理",
    "admin/regions": "地区字典管理",
    "admin/patents": "专利与认领管理",
    "admin/dashboard": "后台首页看板",
}

PACKAGE_MAP = {
    "main": "主包",
}

ROUTE_TYPE_MAP = {
    "path": "路径路由",
    "index": "默认首页路由",
}

TAG_MAP = {
    "Listings": "挂牌",
    "Achievements": "成果",
    "Comments": "评论",
    "Messaging": "消息会话",
    "Maintenance": "专利维保",
    "Patents": "专利",
    "Config": "配置",
    "Search": "检索",
    "Organizations": "机构",
    "TechManagers": "技术经理",
    "Notifications": "通知",
    "Orders": "订单",
    "Payments": "支付",
    "Contracts": "合同",
    "Invoices": "发票",
    "Addresses": "地址",
    "Verification": "认证",
    "Auth": "认证",
    "Admin": "管理后台",
    "Regions": "地区",
    "Cases": "工单",
    "Alerts": "告警",
    "AI": "智能解析",
    "RBAC": "权限",
    "Users": "用户",
    "Dashboard": "看板",
    "Favorites": "收藏",
    "Reports": "报表",
    "Refunds": "退款",
    "Settlements": "结算",
    "Announcements": "公告",
}

PAGE_NAME_HINT = {
    "verifications": "认证审核",
    "cases": "工单",
    "refunds": "退款",
    "settlements": "结算",
    "reports": "报表",
    "comments": "评论",
    "alerts": "告警",
    "regions": "地区",
    "patents": "专利",
    "patentsoperations": "专利操作",
    "conversationsplatform": "平台会话",
    "trade规则": "交易规则",
    "媒体视频preview": "媒体视频预览",
    "审计logs": "审计日志",
}

TOKEN_MAP = {
    "home": "首页",
    "tech": "技术",
    "manager": "经理",
    "managers": "经理",
    "publish": "发布",
    "messages": "消息",
    "message": "消息",
    "me": "我的",
    "search": "检索",
    "patent": "专利",
    "patents": "专利",
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
    "consultation": "咨询",
    "faq": "常见问题",
    "contact": "联系",
    "legal": "法律",
    "privacy": "隐私",
    "terms": "条款",
    "guide": "指引",
    "onboarding": "引导",
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
    "favorite": "收藏",
    "organizations": "机构",
    "organization": "机构",
    "inventors": "发明人",
    "inventor": "发明人",
    "map": "地图",
    "trade": "交易",
    "rules": "规则",
    "contracts": "合同",
    "contract": "合同",
    "invoices": "发票",
    "invoice": "发票",
    "addresses": "地址",
    "address": "地址",
    "edit": "编辑",
    "claims": "认领",
    "claim": "认领",
    "maintenance": "维保",
    "settings": "设置",
    "about": "关于",
    "profile": "资料",
    "login": "登录",
    "my": "我的",
    "ipc": "IPC",
    "picker": "选择器",
    "media": "媒体",
    "video": "视频",
    "preview": "预览",
    "admin": "后台",
    "misc": "杂项",
    "dashboard": "看板",
    "auth": "认证",
    "session": "会话",
    "conversations": "会话",
    "conversation": "会话",
    "platform": "平台",
    "case": "工单",
    "cases": "工单",
    "refunds": "退款",
    "refund": "退款",
    "settlements": "结算",
    "settlement": "结算",
    "reports": "报表",
    "report": "报表",
    "comments": "评论",
    "comment": "评论",
    "alerts": "告警",
    "alert": "告警",
    "audit": "审计",
    "logs": "日志",
    "log": "日志",
    "rbac": "权限",
    "config": "配置",
    "regions": "地区",
    "region": "地区",
    "operations": "操作",
    "public": "公共",
    "discovery": "浏览",
    "static": "静态",
    "critical": "关键",
    "write": "写入",
    "api": "接口",
    "title": "标题",
    "summary": "摘要",
    "description": "描述",
    "content": "内容",
    "intro": "简介",
    "remark": "备注",
    "words": "词条",
    "word": "词条",
    "keyword": "关键词",
    "keywords": "关键词",
    "industry": "行业",
    "tags": "标签",
    "tag": "标签",
    "source": "来源",
    "maturity": "成熟度",
    "sort": "排序",
    "name": "名称",
    "nickname": "昵称",
    "actor": "操作人",
    "code": "编码",
    "id": "ID",
    "uuid": "唯一ID",
    "user": "用户",
    "users": "用户",
    "publisher": "发布者",
    "seller": "卖方",
    "buyer": "买方",
    "requester": "申请人",
    "author": "作者",
    "cover": "封面",
    "file": "文件",
    "files": "文件",
    "type": "类型",
    "status": "状态",
    "mode": "模式",
    "modes": "模式",
    "level": "级别",
    "total": "总",
    "active": "有效",
    "ranked": "排名",
    "unassigned": "未分配",
    "mappable": "可映射",
    "top": "最高",
    "plain": "纯文本",
    "json": "JSON",
    "is": "是否",
    "default": "默认",
    "at": "时间",
    "created": "创建",
    "updated": "更新",
    "display": "显示",
    "service": "服务",
    "view": "浏览",
    "consult": "咨询",
    "count": "数量",
    "price": "价格",
    "amount": "金额",
    "payment": "支付",
    "payout": "放款",
    "tax": "税额",
    "phone": "手机号",
    "email": "邮箱",
    "url": "链接",
    "role": "角色",
    "permission": "权限",
    "featured": "推荐",
    "parse": "解析",
    "ai": "智能",
    "hot": "热门",
    "sensitive": "敏感",
    "taxonomy": "分类",
    "recommendation": "推荐",
    "banner": "横幅",
    "template": "模板",
    "templates": "模板",
    "item": "条目",
    "items": "条目",
    "detail": "详情",
    "task": "任务",
    "tasks": "任务",
    "material": "材料",
    "materials": "材料",
    "normalize": "规范化",
    "list": "列表",
    "line": "行",
    "ok": "成功",
    "shelf": "上架",
    "off": "下架",
    "submit": "提交",
    "approve": "通过",
    "reject": "驳回",
    "assign": "分配",
    "reply": "回复",
    "send": "发送",
    "read": "已读",
    "unread": "未读",
    "offline": "下线",
    "publish2": "发布",
    "regioncode": "地区编码",
    "industrytags": "行业标签",
    "keywordsjson": "关键词JSON",
    "industrytagsjson": "行业标签JSON",
    "cooperationmodesjson": "合作模式JSON",
    "servicetagsjson": "服务标签JSON",
    "reasontagsjson": "原因标签JSON",
    "summaryplain": "纯文本摘要",
    "actornickname": "操作人昵称",
    "isdefault": "是否默认",
    "page": "页码",
    "size": "大小",
    "org": "机构",
    "category": "分类",
    "routing": "路由",
    "license": "许可",
    "assignee": "受让方",
    "applicant": "申请人",
    "schedule": "日程",
    "application": "申请",
    "fen": "分",
    "evidence": "凭证",
    "proof": "凭证",
    "duplicate": "重复",
    "policy": "策略",
    "operator": "操作人",
    "reason": "原因",
    "error": "错误",
    "severity": "严重级别",
    "deal": "成交",
    "failed": "失败",
    "mime": "媒体",
    "processed": "处理",
    "scope": "范围",
    "bytes": "字节",
    "skipped": "跳过",
    "transfer": "转让",
    "center": "中心",
    "lat": "纬度",
    "lng": "经度",
    "channels": "渠道",
    "channel": "渠道",
    "fail": "失败",
    "finished": "完成",
    "paused": "暂停",
    "started": "开始",
    "verified": "已核验",
    "encumbrance": "权利负担",
    "expected": "预计",
    "completion": "完成",
    "days": "天",
    "grant": "授权",
    "publication": "公开",
    "issued": "发放",
    "paid": "已支付",
    "review": "审核",
    "urgency": "紧急程度",
    "can": "可",
    "confidence": "置信度",
    "due": "到期",
    "event": "事件",
    "features": "特征",
    "grace": "宽限",
    "period": "期间",
    "kind": "类别",
    "notes": "备注",
    "priority": "优先级",
    "replies": "回复",
    "assigned": "已分配",
    "agent": "坐席",
    "close": "关闭",
    "filters": "筛选",
    "invalid": "无效",
    "model": "模型",
    "version": "版本",
    "parent": "父级",
    "pinned": "置顶",
    "reviewed": "已审核",
    "row": "行",
    "score": "分值",
    "submitted": "已提交",
    "supply": "供给",
    "target": "目标",
    "validated": "已校验",
    "valid": "有效",
    "year": "年",
    "max": "最大",
    "min": "最小",
    "abstract": "摘要",
    "attached": "附加",
    "executed": "执行",
    "from": "来源",
    "late": "延迟",
    "fee": "费用",
    "deliverables": "交付物",
    "loc": "位置",
    "text": "文本",
    "enabled": "启用",
    "job": "任务",
    "no": "编号",
    "stats": "统计",
    "result": "结果",
    "results": "结果",
    "applicationnonorm": "标准申请号",
    "publicationnodisplay": "公开号展示",
    "grantpublicationnodisplay": "授权公开号展示",
    "officialreceiptfileid": "官方回执文件ID",
    "topics": "主题",
    "date": "日期",
    "cs": "客服",
    "cooperation": "合作",
    "sms": "短信",
    "intent": "支付意图",
    "intents": "支付意图",
    "bind": "绑定",
    "customer": "客户",
    "mp": "小程序",
    "verify": "验证",
    "execute": "执行",
    "manual": "手动",
    "validate": "校验",
    "dispute": "纠纷",
    "sla": "服务时效",
    "notify": "通知回调",
    "wechatpay": "微信支付",
    "feedback": "反馈",
    "finance": "财务",
    "health": "健康",
    "temporary": "临时",
    "ack": "确认",
    "complete": "完成",
    "execution": "执行",
    "overview": "概览",
    "quote": "报价",
    "cancel": "取消",
    "position": "位置",
    "stamp": "戳",
    "str": "串",
    "for": "对应",
    "package": "参数包",
    "one": "候选",
    "of": "项",
    "link": "链接",
    "time": "时间",
    "requested": "请求",
    "masked": "脱敏",
    "ranking": "排名",
    "owned": "已拥有",
    "enc": "加密",
    "unified": "统一",
    "social": "社会",
    "credit": "信用",
    "note": "备注",
    "raw": "原始",
    "filing": "申请",
    "range": "范围",
    "percent": "百分比",
    "start": "开始",
    "uploaded": "上传",
    "signed": "签署",
    "in": "内",
    "before": "变更前",
    "after": "变更后",
    "request": "请求",
    "ip": "IP",
    "device": "设备",
    "by": "由",
    "import": "导入",
    "main": "主",
    "system": "系统",
    "key": "键",
    "to": "至",
    "commission": "佣金",
    "avatar": "头像",
    "rank": "排名",
    "logo": "标识",
    "existing": "既有",
    "negotiable": "可议价",
    "official": "官方",
    "receipt": "回执",
    "pledge": "质押",
    "rate": "费率",
    "until": "截止",
    "action": "操作",
    "owner": "所有者",
    "definition": "定义",
    "rating": "评分",
    "jurisdiction": "法域",
    "reconcile": "对账",
    "pay": "支付",
    "end": "结束",
    "method": "方式",
    "norm": "规范",
    "last": "最近",
    "reviewer": "审核人",
    "counterpart": "对方",
    "sender": "发送方",
    "deadline": "截止时间",
    "primary": "主要",
    "term": "期限",
    "txn": "交易",
    "input": "输入",
    "normalized": "规范化",
    "submission": "提交",
    "boost": "提升",
    "condition": "条件",
    "fixed": "固定",
    "number": "编号",
    "requests": "请求",
    "snapshot": "快照",
    "auto": "自动",
    "milestones": "里程碑",
    "payload": "载荷",
    "published": "已发布",
    "root": "根",
    "sent": "已发送",
    "spec": "规格",
    "weights": "权重",
    "as": "作为",
    "matches": "匹配",
    "ref": "参考",
    "cooldown": "冷却",
    "minutes": "分钟",
    "generated": "生成",
    "gross": "总额",
    "missing": "缺失",
    "claimed": "已认领",
    "province": "省",
    "city": "市",
    "q": "查询词",
    "threshold": "阈值",
    "triggered": "触发",
    "watermark": "水印",
    "batch": "批次",
    "completed": "完成",
    "business": "工作日",
    "mappings": "映射",
    "on": "当",
    "timeout": "超时",
    "scenario": "场景",
    "strategy": "策略",
    "upload": "上传",
    "webhook": "回调",
    "window": "窗口",
    "audio": "音频",
    "clear": "清除",
    "dedupe": "去重",
    "hours": "小时",
    "deleted": "已删除",
    "descendant": "子级",
    "expires": "过期",
    "seconds": "秒",
    "image": "图片",
    "industries": "行业",
    "occurred": "发生",
    "parsed": "解析",
    "query": "查询",
    "figure": "图",
    "decay": "衰减",
    "half": "半衰",
    "life": "周期",
    "value": "数值",
    "warnings": "警告",
    "assignments": "分配",
    "attachments": "附件",
    "feedbacks": "反馈",
    "participants": "参与者",
    "children": "子项",
    "classifications": "分类",
    "country": "国家",
    "export": "导出",
    "extra": "扩展",
    "context": "上下文",
    "idempotency": "幂等",
    "keys": "键",
    "identifiers": "标识",
    "match": "匹配",
    "milestone": "里程碑",
    "next": "下一条",
    "cursor": "游标",
    "nonce": "随机串",
    "parties": "参与方",
    "patch": "补丁",
    "applied": "已应用",
    "provider": "服务商",
    "recognized": "识别",
    "refresh": "刷新",
    "hash": "哈希",
    "response": "响应",
    "schema": "结构",
    "sign": "签名",
    "ttl": "存活期",
    "wechat": "微信",
    "openid": "开放ID",
    "params": "参数",
    "token": "令牌",
    "access": "访问",
}

COMPOUND_MAP = {
    "off-shelf": "下架",
    "patent-maintenance": "专利维保",
    "tech-managers": "技术经理",
    "home-announcements": "首页公告",
    "audit-logs": "审计日志",
    "industry-tags": "行业标签",
    "hot-search": "热门搜索",
    "sensitive-words": "敏感词",
    "trade-rules": "交易规则",
    "parse-results": "解析结果",
    "patent-claims": "专利认领",
    "payment-confirm": "支付确认",
    "cover-file": "封面文件",
}

ACTION_MAP = {
    "approve": "审核通过",
    "reject": "审核驳回",
    "publish": "发布",
    "off-shelf": "下架",
    "offshelf": "下架",
    "offline": "下线",
    "submit": "提交",
    "ack": "确认",
    "export": "导出",
    "upload": "上传",
    "download": "下载",
    "bind": "绑定",
    "unbind": "解绑",
    "login": "登录",
    "logout": "退出登录",
    "refresh": "刷新",
    "cancel": "取消",
    "close": "关闭",
    "open": "开启",
    "assign": "分配",
    "reply": "回复",
    "send": "发送",
    "read": "已读",
    "unread": "标记未读",
    "remove": "移除",
    "delete": "删除",
    "status": "更新状态",
    "sla": "更新SLA",
    "notes": "新增备注",
    "evidence": "上传凭证",
    "agents": "分配坐席",
    "quote": "报价",
    "receipt": "上传回执",
    "reconcile": "对账",
    "payment-confirm": "确认支付",
}


def has_chinese(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text))


def parse_cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def format_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def sep_row(columns: int) -> str:
    return "|" + "|".join(["---"] * columns) + "|"


def strip_trailing_annotation(value: str) -> str:
    if not value:
        return ""
    out_chars: list[str] = []
    depth = 0
    for ch in value:
        if ch == "（":
            depth += 1
            continue
        if ch == "）":
            if depth > 0:
                depth -= 1
                continue
        if depth == 0:
            out_chars.append(ch)
    cleaned = "".join(out_chars)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def split_identifier(token: str) -> list[str]:
    token = token.replace("-", "_")
    token = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", token)
    parts: list[str] = []
    for part in token.split("_"):
        if not part:
            continue
        matches = re.findall(r"[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+", part)
        parts.extend(matches or [part])
    return parts


def token_to_cn(token: str) -> str:
    raw = token.strip()
    if not raw:
        return ""
    low = raw.lower()
    if low in TOKEN_MAP:
        return TOKEN_MAP[low]
    if low.endswith("s") and low[:-1] in TOKEN_MAP:
        return TOKEN_MAP[low[:-1]]
    if low == "id":
        return "ID"
    if re.fullmatch(r"\d+", raw):
        return raw
    if raw.upper() in {"API", "UUID", "JSON", "URL", "IPC", "RBAC", "SLA", "PDF", "AI", "AT"}:
        return raw.upper()
    if len(raw) <= 3 and raw.isupper():
        return raw
    return raw


def phrase_to_cn(text: str) -> str:
    source = text.strip().strip("`")
    if not source or source == "-":
        return source

    lower_source = source.lower()
    if lower_source in PAGE_NAME_HINT:
        return PAGE_NAME_HINT[lower_source]
    if lower_source in COMPOUND_MAP:
        return COMPOUND_MAP[lower_source]

    normalized = source.replace("+", " + ")

    # 先替换复合词，避免逐词拆分后出现“下架上架”之类重复表达
    for src, dst in COMPOUND_MAP.items():
        normalized = re.sub(re.escape(src), dst, normalized, flags=re.IGNORECASE)

    def repl(match: re.Match[str]) -> str:
        word = match.group(0)
        lower = word.lower()
        if lower in PAGE_NAME_HINT:
            return PAGE_NAME_HINT[lower]
        if lower in COMPOUND_MAP:
            return COMPOUND_MAP[lower]
        pieces = split_identifier(word)
        converted = "".join(token_to_cn(p) for p in pieces)
        return converted if converted else word

    converted = re.sub(r"[A-Za-z][A-Za-z0-9_-]*", repl, normalized)
    converted = re.sub(r"\s*/\s*", "、", converted)
    converted = re.sub(r"\s*\+\s*", "、", converted)
    converted = re.sub(r"\s+", "", converted)
    converted = converted.replace("（）", "")
    return converted


def append_cn_annotation(value: str, cn_text: str) -> str:
    base = strip_trailing_annotation(value)
    if not cn_text:
        return base
    if base == cn_text:
        return base
    return f"{base}（{cn_text}）"


def package_desc(package_value: str) -> str:
    base = strip_trailing_annotation(package_value)
    if base in PACKAGE_MAP:
        return PACKAGE_MAP[base]
    if base.startswith("subpackages/"):
        tail = base.split("/", 1)[1]
        return "分包：" + phrase_to_cn(tail)
    return phrase_to_cn(base)


def domain_desc(domain_value: str) -> str:
    base = strip_trailing_annotation(domain_value)
    return DOMAIN_MAP.get(base, phrase_to_cn(base))


def route_type_desc(route_type: str) -> str:
    base = strip_trailing_annotation(route_type)
    return ROUTE_TYPE_MAP.get(base, phrase_to_cn(base))


def side_desc(side: str) -> str:
    base = strip_trailing_annotation(side)
    if base == "Client":
        return "小程序端"
    if base == "Admin":
        return "管理后台"
    return phrase_to_cn(base)


def normalize_page_name(name: str, path_or_route: str = "") -> str:
    base = strip_trailing_annotation(name)
    if not re.search(r"[A-Za-z]", base):
        return base

    low = base.lower()
    hint = PAGE_NAME_HINT.get(low)
    if not hint and path_or_route:
        route_key = path_or_route.strip("`").strip().split("/")[-1].replace(":", "").lower()
        hint = PAGE_NAME_HINT.get(route_key)
    if not hint:
        hint = phrase_to_cn(base)
    if hint == base:
        return base
    return append_cn_annotation(base, hint)


def translate_tag_item(tag: str) -> str:
    base = strip_trailing_annotation(tag)
    if not base or base == "-":
        return base
    cn = TAG_MAP.get(base)
    if not cn:
        cn = phrase_to_cn(base)
    return append_cn_annotation(base, cn) if cn and cn != base else base


def translate_tags(tag_text: str) -> str:
    base = strip_trailing_annotation(tag_text)
    if not base or base == "-":
        return base
    items = [x.strip() for x in base.split(",") if x.strip()]
    translated = [translate_tag_item(item) for item in items]
    return ", ".join(translated) if translated else base


def api_desc(side: str, method: str, path: str, operation_id: str) -> str:
    m = method.strip().upper()
    p = path.strip("`").strip()
    raw_parts = [seg for seg in p.strip("/").split("/") if seg]
    is_admin = strip_trailing_annotation(side) == "Admin" or (raw_parts and raw_parts[0] == "admin")
    side_cn = "管理后台" if is_admin else "小程序端"

    parts = raw_parts[:]
    if parts and parts[0] == "admin":
        parts = parts[1:]
    if parts and parts[0] == "public":
        parts = parts[1:]

    no_param = [seg for seg in parts if not seg.startswith("{")]
    has_param_tail = bool(parts) and parts[-1].startswith("{")

    path_cn_parts: list[str] = []
    for seg in no_param:
        if seg in {"me", "search", "auth", "webhooks"}:
            continue
        seg_cn = phrase_to_cn(seg)
        if seg_cn:
            path_cn_parts.append(seg_cn)

    if not path_cn_parts and no_param:
        path_cn_parts = [phrase_to_cn(no_param[0])]

    path_cn = "/".join(path_cn_parts) if path_cn_parts else "系统"

    if m == "GET":
        action_cn = "查询详情" if has_param_tail else "查询列表"
    elif m == "POST":
        action_cn = "提交"
    elif m in {"PATCH", "PUT"}:
        action_cn = "更新"
    elif m == "DELETE":
        action_cn = "删除"
    else:
        action_cn = "处理"

    if action_cn == "提交" and path_cn.endswith("/提交"):
        path_cn = path_cn[: -len("/提交")]
    return f"{side_cn}{path_cn}{action_cn}"


def field_base_from_path(field_path: str) -> str:
    src = field_path.strip().strip("`")
    if not src or src == "-":
        return ""
    src = src.replace("[]", "")
    parts = [p for p in src.split(".") if p]
    target = parts[-1] if parts else src
    target = target.strip("{}")
    target = re.sub(r"[^A-Za-z0-9_-]", "", target)
    return target


def field_desc_from_path(field_path: str) -> str:
    base = field_base_from_path(field_path)
    if not base:
        return "-"
    one_of_match = re.fullmatch(r"oneOf(\d+)", base, flags=re.IGNORECASE)
    if one_of_match:
        return f"候选类型{one_of_match.group(1)}"
    desc = phrase_to_cn(base)
    desc = desc.replace("是否是否", "是否")
    desc = desc.replace("创建时间时间", "创建时间")
    desc = desc.replace("更新时间时间", "更新时间")
    desc = desc.replace("总总", "总")
    return desc if desc else "字段说明"


def normalize_desc(existing_desc: str, field_path: str) -> str:
    derived = field_desc_from_path(field_path)
    if derived and derived != "-":
        return derived

    base = existing_desc.strip().strip("`")
    if not base or base == "-":
        return "字段说明"
    return phrase_to_cn(base)


def build_toc_lines() -> list[str]:
    return [
        "## 目录",
        "",
        "1. 小程序页面清单",
        "2. 管理后台页面清单",
        "3. 页面-接口-字段对应关系",
        "4. 接口清单（全量）",
        "5. 接口字段字典（全量递归展开）",
        "6. 数据库字段字典（Prisma）",
        "",
    ]


def upsert_toc(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    i = 0
    while i < len(lines):
        if lines[i].strip() == "## 目录":
            i += 1
            while i < len(lines):
                if re.match(r"^##\s+\d+\.", lines[i]):
                    break
                i += 1
            continue
        cleaned.append(lines[i])
        i += 1

    insert_at = 0
    for idx, line in enumerate(cleaned):
        if re.match(r"^##\s+1\.", line):
            insert_at = idx
            break

    return cleaned[:insert_at] + build_toc_lines() + cleaned[insert_at:]


def enhance_markdown(text: str) -> str:
    lines = text.splitlines()
    lines = upsert_toc(lines)

    out: list[str] = []
    section = 0
    i = 0

    while i < len(lines):
        line = lines[i]

        if line.startswith("## "):
            m = re.match(r"^##\s+(\d+)\.", line)
            if m:
                section = int(m.group(1))
            out.append(line)
            i += 1
            continue

        if line.startswith("#### "):
            hm = re.match(r"^(####\s+[A-Z]+-\d+\s+`[^`]+`\s+)(.+)$", line)
            if hm:
                suffix = normalize_page_name(hm.group(2), "")
                out.append(hm.group(1) + suffix)
                i += 1
                continue

        # Section 1 table
        if (
            section == 1
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header == ["页面编号", "页面路径", "页面名称", "所属包", "业务域"]:
                out.append(format_row(header))
                out.append(sep_row(len(header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and row[0].startswith("MP-"):
                        row = row[:5]
                        row[2] = normalize_page_name(row[2], row[1])
                        row[3] = append_cn_annotation(row[3], package_desc(row[3]))
                        row[4] = append_cn_annotation(row[4], domain_desc(row[4]))
                        out.append(format_row(row))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

        # Section 2 table
        if (
            section == 2
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header == ["页面编号", "路由类型", "路由路径", "页面名称", "业务域"]:
                out.append(format_row(header))
                out.append(sep_row(len(header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and row[0].startswith("ADM-"):
                        row = row[:5]
                        row[1] = append_cn_annotation(row[1], route_type_desc(row[1]))
                        row[3] = normalize_page_name(row[3], row[2])
                        row[4] = append_cn_annotation(row[4], domain_desc(row[4]))
                        out.append(format_row(row))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

        # Section 3 summary table
        if (
            section == 3
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header == ["页面编号", "页面名称", "关联接口数", "关联 Schema 数", "关联字段总数"]:
                out.append(format_row(header))
                out.append(sep_row(len(header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and (row[0].startswith("MP-") or row[0].startswith("ADM-")):
                        row = row[:5]
                        row[1] = normalize_page_name(row[1], "")
                        out.append(format_row(row))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

            # Section 3.1 interface table
            if header == ["方法", "路径", "OperationId", "鉴权", "标签"] or header == [
                "方法",
                "路径",
                "OperationId",
                "鉴权",
                "标签",
                "接口说明",
            ]:
                new_header = ["方法", "路径", "OperationId", "鉴权", "标签", "接口说明"]
                out.append(format_row(new_header))
                out.append(sep_row(len(new_header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5:
                        method = row[0]
                        path = row[1]
                        opid = row[2]
                        auth = row[3]
                        tags = translate_tags(row[4])
                        if method.strip() == "-":
                            desc = "-"
                        else:
                            desc = api_desc("", method, path, opid)
                        out.append(format_row([method, path, opid, auth, tags, desc]))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

        # Section 4 table
        if (
            section == 4
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header[:7] == ["端别", "方法", "路径", "OperationId", "鉴权", "标签", "关联 Schema"]:
                new_header = ["端别", "方法", "路径", "OperationId", "鉴权", "标签", "关联 Schema", "接口说明"]
                out.append(format_row(new_header))
                out.append(sep_row(len(new_header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 7:
                        side = append_cn_annotation(row[0], side_desc(row[0]))
                        method = row[1]
                        path = row[2]
                        opid = row[3]
                        auth = row[4]
                        tags = translate_tags(row[5])
                        schemas = row[6]
                        desc = api_desc(row[0], method, path, opid)
                        out.append(format_row([side, method, path, opid, auth, tags, schemas, desc]))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

        # Section 5 table
        if (
            section == 5
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header == ["字段路径", "类型", "必填", "枚举", "说明"]:
                out.append(format_row(header))
                out.append(sep_row(len(header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 5 and row[0].startswith("`"):
                        row = row[:5]
                        row[4] = normalize_desc(row[4], row[0])
                        out.append(format_row(row))
                    else:
                        out.append(lines[i])
                    i += 1
                continue

        # Section 6 table
        if (
            section == 6
            and i + 1 < len(lines)
            and lines[i].startswith("|")
            and lines[i + 1].startswith("|---")
        ):
            header = parse_cells(lines[i])
            if header == ["字段", "类型", "必填", "枚举", "Prisma 属性", "字段说明"]:
                out.append(format_row(header))
                out.append(sep_row(len(header)))
                i += 2
                while i < len(lines) and lines[i].startswith("|"):
                    row = parse_cells(lines[i])
                    if len(row) >= 6 and row[0].startswith("`"):
                        row = row[:6]
                        row[5] = normalize_desc(row[5], row[0])
                        out.append(format_row(row))
                    else:
                        out.append(lines[i])
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
        help="输入 Markdown 文件",
    )
    parser.add_argument(
        "--output",
        default="docs/architecture/client-handover-mini-program-admin.md",
        help="输出 Markdown 文件",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    text = in_path.read_text(encoding="utf-8-sig")
    enhanced = enhance_markdown(text)
    out_path.write_text(enhanced, encoding="utf-8-sig", newline="\n")
    print(str(out_path))


if __name__ == "__main__":
    main()
