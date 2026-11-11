//! 先頭タグに対応する役割の固定権限。保存値からの個別の付け外しは受け付けない。
//! バックエンドの依存関係は、許可範囲を広げず、実現できない操作を取り除いて解決する。

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

/// 非対応の操作と、禁止された操作を前提とする操作を除く。連鎖する依存も収束するまで解決する。
pub fn supported_permissions(permissions: Permissions, backend: Option<&BackendInfo>) -> Permissions {
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
