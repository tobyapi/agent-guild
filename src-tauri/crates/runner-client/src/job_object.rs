//! Windows のジョブオブジェクト（KILL_ON_JOB_CLOSE）。ランナーとその子孫（SDK が起動する CLI）を1つのジョブに入れ、
//! アプリが落ちてハンドルが閉じたら OS がまとめて終了させる。Windows 以外では何もしない。

#[cfg(windows)]
mod platform {
    use std::io;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub(crate) struct KillOnCloseJob(HANDLE);

    // SAFETY: ジョブオブジェクトのハンドルはプロセス内のどのスレッドから使ってもよい（カーネルオブジェクト）。
    unsafe impl Send for KillOnCloseJob {}
    // SAFETY: 同上。このハンドルに対する操作（割り当て・クローズ）はスレッドセーフな Win32 API だけ。
    unsafe impl Sync for KillOnCloseJob {}

    impl KillOnCloseJob {
        pub(crate) fn new() -> io::Result<Self> {
            // SAFETY: 既定のセキュリティ属性・名前なし（どちらも null 可）。
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = Self(handle);
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            // SAFETY: limits は生きている間だけ渡し、長さはその型の大きさそのもの。
            let ok = unsafe {
                SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    (&raw const limits).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if ok == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(job)
        }

        pub(crate) fn assign(&self, child: &tokio::process::Child) -> io::Result<()> {
            // 既に終了していればハンドルはない（割り当てるものがない）
            let Some(process) = child.raw_handle() else {
                return Ok(());
            };
            // SAFETY: process は child が保持している有効なプロセスハンドル。
            if unsafe { AssignProcessToJobObject(self.0, process) } == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        }
    }

    impl Drop for KillOnCloseJob {
        fn drop(&mut self) {
            // SAFETY: new() で得た有効なハンドルを1回だけ閉じる。
            unsafe { CloseHandle(self.0) };
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use std::io;

    pub(crate) struct KillOnCloseJob;

    impl KillOnCloseJob {
        pub(crate) fn new() -> io::Result<Self> {
            Ok(Self)
        }

        pub(crate) fn assign(&self, _child: &tokio::process::Child) -> io::Result<()> {
            Ok(())
        }
    }
}

pub(crate) use platform::KillOnCloseJob;
