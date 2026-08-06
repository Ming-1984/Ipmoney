-- Grant the new comment-management capability to the built-in operator role
-- without replacing any permissions that administrators have already customized.
UPDATE "rbac_roles"
SET "permission_ids_json" = COALESCE("permission_ids_json", '[]'::jsonb) || '["comment.manage"]'::jsonb
WHERE "id" = 'role-operator'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE("permission_ids_json", '[]'::jsonb)) AS current("permission_id")
    WHERE current."permission_id" = 'comment.manage'
  );
