use super::memory;

#[test]
fn invalid_frame_kinds_and_mismatched_art_are_rejected() {
    let db = memory();
    for (kind, svg) in [("webp", None), ("svg", None), ("png", Some("<svg/>"))] {
        assert!(db
            .with(|c| c.execute(
                "INSERT INTO avatar_frames (id,name,kind,svg_text,created_at)
            VALUES ('x','frame',?1,?2,1)",
                rusqlite::params![kind, svg]
            ))
            .is_err());
    }
}
