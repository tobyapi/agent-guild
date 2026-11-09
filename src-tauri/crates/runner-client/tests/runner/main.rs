//! 偽ランナー（tests/fixtures/*.mjs）を実際に子プロセスとして起動し、RunnerClient の振る舞いを確かめる。
//! node が PATH にあること。

mod jobs;
mod lifecycle;
mod support;
