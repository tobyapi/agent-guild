-- Source is the verified read-only 0.1.28 backup attached as legacy.
INSERT INTO agents (
  rowid, id, name, name_key, avatar, color, role_description, personality, tone, expertise, backend, model,
  backend_options_json, unmentioned, consultable, can_delegate, autonomy_enabled, autonomy_interval_min,
  autonomy_channel_id, last_autonomous_at, created_at, deleted_at, frame_id, voice_mode, voice_intensity
) SELECT rowid, id, name, name_key, avatar, color, role, personality, tone, expertise, backend, model,
  backend_options, unmentioned, consultable, can_delegate, autonomy_enabled, autonomy_interval_min,
  autonomy_channel_id, last_autonomous_at, created_at, deleted_at, nullif(frame,''), legacy_voice_mode(voice),
  coalesce(json_extract(voice,'$.intensity'),'weak') FROM legacy.agents;
INSERT INTO actors (id,kind,agent_id) SELECT id,'agent',id FROM legacy.agents;
INSERT INTO agent_tags (agent_id,position,label) SELECT a.id,j.key,j.value FROM legacy.agents a,json_each(a.tags) j;
INSERT INTO user_profile (id,name,avatar,color,frame_id) SELECT id,name,avatar,color,nullif(frame,'') FROM legacy.profile;
INSERT INTO avatar_frames (rowid,id,name,kind,svg_text,created_at)
  SELECT rowid,id,name,kind,CASE kind WHEN 'png' THEN NULL ELSE svg END,created_at FROM legacy.avatar_frames;
INSERT INTO skills (id,agent_id,name,description,body,updated_at,source_kind,source_path,builtin_name)
  SELECT id,agent_id,name,description,body,updated_at,
    CASE WHEN source IS NULL THEN 'local' ELSE json_extract(source,'$.kind') END,
    json_extract(source,'$.path'),json_extract(source,'$.name') FROM legacy.skills;
INSERT INTO channels (rowid,id,name,topic,icon,created_at,is_lobby,history_after_seq,guard_old_roots)
  SELECT rowid,id,name,topic,icon,created_at,is_lobby,json_extract(workspace_json,'$.afterSeq'),
    json_extract(workspace_json,'$.revision')>0 FROM legacy.channels;
INSERT INTO channel_members (channel_id,actor_id,position)
  SELECT channel_id,member_id,row_number() OVER (PARTITION BY channel_id ORDER BY rowid)-1 FROM legacy.channel_members;
INSERT INTO messages (seq,id,channel_id,author_id,content,kind,reply_to_id,root_id,depth,created_at,skill_usage_json)
  SELECT seq,id,channel_id,author_id,content,kind,reply_to_id,root_id,depth,created_at,
    CASE WHEN json_type(skill_usage)='object' THEN skill_usage END FROM legacy.messages;
DELETE FROM main.sqlite_sequence WHERE name='messages';
INSERT INTO main.sqlite_sequence (name,seq) SELECT name,seq FROM legacy.sqlite_sequence WHERE name='messages';
INSERT INTO message_attachments (message_id,position,attachment_id,name,media_type,size_bytes)
  SELECT m.id,j.key,json_extract(j.value,'$.id'),json_extract(j.value,'$.name'),json_extract(j.value,'$.mediaType'),json_extract(j.value,'$.size')
  FROM legacy.messages m,json_each(m.attachments) j;
INSERT INTO message_mentions (message_id,position,actor_id)
  SELECT m.id,j.key,j.value FROM legacy.messages m,json_each(m.mentions) j;
INSERT INTO delegations (rowid,id,channel_id,manager_id,source_message_id,status,summary_message_id,created_at,updated_at)
  SELECT rowid,id,channel_id,manager_id,message_id,status,summary_message_id,created_at,updated_at FROM legacy.delegations;
INSERT INTO subtasks (id,delegation_id,position,assignee_id,instruction,status,result_message_id,note)
  SELECT id,delegation_id,position,assignee_id,instruction,status,result_message_id,note FROM legacy.subtasks;
INSERT INTO run_measurements (job_id,channel_id,backend,model,duration_ms,input_tokens,output_tokens,estimated_cost_nano_usd)
  SELECT job_id,channel_id,backend,model,duration_ms,input_tokens,output_tokens,estimated_cost_nano_usd FROM legacy.run_measurements;
INSERT INTO skill_record_cutoffs (job_id,channel_id) SELECT job_id,channel_id FROM legacy.skill_record_cutoffs;
UPDATE db_state SET seeded=EXISTS(SELECT 1 FROM legacy.meta WHERE key='seeded') WHERE id=1;
INSERT INTO guild_profile (id,name,crest_shape,crest_color)
  SELECT 1,json_extract(value,'$.name'),json_extract(value,'$.crest.shape'),json_extract(value,'$.crest.color') FROM legacy.meta WHERE key='guild_profile';
INSERT INTO notification_receipts (message_id,outcome) SELECT substr(key,22),value
  FROM legacy.meta WHERE substr(key,1,21)='desktop-notification:';
INSERT INTO interrupted_jobs (position,channel_id,root_id,depth,agent_id)
  SELECT j.key,json_extract(j.value,'$.channelId'),json_extract(j.value,'$.rootId'),json_extract(j.value,'$.depth'),json_extract(j.value,'$.agentId')
  FROM legacy.meta k,json_each(k.value) j WHERE k.key='interrupted_jobs';
