import { createTranslator, type Messages } from '@/shared/i18n';

const ja = {
  title: 'ライセンス表記',
  summary: '図鑑のキャラクター画像はアプリの MIT ライセンスの対象外です。商用利用はできません。',
  gallery: 'AI 擬人化キャラクター図鑑',
  artistTerms: '作者の利用条件（Pixiv）',
  changes: '変更点',
  faceCrop: '顔を正方形に切り抜き',
  fullBodyCutout: '全身画像の背景を除去',
  unmodifiedFullBody: '全身画像は加工なし',
  artistCredit: '作者 ZipZipPipe',
  terms: '作者名の表示が必要・商用利用不可',
  deepseekTerms: 'CC BY-NC-SA 4.0（表示・非営利・継承）',
  deepseekCredit: '原キャラクター 上善无形 ／ アレンジ ZipZipPipe',
  jevTerms:
    '利用条件の記載は見つかっていません。このアプリでは、ほかのキャラと同じく作者名の表示・商用利用不可として扱います',
  originalPost: '元の投稿',
  originalCharacter: '原キャラクターの投稿',
};

const en: Messages<typeof ja> = {
  title: 'License notices',
  summary: 'Gallery character images are excluded from the app’s MIT license. Commercial use is prohibited.',
  gallery: 'AI Gijinka character gallery',
  artistTerms: 'Artist’s terms (Pixiv)',
  changes: 'Changes',
  faceCrop: 'Face cropped to a square',
  fullBodyCutout: 'Background removed from full-body image',
  unmodifiedFullBody: 'Full-body image unmodified',
  artistCredit: 'By ZipZipPipe',
  terms: 'Artist attribution required. No commercial use.',
  deepseekTerms: 'CC BY-NC-SA 4.0 (Attribution, NonCommercial, ShareAlike)',
  deepseekCredit: 'Original character by 上善无形. Adaptation by ZipZipPipe.',
  jevTerms:
    'No terms of use found. This app treats it like the other characters: attribution required, no commercial use.',
  originalPost: 'Original post',
  originalCharacter: 'Original character post',
};

const zhHans: Messages<typeof ja> = {
  title: '许可声明',
  summary: '图鉴角色图片不适用应用的 MIT 许可证。不得用于商业用途。',
  gallery: 'AI 拟人化角色图鉴',
  artistTerms: '作者的使用条件（Pixiv）',
  changes: '修改内容',
  faceCrop: '将脸部裁剪为正方形',
  fullBodyCutout: '移除全身图片的背景',
  unmodifiedFullBody: '全身图片未作修改',
  artistCredit: '作者 ZipZipPipe',
  terms: '须注明作者。不可商用。',
  deepseekTerms: 'CC BY-NC-SA 4.0（署名、非商业性使用、相同方式共享）',
  deepseekCredit: '原角色 上善无形 ／ 二次设计 ZipZipPipe',
  jevTerms: '未找到使用条件说明。本应用对其采用与其他角色相同的规则：须注明作者，不可商用。',
  originalPost: '原帖',
  originalCharacter: '原始角色的帖子',
};

const zhHant: Messages<typeof ja> = {
  title: '授權聲明',
  summary: '圖鑑角色圖片不適用應用程式的 MIT 授權。不得用於商業用途。',
  gallery: 'AI 擬人化角色圖鑑',
  artistTerms: '作者的使用條件（Pixiv）',
  changes: '修改內容',
  faceCrop: '將臉部裁切為正方形',
  fullBodyCutout: '移除全身圖片的背景',
  unmodifiedFullBody: '全身圖片未經修改',
  artistCredit: '作者 ZipZipPipe',
  terms: '須標明作者。不得商用。',
  deepseekTerms: 'CC BY-NC-SA 4.0（姓名標示、非商業性、相同方式分享）',
  deepseekCredit: '原角色 上善无形 ／ 二次設計 ZipZipPipe',
  jevTerms: '未找到使用條件說明。本應用程式對其採用與其他角色相同的規則：須標明作者，不得商用。',
  originalPost: '原始貼文',
  originalCharacter: '原角色的貼文',
};

const ko: Messages<typeof ja> = {
  title: '라이선스 고지',
  summary: '도감 캐릭터 이미지는 앱의 MIT 라이선스 적용 대상에서 제외됩니다. 상업적으로 사용할 수 없습니다.',
  gallery: 'AI 의인화 캐릭터 도감',
  artistTerms: '작가의 이용 조건(Pixiv)',
  changes: '변경 사항',
  faceCrop: '얼굴을 정사각형으로 자름',
  fullBodyCutout: '전신 이미지의 배경을 제거',
  unmodifiedFullBody: '전신 이미지는 수정하지 않음',
  artistCredit: '작가 ZipZipPipe',
  terms: '작가 표기 필수. 상업적 이용 금지.',
  deepseekTerms: 'CC BY-NC-SA 4.0(저작자표시, 비영리, 동일조건변경허락)',
  deepseekCredit: '원본 캐릭터 上善无形 / 각색 ZipZipPipe',
  jevTerms:
    '이용 조건에 관한 안내를 찾지 못했습니다. 이 앱에서는 다른 캐릭터와 마찬가지로 작가 표기가 필요하며 상업적 이용은 금지됩니다.',
  originalPost: '원본 게시물',
  originalCharacter: '원본 캐릭터 게시물',
};

export const tGalleryLicenses = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
