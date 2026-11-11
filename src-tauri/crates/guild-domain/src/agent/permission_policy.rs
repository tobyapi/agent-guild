//! 権限は先頭タグに対応する役割だけで決まる（どのバックエンドでも同じ。保存値からの個別の付け外しは受け付けない）。
//! バックエンドごとに違ってよいのは「その AI・その PC で実際に使える操作」だけで、それは役割の権限を
//! 広げず、守れない操作を取り除いて求める（usable_permissions）。

use super::{role_template, Permissions};
use crate::backend::BackendInfo;

/// 役割が未設定のときは、参照とスキルだけ（作業者の広い権限にはしない）。
pub fn role_permissions(tags: &[String]) -> Permissions {
    role_template(tags).map(|template| template.defaults.permissions).unwrap_or(Permissions {
        read_files: true,
        read_anywhere: false,
        skills: true,
        ..Permissions::default()
    })
}

/// 役割の権限のうち、そのバックエンドが実際に使える操作。道具がない操作と、隔離できないなどの理由で
/// ほかの許可を前提にする操作（permissionRules）を除く。連鎖する依存も収束するまで解決する。結果は必ず permissions の部分集合
pub fn usable_permissions(permissions: Permissions, backend: Option<&BackendInfo>) -> Permissions {
    let Some(backend) = backend else { return permissions };
    let mut effective = permissions.intersect(backend.capabilities);
    loop {
        let previous = effective;
        for rule in &backend.permission_rules {
            if !rule.missing(&effective).is_empty() {
                effective.deny(rule.when);
            }
        }
        if previous == effective {
            return effective;
        }
    }
}
