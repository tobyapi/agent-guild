//! Check the volume containing a Markdown link before handing its path to the shell.
use std::path::Path;

#[cfg(windows)]
pub(super) fn is_local(path: &Path) -> bool {
    use std::path::{Component, Prefix};
    use windows_sys::Win32::Storage::FileSystem::GetDriveTypeW;
    use windows_sys::Win32::System::WindowsProgramming::{DRIVE_CDROM, DRIVE_FIXED, DRIVE_RAMDISK, DRIVE_REMOVABLE};

    let Some(Component::Prefix(prefix)) = path.components().next() else { return false };
    let Prefix::Disk(letter) = prefix.kind() else { return false };
    let root = [u16::from(letter), u16::from(b':'), u16::from(b'\\'), 0];
    // SAFETY: root is a live, NUL-terminated UTF-16 drive root.
    matches!(unsafe { GetDriveTypeW(root.as_ptr()) }, DRIVE_FIXED | DRIVE_REMOVABLE | DRIVE_CDROM | DRIVE_RAMDISK)
}

#[cfg(target_os = "macos")]
pub(super) fn is_local(path: &Path) -> bool {
    use nix::{mount::MntFlags, sys::statfs::statfs};
    statfs(path).is_ok_and(|fs| fs.flags().contains(MntFlags::MNT_LOCAL))
}

#[cfg(target_os = "linux")]
pub(super) fn is_local(path: &Path) -> bool {
    use nix::sys::statfs::*;
    const ZFS: FsType = FsType(0x2fc12fc1);
    const NTFS: FsType = FsType(0x5346544e);
    const SQUASHFS: FsType = FsType(0x73717368);
    const EXFAT: FsType = FsType(0x2011bab0);
    // Linux has no MNT_LOCAL flag. Unknown and userspace mounts may be remote.
    statfs(path).is_ok_and(|fs| {
        matches!(
            fs.filesystem_type(),
            EXT4_SUPER_MAGIC
                | BTRFS_SUPER_MAGIC
                | XFS_SUPER_MAGIC
                | F2FS_SUPER_MAGIC
                | TMPFS_MAGIC
                | OVERLAYFS_SUPER_MAGIC
                | MSDOS_SUPER_MAGIC
                | UDF_SUPER_MAGIC
                | ISOFS_SUPER_MAGIC
                | REISERFS_SUPER_MAGIC
                | NILFS_SUPER_MAGIC
                | JFFS2_SUPER_MAGIC
                | ZFS
                | NTFS
                | SQUASHFS
                | EXFAT
        )
    })
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub(super) fn is_local(_: &Path) -> bool {
    false
}
