INSERT INTO "rbac_roles" ("id", "name", "description", "permission_ids_json", "created_at", "updated_at")
VALUES (
  'role-cs',
  '客服',
  '已分配平台会话与自己负责订单的跟进处理',
  '[
    "conversation.platform.reply",
    "order.assigned.read",
    "order.assigned.contract.confirm",
    "order.assigned.followup.note",
    "payment.assigned.confirm.request",
    "order.assigned.transfer.submit"
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "permission_ids_json" = EXCLUDED."permission_ids_json",
  "updated_at" = NOW();
