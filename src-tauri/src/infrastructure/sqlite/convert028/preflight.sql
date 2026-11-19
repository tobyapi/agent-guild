-- Return the first v0.1.28 row whose meaning would be lost on conversion.
-- Qualify JSON inputs: json_each also supplies columns named key and value.
SELECT 'guild_profile' AS kind, key AS id FROM meta WHERE key='guild_profile' AND CASE
  WHEN NOT json_valid(value) THEN 1
  ELSE json_type(value)<>'object' OR
    json_type(value,'$.name') IS NOT 'text' OR json_type(value,'$.crest') IS NOT 'object' OR
    json_type(value,'$.crest.shape') IS NOT 'text' OR json_type(value,'$.crest.color') IS NOT 'text'
END
UNION ALL
SELECT 'interrupted_jobs', key FROM meta WHERE key='interrupted_jobs' AND CASE
  WHEN NOT json_valid(value) THEN 1
  ELSE json_type(value)<>'array' OR EXISTS (
    SELECT 1 FROM json_each(meta.value) j WHERE CASE WHEN j.type<>'object' THEN 1 ELSE
      json_type(j.value,'$.depth') IS NOT 'integer' OR
      json_extract(j.value,'$.depth') NOT BETWEEN 0 AND 4294967295 OR
      json_type(j.value,'$.channelId') IS NOT 'text' OR json_type(j.value,'$.agentId') IS NOT 'text' OR
      json_type(j.value,'$.rootId') IS NOT 'text' END
  )
END
UNION ALL
SELECT 'agents', id FROM agents WHERE CASE
  WHEN NOT (json_valid(tags) AND json_valid(voice) AND json_valid(backend_options)) THEN 1
  ELSE json_type(tags)<>'array' OR EXISTS (SELECT 1 FROM json_each(agents.tags) WHERE type<>'text') OR
    json_type(backend_options)<>'object' OR json_type(voice)<>'object' OR
    EXISTS (SELECT 1 FROM json_each(agents.voice) WHERE key IN ('mode','intensity') AND type<>'text')
END
UNION ALL
SELECT 'channels', id FROM channels WHERE CASE WHEN NOT json_valid(workspace_json) THEN 1 ELSE
  json_type(workspace_json,'$.revision') IS NOT 'integer' OR json_extract(workspace_json,'$.revision')<0 OR
  json_type(workspace_json,'$.afterSeq') IS NOT 'integer'
END
UNION ALL
SELECT 'channels.is_lobby', id FROM channels WHERE is_lobby=1 AND
  EXISTS (SELECT 1 FROM channels other WHERE other.is_lobby=1 AND other.rowid<channels.rowid)
UNION ALL
SELECT 'channel_members', channel_id||'/'||member_id FROM channel_members
WHERE member_id<>'me' AND NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=channel_members.member_id)
UNION ALL
SELECT 'skills.source', id FROM skills WHERE source IS NOT NULL AND CASE WHEN NOT json_valid(source) THEN 1 ELSE
  json_type(source)<>'object' OR
  CASE json_extract(source,'$.kind')
    WHEN 'builtin' THEN json_type(source,'$.name') IS NOT 'text'
    WHEN 'linked' THEN json_type(source,'$.path') IS NOT 'text'
    ELSE 1 END
END
UNION ALL
SELECT 'messages', id FROM messages WHERE CASE
  WHEN NOT (json_valid(mentions) AND json_valid(attachments)) OR
    (skill_usage IS NOT NULL AND NOT json_valid(skill_usage)) THEN 1
  ELSE json_type(mentions)<>'array' OR EXISTS (
    SELECT 1 FROM json_each(messages.mentions) j WHERE j.type<>'text' OR
      (j.value NOT IN ('me','system') AND NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=j.value))
  ) OR json_type(attachments)<>'array' OR EXISTS (
    SELECT 1 FROM json_each(messages.attachments) j WHERE j.type<>'object'
  ) OR coalesce(json_type(skill_usage),'null') NOT IN ('null','object')
END
UNION ALL
SELECT 'messages.root_id', id FROM messages WHERE NOT EXISTS (
  SELECT 1 FROM messages root WHERE root.id=messages.root_id AND root.channel_id=messages.channel_id
)
UNION ALL
SELECT 'messages.reply_to_id', id FROM messages WHERE reply_to_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM messages parent WHERE parent.id=messages.reply_to_id AND parent.channel_id=messages.channel_id
)
UNION ALL
SELECT 'messages.delegation_id', id FROM messages
WHERE delegation_id IS NOT (SELECT d.id FROM delegations d WHERE d.message_id=messages.id)
UNION ALL
SELECT 'delegations.message_id', id FROM delegations WHERE NOT EXISTS (
  SELECT 1 FROM messages m WHERE m.id=delegations.message_id AND m.delegation_id=delegations.id
    AND m.channel_id=delegations.channel_id AND m.author_id=delegations.manager_id
)
UNION ALL
SELECT 'delegations.summary_message_id', id FROM delegations WHERE summary_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM messages m WHERE m.id=delegations.summary_message_id AND m.channel_id=delegations.channel_id
)
UNION ALL
SELECT 'subtasks.result_message_id', id FROM subtasks WHERE result_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM messages m JOIN delegations d ON d.channel_id=m.channel_id
  WHERE m.id=subtasks.result_message_id AND d.id=subtasks.delegation_id
)
UNION ALL
SELECT 'delegations.status', id FROM delegations WHERE status NOT IN ('running','reporting','done','cancelled')
UNION ALL
SELECT 'subtasks', id FROM subtasks WHERE position<0 OR status NOT IN ('pending','running','done','failed','cancelled')
  OR NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=subtasks.assignee_id)
  OR EXISTS (SELECT 1 FROM subtasks s WHERE s.delegation_id=subtasks.delegation_id AND s.position=subtasks.position AND s.rowid<subtasks.rowid)
UNION ALL
SELECT 'messages.author/kind/depth', id FROM messages WHERE depth<0 OR kind NOT IN ('chat','autonomous','progress','system','error')
  OR (author_id NOT IN ('me','system') AND NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=messages.author_id))
UNION ALL
SELECT 'agents.identity/behavior', id FROM agents WHERE id IS NULL OR id IN ('me','system')
  OR unmentioned NOT IN ('lead','answer','fallback','ignore') OR consultable NOT IN (0,1)
  OR can_delegate NOT IN (0,1) OR autonomy_enabled NOT IN (0,1) OR autonomy_interval_min<0
UNION ALL
SELECT 'channels.id', NULL FROM channels WHERE id IS NULL
UNION ALL
SELECT 'skills.id', NULL FROM skills WHERE id IS NULL
UNION ALL
SELECT 'delegations.id/manager', id FROM delegations WHERE id IS NULL OR NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=delegations.manager_id)
UNION ALL
SELECT 'subtasks.id', NULL FROM subtasks WHERE id IS NULL
UNION ALL
SELECT 'avatar_frames.id', NULL FROM avatar_frames WHERE id IS NULL
UNION ALL
SELECT 'run_measurements.job_id', NULL FROM run_measurements WHERE job_id IS NULL
UNION ALL
SELECT 'skill_record_cutoffs.job_id', NULL FROM skill_record_cutoffs WHERE job_id IS NULL
LIMIT 1;
