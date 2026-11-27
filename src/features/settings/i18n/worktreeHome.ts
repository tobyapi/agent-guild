// settings の「作業用フォルダ（git worktree）の置き場」の文言（日本語が正）
import { createTranslator, type Messages } from '@/shared/i18n';

const ja = {
  title: '作業用フォルダの置き場',
  label: '置き場のフォルダ',
  hint: 'AI が git worktree（作業用フォルダ）を作るときの置き場です。PC全体に書き込めてコマンドを使える AI に、この場所を使うよう伝えます。空欄なら既定の場所を使います。保存した次の実行から反映します。',
  current: '現在の置き場',
  backupNote:
    'バックアップやコピーのときは、この置き場（既定では worktrees フォルダ）を外してかまいません（コミットしていない変更は残りません）。',
  repairNote:
    'アプリで保存先を移しても worktrees フォルダは写しません（古い場所に残ります）。古い保存先を消す前に中を確かめてください。worktree を手で移したときは git worktree repair が必要です。',
  notAbsolute: '絶対パスで入力してください（例: D:\\worktrees）。',
  choose: 'フォルダを選ぶ…',
  save: '置き場を保存',
  failed: '置き場を読み込むか保存することができませんでした。閉じて開き直すか、再度保存してください。',
};

const en: Messages<typeof ja> = {
  title: 'Worktree folder',
  label: 'Folder for worktrees',
  hint: 'Where AIs create git worktrees. AIs that can write anywhere on this PC and run commands are told to use this folder. Leave blank to use the default. Applies from the next run after saving.',
  current: 'Current folder',
  backupNote:
    'You can leave this folder (worktrees by default) out of backups and copies (uncommitted changes are not kept).',
  repairNote:
    'Moving the data location in the app does not copy the worktrees folder (it stays in the old location). Check its contents before deleting the old data location. If you move a worktree by hand, run git worktree repair.',
  notAbsolute: 'Enter an absolute path (for example, D:\\worktrees).',
  choose: 'Choose folder…',
  save: 'Save worktree folder',
  failed: 'Could not load or save the worktree folder. Reopen settings or try saving again.',
};

const zhHans: Messages<typeof ja> = {
  title: '工作树文件夹位置',
  label: '存放文件夹',
  hint: 'AI 创建 git worktree（工作用文件夹）时的位置。可写入整台电脑并能执行命令的 AI 会被告知使用此位置。留空则使用默认位置。保存后从下一次运行开始生效。',
  current: '当前位置',
  backupNote: '备份或复制时可以排除此位置（默认为 worktrees 文件夹）（未提交的更改不会保留）。',
  repairNote:
    '在应用中移动数据存储位置时，不会复制 worktrees 文件夹（它会留在原位置）。删除旧的存储位置前，请先检查其中的内容。手动移动 worktree 后，需要运行 git worktree repair。',
  notAbsolute: '请输入绝对路径（例如 D:\\worktrees）。',
  choose: '选择文件夹…',
  save: '保存位置',
  failed: '无法读取或保存位置。请关闭后重新打开，或再次保存。',
};

const zhHant: Messages<typeof ja> = {
  title: '工作樹資料夾位置',
  label: '存放資料夾',
  hint: 'AI 建立 git worktree（工作用資料夾）時的位置。可寫入整台電腦並能執行命令的 AI 會被告知使用此位置。留空則使用預設位置。儲存後從下一次執行開始生效。',
  current: '目前位置',
  backupNote: '備份或複製時可以排除此位置（預設為 worktrees 資料夾）（未提交的變更不會保留）。',
  repairNote:
    '在應用程式中移動資料儲存位置時，不會複製 worktrees 資料夾（它會留在原位置）。刪除舊的儲存位置前，請先檢查其中的內容。手動移動 worktree 後，需要執行 git worktree repair。',
  notAbsolute: '請輸入絕對路徑（例如 D:\\worktrees）。',
  choose: '選擇資料夾…',
  save: '儲存位置',
  failed: '無法讀取或儲存位置。請關閉後重新開啟，或再次儲存。',
};

const ko: Messages<typeof ja> = {
  title: '작업용 폴더 위치',
  label: '보관 폴더',
  hint: 'AI가 git worktree(작업용 폴더)를 만들 위치입니다. PC 전체에 쓸 수 있고 명령을 실행할 수 있는 AI에게 이 위치를 쓰도록 안내합니다. 비워 두면 기본 위치를 사용합니다. 저장한 다음 실행부터 적용됩니다.',
  current: '현재 위치',
  backupNote: '백업이나 복사할 때 이 위치(기본값은 worktrees 폴더)는 빼도 됩니다(커밋하지 않은 변경은 남지 않습니다).',
  repairNote:
    '앱에서 데이터 저장 위치를 옮겨도 worktrees 폴더는 복사하지 않습니다(이전 위치에 남습니다). 이전 저장 위치를 지우기 전에 안을 확인하세요. worktree를 직접 옮겼다면 git worktree repair가 필요합니다.',
  notAbsolute: '절대 경로로 입력하세요(예: D:\\worktrees).',
  choose: '폴더 선택…',
  save: '위치 저장',
  failed: '위치를 불러오거나 저장할 수 없습니다. 설정을 다시 열거나 다시 저장하세요.',
};

export const tWorktreeHome = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
