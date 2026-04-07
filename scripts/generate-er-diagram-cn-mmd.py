#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
根据 docs/architecture/er-diagram.mmd 生成中文展示版 Mermaid ER 文件。

默认输出：
- docs/architecture/er-diagram-cn.mmd
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class FieldDef:
    ftype: str
    name: str
    key_tags: list[str]


@dataclass
class EntityDef:
    name: str
    fields: list[FieldDef]


@dataclass
class RelationDef:
    left: str
    card: str
    right: str
    label: str


TABLE_CN = {
    "USERS": "用户表",
    "RBAC_ROLES": "权限角色表",
    "RBAC_USER_ROLES": "用户角色关联表",
    "USER_VERIFICATIONS": "用户认证表",
    "REGIONS": "地区字典表",
    "INDUSTRY_TAGS": "行业标签表",
    "PATENTS": "专利主表",
    "FILES": "文件资源表",
    "LISTINGS": "挂牌主表",
    "LISTING_MEDIA": "挂牌媒体表",
    "LISTING_AUDIT_LOGS": "挂牌审核日志表",
    "LISTING_FAVORITES": "挂牌收藏表",
    "LISTING_STATS": "挂牌统计表",
    "ORDERS": "订单主表",
    "PAYMENTS": "支付流水表",
    "REFUND_REQUESTS": "退款申请表",
    "CONTRACTS": "合同表",
    "SETTLEMENTS": "结算表",
    "CS_CASES": "客服工单表",
    "CS_MILESTONES": "工单里程碑表",
    "CS_CASE_NOTES": "工单备注表",
    "CS_CASE_EVIDENCES": "工单凭证表",
    "CONVERSATIONS": "会话表",
    "CONVERSATION_PARTICIPANTS": "会话参与人表",
    "CONVERSATION_MESSAGES": "会话消息表",
    "NOTIFICATIONS": "通知表",
    "SYSTEM_CONFIGS": "系统配置表",
    "IDEMPOTENCY_KEYS": "幂等键表",
    "AUDIT_LOGS": "审计日志表",
    "PATENT_MAINTENANCE_SCHEDULES": "专利维保日程表",
    "PATENT_MAINTENANCE_TASKS": "专利维保任务表",
    "PATENT_MAINTENANCE_ORDERS": "专利维保订单表",
}

REL_LABEL_CN = {
    "has": "拥有",
    "assigned_to": "分配给",
    "submits": "提交",
    "reviews": "审核",
    "belongs_to": "归属",
    "applies_in": "适用地区",
    "owns": "拥有",
    "referenced_by": "被引用",
    "publishes": "发布",
    "located_in": "所在地区",
    "attached_as": "挂载文件",
    "audited_by": "审核记录",
    "aggregates": "统计聚合",
    "favored": "被收藏",
    "favorites": "收藏",
    "traded_as": "形成交易",
    "buys": "购买",
    "assigned_cs": "分配客服",
    "invoice_file": "发票附件",
    "paid_by": "支付记录",
    "requests": "发起申请",
    "signs": "签署合同",
    "settles": "结算",
    "contract_file": "合同附件",
    "payout_evidence": "放款凭证",
    "follows": "跟进工单",
    "handles": "处理",
    "includes": "包含",
    "notes": "备注记录",
    "evidences": "凭证记录",
    "writes": "撰写",
    "uploads": "上传",
    "discusses": "关联会话",
    "contains": "包含",
    "joins": "参与",
    "sends": "发送",
    "receives": "接收",
    "uses": "使用",
    "acts": "操作",
    "maintains": "维保计划",
    "generates": "生成任务",
    "creates": "生成订单",
    "purchases": "下单购买",
}

