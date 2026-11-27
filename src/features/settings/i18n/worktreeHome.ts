// settings の「作業用フォルダ（git worktree）の置き場」の文言（日本語が正）
import { createTranslator, type Messages } from '@/shared/i18n';

const ja = {
  title: '作業用フォルダの置き場',
  label: '置き場のフォルダ',
  hint: 'AI が git worktree（作業用フォルダ）を作るときの置き場です。PC全体に書き込める AI にはこの場所を、そうでない AI には自分の作業場所の中を使うよう伝えます。空欄なら既定の場所を使います。保存した次の実行から反映します。',
  current: '現在の置き場',
  backupNote:
    'バックアップやコピーのときは、この置き場（既定では worktrees フォルダ）を外してかまいません（コミットしていない変更は残りません）。',
  repairNote:
    'データの保存先や置き場を移したら git worktree repair が必要です（移した worktree の中で実行するか、元のリポジトリで新しい場所を指定して実行します）。',
  notAbsolute: '絶対パスで入力してください（例: D:\\worktrees）。',
  choose: 'フォルダを選ぶ…',
  save: '置き場を保存',
  failed: '置き場を読み込むか保存することができませんでした。閉じて開き直すか、再度保存してください。',
};

const en: Messages<typeof ja> = {
  title: 'Worktree folder',
  label: 'Folder for worktrees',
  hint: 'Where AIs create git worktrees. AIs that can write anywhere on this PC are told to use this folder; other AIs use their own workspace. Leave blank to use the default. Applies from the next run after saving.',
  current: 'Current folder',
  backupNote:
    'You can leave this folder (worktrees by default) out of backups and copies (uncommitted changes are not kept).',
  repairNote:
    'After moving the data location or this folder, run git worktree repair (inside each moved worktree, or in the original repository with the new paths).',
  notAbsolute: 'Enter an absolute path (for example, D:\\worktrees).',
  choose: 'Choose folder…',
  save: 'Save worktree folder',
  failed: 'Could not load or save the worktree folder. Reopen settings or try saving again.',
};

const zhHans: Messages<typeof ja> = {
  title: '工作树文件夹位置',
  label: '存放文件夹',
  hint: 'AI 创建 git worktree（工作用文件夹）时的位置。可写入整台电脑的 AI 会被告知使用此位置，其他 AI 使用各自的工作区。留空则使用默认位置。保存后从下一次运行开始生效。',
  current: '当前位置',
  backupNote: '备份或复制时可以排除此位置（默认为 worktrees 文件夹）（未提交的更改不会保留）。',
  repairNote:
    '移动数据存储位置或此文件夹后，需要运行 git worktree repair（在移动后的 worktree 中运行，或在原仓库中指定新位置运行）。',
  notAbsolute: '请输入绝对路径（例如 D:\\worktrees）。',
  choose: '选择文件夹…',
  save: '保存位置',
  failed: '无法读取或保存位置。请关闭后重新打开，或再次保存。',
};

const zhHant: Messages<typeof ja> = {
  title: '工作樹資料夾位置',
  label: '存放資料夾',
  hint: 'AI 建立 git worktree（工作用資料夾）時的位置。可寫入整台電腦的 AI 會被告知使用此位置，其他 AI 使用各自的工作區。留空則使用預設位置。儲存後從下一次執行開始生效。',
  current: '目前位置',
  backupNote: '備份或複製時可以排除此位置（預設為 worktrees 資料夾）（未提交的變更不會保留）。',
  repairNote:
    '移動資料儲存位置或此資料夾後，需要執行 git worktree repair（在移動後的 worktree 中執行，或在原儲存庫中指定新位置執行）。',
  notAbsolute: '請輸入絕對路徑（例如 D:\\worktrees）。',
  choose: '選擇資料夾…',
  save: '儲存位置',
  failed: '無法讀取或儲存位置。請關閉後重新開啟，或再次儲存。',
};

const ko: Messages<typeof ja> = {
  title: '작업용 폴더 위치',
  label: '보관 폴더',
  hint: 'AI가 git worktree(작업용 폴더)를 만들 위치입니다. PC 전체에 쓸 수 있는 AI에게는 이 위치를, 그렇지 않은 AI에게는 자신의 작업 공간을 쓰도록 안내합니다. 비워 두면 기본 위치를 사용합니다. 저장한 다음 실행부터 적용됩니다.',
  current: '현재 위치',
  backupNote: '백업이나 복사할 때 이 위치(기본값은 worktrees 폴더)는 빼도 됩니다(커밋하지 않은 변경은 남지 않습니다).',
  repairNote:
    '데이터 저장 위치나 이 폴더를 옮긴 뒤에는 git worktree repair가 필요합니다(옮긴 worktree 안에서 실행하거나, 원래 저장소에서 새 위치를 지정해 실행).',
  notAbsolute: '절대 경로로 입력하세요(예: D:\\worktrees).',
  choose: '폴더 선택…',
  save: '위치 저장',
  failed: '위치를 불러오거나 저장할 수 없습니다. 설정을 다시 열거나 다시 저장하세요.',
};

export const tWorktreeHome = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
