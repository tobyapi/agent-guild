//! 会話の純粋なルール（design.md §6〜§8）: メンション解析・振り分け・ジョブと合流・返答の整形・お知らせの文面。

pub mod attachments;
pub mod job;
pub mod mentions;
pub mod notices;
pub mod reply;
pub mod routing;

pub use attachments::{file_attachments, image_messages, MAX_IMAGES_PER_RUN};
pub use job::{JobMode, JobSpec};
pub use mentions::parse_mentions;
pub use reply::format_reply;
pub use routing::{
    route_human_message, route_no_answer, route_reply, NoAnswer, Notice, Routing, RoutingContext, MAX_DEPTH,
};