TOKEN_CN = {
    "id": "ID",
    "user": "用户",
    "users": "用户",
    "role": "角色",
    "roles": "角色",
    "phone": "手机号",
    "nickname": "昵称",
    "region": "地区",
    "code": "编码",
    "created": "创建",
    "updated": "更新",
    "submitted": "提交",
    "reviewed": "审核",
    "by": "人",
    "display": "展示",
    "name": "名称",
    "type": "类型",
    "status": "状态",
    "description": "说明",
    "patent": "专利",
    "application": "申请",
    "no": "号",
    "norm": "标准化",
    "title": "标题",
    "legal": "法律",
    "source": "来源",
    "primary": "主来源",
    "at": "时间",
    "file": "文件",
    "url": "地址",
    "mime": "媒体类型",
    "size": "大小",
    "bytes": "字节",
    "owner": "归属人",
    "listing": "挂牌",
    "seller": "卖方",
    "trade": "交易",
    "mode": "模式",
    "price": "价格",
    "deposit": "订金",
    "amount": "金额",
    "audit": "审核",
    "media": "媒体",
    "sort": "排序",
    "action": "动作",
    "reason": "原因",
    "favorite": "收藏",
    "stats": "统计",
    "view": "浏览",
    "consult": "咨询",
    "comment": "评论",
    "order": "订单",
    "buyer": "买方",
    "assigned": "分配",
    "cs": "客服",
    "deal": "成交",
    "commission": "佣金",
    "invoice": "发票",
    "issued": "开具",
    "payment": "支付",
    "pay": "支付",
    "channel": "渠道",
    "transaction": "交易流水",
    "refund": "退款",
    "request": "申请",
    "text": "文本",
    "contract": "合同",
    "signed": "签署",
    "settlement": "结算",
    "gross": "毛额",
    "payout": "放款",
    "ref": "参考号",
    "evidence": "凭证",
    "case": "工单",
    "priority": "优先级",
    "due": "到期",
    "milestone": "里程碑",
    "note": "备注",
    "author": "作者",
    "conversation": "会话",
    "participant": "参与人",
    "participants": "参与人",
    "sender": "发送人",
    "content": "内容",
    "kind": "类别",
    "summary": "摘要",
    "read": "已读",
    "system": "系统",
    "config": "配置",
    "key": "键",
    "scope": "作用域",
    "value": "值",
    "json": "JSON",
    "idempotency": "幂等",
    "actor": "操作人",
    "target": "目标",
    "before": "变更前",
    "after": "变更后",
    "maintenance": "维保",
    "schedule": "日程",
    "task": "任务",
    "assignee": "执行人",
    "date": "日期",
    "level": "层级",
    "parent": "上级",
    "final": "尾款",
}

FIELD_EXACT_CN = {
    "application_no_norm": "申请号标准化",
    "source_primary": "主数据来源",
    "source_updated_at": "来源更新时间",
    "size_bytes": "文件大小字节",
    "seller_user_id": "卖方用户ID",
    "buyer_user_id": "买方用户ID",
    "assigned_cs_user_id": "分配客服用户ID",
    "price_amount": "挂牌价格分",
    "deposit_amount": "订金金额分",
    "deal_amount": "成交金额分",
    "final_amount": "尾款金额分",
    "commission_amount": "佣金金额分",
    "invoice_no": "发票号",
    "invoice_file_id": "发票文件ID",
    "invoice_issued_at": "发票开具时间",
    "pay_type": "支付类型",
    "paid_at": "支付完成时间",
    "reason_code": "退款原因编码",
    "reason_text": "退款原因说明",
    "contract_file_id": "合同文件ID",
    "gross_amount": "结算毛额分",
    "payout_amount": "放款金额分",
    "payout_status": "放款状态",
    "payout_ref": "放款参考号",
    "payout_evidence_file_id": "放款凭证文件ID",
    "payout_at": "放款时间",
    "due_at": "工单截止时间",
    "case_id": "工单ID",
    "author_user_id": "备注作者用户ID",
    "sender_user_id": "消息发送用户ID",
    "content_type": "内容类型",
    "read_at": "阅读时间",
    "value_json": "配置值JSON",
    "value_type": "配置值类型",
    "target_type": "目标对象类型",
    "target_id": "目标对象ID",
    "before_json": "变更前快照JSON",
    "after_json": "变更后快照JSON",
    "owner_user_id": "维保归属用户ID",
    "due_date": "维保到期日期",
    "schedule_id": "维保日程ID",
    "task_id": "维保任务ID",
    "payment_channel": "支付渠道",
    "joined_at": "加入时间",
    "reviewed_by": "审核人用户ID",
    "reviewed_at": "审核时间",
    "submitted_at": "提交时间",
    "mime_type": "媒体类型",
    "level": "层级",
    "parent_code": "上级地区编码",
    "reviewer_id": "审核人用户ID",
    "view_count": "浏览次数",
    "favorite_count": "收藏次数",
    "consult_count": "咨询次数",
    "comment_count": "评论次数",
}


