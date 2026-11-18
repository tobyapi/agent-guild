#!/usr/bin/env bash
set -euo pipefail

repo="repos/$GITHUB_REPOSITORY"
api_version='X-GitHub-Api-Version: 2026-03-10'

api() {
  gh api -H "$api_version" "$@"
}

api_get() {
  local attempt
  for attempt in {0..3}; do
    # バイナリの添付やページ途中の失敗に備え、成功した応答だけを返す。
    if api --method GET "$@" > "$work/api-body" 2> "$work/api-error"; then
      cat "$work/api-error" >&2
      cat "$work/api-body"
      return
    fi
    cat "$work/api-error" >&2
    # gh は HTTP エラーを末尾の (HTTP nnn) で示す。通信エラーには HTTP コードがない。
    if (( attempt == 3 )) || grep -Eq '\(HTTP [1-4][0-9]{2}\)$' "$work/api-error"; then
      return 1
    fi
    sleep "$((2 ** attempt))"
  done
}

assert_tag() {
  if ! api_get "$repo/git/ref/tags/$TAG" |
    jq -e --arg sha "$RELEASE_SHA" '.object.type == "commit" and .object.sha == $sha' > /dev/null; then
    echo "::error::タグ $TAG が push したコミット $RELEASE_SHA を指していません"
    return 1
  fi
}

# List Releases includes drafts when the caller has write access.
releases() {
  api_get --paginate --slurp "$repo/releases?per_page=100" | jq -c 'add'
}

lookup_release() {
  jq -c --arg tag "$TAG" '
    map(select(.tag_name == $tag))
    | if length <= 1 then .[0] else error("同じタグのリリースが複数あります") end
  '
}

matching_builds() {
  api_get --paginate --slurp "$build_workflow/runs?event=workflow_dispatch&head_sha=$RELEASE_SHA&per_page=100" |
    jq -c --arg sha "$RELEASE_SHA" --arg tag "$TAG" '
      [.[].workflow_runs[] | select(.head_sha == $sha and .head_branch == $tag and .event == "workflow_dispatch")]
    '
}

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
build_workflow="$repo/actions/workflows/build.yml"
printf -v notes '同梱の Codex SDK を **%s** から **%s** に更新しました。' "$OLD_SDK" "$NEW_SDK"

assert_tag
existing=$(releases | lookup_release)
if jq -e '.draft == false' <<< "$existing" > /dev/null; then
  # 公開 API が成功した直後に中断した場合の再実行に対応する。
  release_id=$(jq -er --arg notes "$notes" 'select((.body // "") | contains($notes)) | .id' <<< "$existing")
  api_get "$repo/releases/latest" | jq -e --argjson id "$release_id" '.id == $id' > /dev/null
  exit 0
fi

builds=$(matching_builds)
run_id=$(jq -r 'map(select(.status != "completed" or .conclusion == "success")) | max_by(.id) | .id // empty' <<< "$builds")
if [[ -z "$run_id" ]]; then
  # API 2026-03-10 は ref だけで run の情報を返す。
  # ランナーと GitHub の時計のずれを見込んで、検索範囲を60秒広げる。
  dispatch_started=$(node -p 'new Date(Date.now() - 60_000).toISOString().slice(0, 19) + "Z"')
  build=$(api --method POST "$build_workflow/dispatches" -f "ref=$TAG")
  run_id=$(jq -r '.workflow_run_id | numbers' <<< "${build:-null}")
  if [[ -z "$run_id" ]]; then
    # 広げた範囲に入る、起動前から見えていた失敗 run は除く。
    prior_ids=$(jq -c 'map(.id)' <<< "$builds")
    for attempt in {1..20}; do
      run_id=$(matching_builds | jq -r --arg since "$dispatch_started" --argjson prior_ids "$prior_ids" '
        map(select(.created_at >= $since and (.id as $id | $prior_ids | index($id) == null)))
        | max_by(.id) | .id // empty
      ')
      [[ -z "$run_id" ]] || break
      if (( attempt < 20 )); then sleep 15; fi
    done
    if [[ -z "$run_id" ]]; then
      echo "::error::タグ $TAG の build.yml の run が見つかりません（${RELEASE_SHA}）"
      exit 1
    fi
  fi
else
  echo "既存の build.yml の run $run_id を使用します"
fi
echo "Build: ${GITHUB_SERVER_URL:-https://github.com}/$GITHUB_REPOSITORY/actions/runs/$run_id"

# SignPath の本番署名は最大1時間承認を待つ。ビルドと Actions の待ち時間も含め、最大2時間待つ。
deadline=$((SECONDS + 7200))
while true; do
  run=$(api_get "$repo/actions/runs/$run_id")
  if ! status=$(jq -er --arg sha "$RELEASE_SHA" --arg tag "$TAG" '
    select(.head_sha == $sha and .head_branch == $tag and .event == "workflow_dispatch") | .status
  ' <<< "$run"); then
    echo "::error::build.yml の run $run_id がタグ $TAG とコミット $RELEASE_SHA に一致しません"
    exit 1
  fi
  if [[ "$status" == completed ]]; then
    conclusion=$(jq -er '.conclusion' <<< "$run")
    if [[ "$conclusion" != success ]]; then
      echo "::error::build.yml の run $run_id は $conclusion で終了しました"
      exit 1
    fi
    break
  fi
  if (( SECONDS >= deadline )); then
    echo "::error::build.yml の run $run_id が待ち時間内に完了しませんでした"
    exit 1
  fi
  sleep 30
done

api_get "$repo/actions/runs/$run_id/jobs" | jq -e '
  if (.jobs | map(.name) | sort) == ["build (macos-arm64)", "build (windows-x64)", "update manifest"]
    and all(.jobs[]; .conclusion == "success")
  then true else error("Windows、macOS、更新情報の3ジョブが成功していません") end
' > /dev/null

releases | lookup_release > "$work/release.json"
release_id=$(jq -er 'select(.draft and (.prerelease | not)) | .id' "$work/release.json")
for asset in latest.json "agent-guild_windows-x64_${TAG#v}_x64-setup.exe.sig" agent-guild_macos-arm64_agent-guild.app.tar.gz.sig; do
  asset_id=$(jq -er --arg asset "$asset" '.assets[] | select(.name == $asset) | .id' "$work/release.json")
  api_get -H 'Accept: application/octet-stream' "$repo/releases/assets/$asset_id" > "$work/$asset"
done
node scripts/codex-update.mjs verify-release "$TAG" "$GITHUB_REPOSITORY" "$work"

assert_tag
# ビルドを待つ間に、別のリリースが先に公開されていないか確認する。
if ! releases | jq -e --arg tag "$TAG" '
  def version: ltrimstr("v") | split(".") | map(tonumber);
  all(.[]; .draft or .prerelease or (.tag_name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$") | not)
    or ((.tag_name | version) < ($tag | version)))
' > /dev/null; then
  echo "::error::$TAG と同じ版か、より新しい版が既に公開されています。下書きを確認してください"
  exit 1
fi

body=$(jq -r '.body // ""' "$work/release.json")
if [[ -n "$body" ]]; then
  notes="$body"$'\n\n'"$notes"
fi
api --method PATCH "$repo/releases/$release_id" -F draft=false -f make_latest=true -f "body=$notes" |
  jq -er 'select(.draft == false) | .html_url'
api_get "$repo/releases/latest" | jq -e --argjson id "$release_id" '.id == $id' > /dev/null
