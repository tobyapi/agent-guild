// リリースビルドの Windows で余計なコンソール窓を出さない
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agent_guild_lib::run();
}