def parse_er_mmd(text: str) -> tuple[str, list[EntityDef], list[RelationDef]]:
    lines = text.splitlines()
    init_line = ""
    for line in lines:
        if line.strip().startswith("%%{init:"):
            init_line = line
            break

    entities: list[EntityDef] = []
    relations: list[RelationDef] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        ent_match = re.match(r"^\s{2}([A-Z0-9_]+)\s*\{\s*$", line)
        if ent_match:
            name = ent_match.group(1)
            fields: list[FieldDef] = []
            i += 1
            while i < len(lines):
                l2 = lines[i].rstrip()
                if re.match(r"^\s{2}\}\s*$", l2):
                    break
                field_match = re.match(r"^\s{4}([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)(?:\s+([A-Z ]+))?\s*$", l2)
                if field_match:
                    ftype = field_match.group(1)
                    fname = field_match.group(2)
                    tags_raw = (field_match.group(3) or "").strip()
                    key_tags = [x for x in tags_raw.split() if x in {"PK", "FK"}]
                    fields.append(FieldDef(ftype=ftype, name=fname, key_tags=key_tags))
                i += 1
            entities.append(EntityDef(name=name, fields=fields))
        else:
            rel_match = re.match(
                r"^\s{2}([A-Z0-9_]+)\s+(\|\|--o\{|\|\|--\|\|)\s+([A-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*$",
                line,
            )
            if rel_match:
                relations.append(
                    RelationDef(
                        left=rel_match.group(1),
                        card=rel_match.group(2),
                        right=rel_match.group(3),
                        label=rel_match.group(4),
                    )
                )
        i += 1
    return init_line, entities, relations


def field_cn(name: str) -> str:
    if name in FIELD_EXACT_CN:
        return FIELD_EXACT_CN[name]
    out: list[str] = []
    for token in name.split("_"):
        key = token.lower()
        out.append(TOKEN_CN.get(key, token))
    return "".join(out) or name


def make_entity_alias(name: str) -> str:
    cn = TABLE_CN.get(name, name)
    alias = f"{name}_{cn}"
    alias = alias.replace("（", "_").replace("）", "_").replace(" ", "_")
    return alias


def render_cn_mmd(init_line: str, entities: list[EntityDef], relations: list[RelationDef]) -> str:
    alias: dict[str, str] = {e.name: make_entity_alias(e.name) for e in entities}

    out: list[str] = []
    if init_line:
        out.append(init_line)
    else:
        out.append(
            "%%{init: {'theme':'base','themeVariables': {'fontFamily': 'Microsoft YaHei, PingFang SC, Noto Sans CJK SC, Helvetica Neue, Arial, sans-serif'}}}%%"
        )
    out.append("erDiagram")

    for ent in entities:
        out.append(f"  {alias[ent.name]} {{")
        for f in ent.fields:
            cname = field_cn(f.name)
            fname = f"{f.name}_{cname}"
            key = f" {' '.join(f.key_tags)}" if f.key_tags else ""
            out.append(f"    {f.ftype} {fname}{key}")
        out.append("  }")
        out.append("")

    for rel in relations:
        left = alias.get(rel.left, rel.left)
        right = alias.get(rel.right, rel.right)
        label = REL_LABEL_CN.get(rel.label, rel.label)
        out.append(f"  {left} {rel.card} {right} : {label}")

    return "\n".join(out).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="docs/architecture/er-diagram.mmd", help="输入 ER mmd")
    parser.add_argument("--output", default="docs/architecture/er-diagram-cn.mmd", help="输出中文 mmd")
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    text = in_path.read_text(encoding="utf-8-sig")
    init_line, entities, relations = parse_er_mmd(text)
    rendered = render_cn_mmd(init_line, entities, relations)
    out_path.write_text(rendered, encoding="utf-8-sig", newline="\n")
    print(out_path)


if __name__ == "__main__":
    main()
