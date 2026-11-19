-- Only types and record identifiers go to the application log.
SELECT 'unknown_meta' AS kind,coalesce(key,'<NULL>') AS id FROM meta
WHERE key IS NULL OR (key NOT IN ('schema_fingerprint','seeded','guild_profile','interrupted_jobs')
  AND NOT (substr(key,1,21)='desktop-notification:' AND length(key)>21))
UNION ALL
SELECT 'seed_marker_normalized',key FROM meta WHERE key='seeded' AND value<>'1'
UNION ALL
SELECT 'receipt_normalized',substr(key,22) FROM meta WHERE substr(key,1,21)='desktop-notification:' AND length(key)>21 AND value<>'attempted'
UNION ALL
SELECT 'reserved_mention',m.id||'/'||j.value FROM messages m,json_each(m.mentions) j WHERE j.value IN ('me','system')
UNION ALL
SELECT 'agent_frame_reset',a.id FROM agents a JOIN temp.frame_repairs r ON r.id=a.frame WHERE r.svg_text IS NULL
UNION ALL
SELECT 'profile_frame_reset',cast(p.id AS text) FROM profile p JOIN temp.frame_repairs r ON r.id=p.frame WHERE r.svg_text IS NULL
UNION ALL
SELECT 'unused_png_svg',id FROM avatar_frames WHERE kind='png' AND svg<>''
UNION ALL
SELECT 'unknown_workspace_field',c.id FROM channels c,json_each(c.workspace_json) j WHERE j.key NOT IN ('mode','folder','revision','afterSeq')
UNION ALL
SELECT 'unused_workspace_value',id FROM channels WHERE coalesce(json_extract(workspace_json,'$.mode'),'') NOT IN ('shared','folder','global')
  OR coalesce(json_type(workspace_json,'$.folder'),'null') NOT IN ('text','null')
UNION ALL
SELECT 'unknown_voice_field',a.id FROM agents a,json_each(a.voice) j WHERE j.key NOT IN ('mode','intensity')
UNION ALL
SELECT 'unknown_skill_source_field',s.id FROM skills s,json_each(s.source) j
WHERE j.key<>'kind' AND j.key<>CASE json_extract(s.source,'$.kind') WHEN 'linked' THEN 'path' ELSE 'name' END
UNION ALL
SELECT 'unknown_attachment_field',m.id||'/'||json_extract(a.value,'$.id') FROM messages m,json_each(m.attachments) a,json_each(a.value) j
WHERE j.key NOT IN ('id','name','mediaType','size')
UNION ALL
SELECT 'unknown_guild_field',m.key FROM meta m,json_each(m.value) j WHERE m.key='guild_profile' AND j.key NOT IN ('name','crest')
UNION ALL
SELECT 'unknown_crest_field',m.key FROM meta m,json_each(m.value,'$.crest') j WHERE m.key='guild_profile' AND j.key NOT IN ('shape','color')
UNION ALL
SELECT 'unknown_interrupted_job_field',json_extract(job.value,'$.rootId') FROM meta m,json_each(m.value) job,json_each(job.value) j
WHERE m.key='interrupted_jobs' AND j.key NOT IN ('depth','rootId','channelId','agentId')
UNION ALL
SELECT 'voice_mode_defaulted',id FROM agents WHERE legacy_voice_mode(json_extract(voice,'$.mode')) IS NULL
UNION ALL
SELECT 'voice_intensity_defaulted',id FROM agents WHERE json_extract(voice,'$.intensity') NOT IN ('weak','medium','strong')
UNION ALL
SELECT 'crest_shape_defaulted',key FROM meta WHERE key='guild_profile' AND json_extract(value,'$.crest.shape') NOT IN ('diamond','shield','circle','hexagon','star')
UNION ALL
SELECT 'crest_color_defaulted',key FROM meta WHERE key='guild_profile' AND json_extract(value,'$.crest.color') NOT IN ('default','gold','crimson','jade','azure','violet')
ORDER BY 1,2;
