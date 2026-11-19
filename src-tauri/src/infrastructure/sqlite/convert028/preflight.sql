-- Return the first v0.1.28 row whose meaning would be lost on conversion.
-- Qualify JSON inputs: json_each also supplies columns named key and value.
SELECT 'meta' AS kind, coalesce(key,'NULL') AS id FROM meta
WHERE key IS NULL OR NOT (
  key IN ('schema_fingerprint','guild_profile','interrupted_jobs') OR
  (key='seeded' AND value='1') OR
  (substr(key,1,21)='desktop-notification:' AND length(key)>21 AND value='attempted')
)
UNION ALL
SELECT 'guild_profile', key FROM meta WHERE key='guild_profile' AND CASE
  WHEN NOT json_valid(value) THEN 1
  ELSE json_type(value)<>'object' OR (SELECT count(*) FROM json_each(meta.value))<>2 OR
    json_type(value,'$.name') IS NOT 'text' OR json_type(value,'$.crest') IS NOT 'object' OR
    (SELECT count(*) FROM json_each(meta.value,'$.crest'))<>2 OR
    json_type(value,'$.crest.shape') IS NOT 'text' OR json_type(value,'$.crest.color') IS NOT 'text'
END
UNION ALL
SELECT 'interrupted_jobs', key FROM meta WHERE key='interrupted_jobs' AND CASE
  WHEN NOT json_valid(value) THEN 1
  ELSE json_type(value)<>'array' OR EXISTS (
    SELECT 1 FROM json_each(meta.value) j WHERE CASE WHEN j.type<>'object' THEN 1 ELSE
      (SELECT count(*) FROM json_each(j.value))<>4 OR json_type(j.value,'$.depth') IS NOT 'integer' OR
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
    EXISTS (SELECT 1 FROM json_each(agents.voice) WHERE key NOT IN ('mode','intensity') OR type<>'text')
END
UNION ALL
SELECT 'channels', id FROM channels WHERE CASE WHEN NOT json_valid(workspace_json) THEN 1 ELSE
  coalesce(json_extract(workspace_json,'$.mode'),'') NOT IN ('shared','folder','global') OR
  coalesce(json_type(workspace_json,'$.folder'),'null') NOT IN ('text','null') OR
  json_type(workspace_json,'$.revision') IS NOT 'integer' OR json_extract(workspace_json,'$.revision')<0 OR
  json_type(workspace_json,'$.afterSeq') IS NOT 'integer' OR
  EXISTS (SELECT 1 FROM json_each(channels.workspace_json) WHERE key NOT IN ('mode','folder','revision','afterSeq'))
END
UNION ALL
SELECT 'channels.is_lobby', id FROM channels WHERE is_lobby=1 AND
  EXISTS (SELECT 1 FROM channels other WHERE other.is_lobby=1 AND other.rowid<channels.rowid)
UNION ALL
SELECT 'channel_members', channel_id||'/'||member_id FROM channel_members
WHERE member_id<>'me' AND NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=channel_members.member_id)
UNION ALL
SELECT 'skills.source', id FROM skills WHERE source IS NOT NULL AND CASE WHEN NOT json_valid(source) THEN 1 ELSE
  json_type(source)<>'object' OR (SELECT count(*) FROM json_each(skills.source))<>2 OR
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
      NOT EXISTS (SELECT 1 FROM agents WHERE agents.id=j.value)
  ) OR json_type(attachments)<>'array' OR EXISTS (
    SELECT 1 FROM json_each(messages.attachments) j WHERE CASE WHEN j.type<>'object' THEN 1 ELSE
      (SELECT count(*) FROM json_each(j.value))<>4 END
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
SELECT 'avatar_frames', id FROM avatar_frames WHERE kind='png' AND svg<>''
LIMIT 1;
