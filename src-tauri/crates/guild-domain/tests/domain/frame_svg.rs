//! 生成した枠の SVG の検査: 許可したものだけで書き直し、危険なものは失敗にする。

use guild_domain::frame::{extract_svg, sanitize_frame_svg, SvgProblem, FRAME_SVG_MAX_BYTES};

const RING: &str = r#"<circle cx="64" cy="64" r="52" fill="none" stroke="gold" stroke-width="6"/>"#;

fn svg(body: &str) -> String {
    format!(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">{body}</svg>"#)
}

fn problem(body: &str) -> SvgProblem {
    match sanitize_frame_svg(&svg(body)) {
        Err(problem) => problem,
        Ok(out) => panic!("{body} は通らないはず: {out}"),
    }
}

#[test]
fn keeps_allowed_shapes_and_attributes() {
    let body = r##"<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="white"/></linearGradient></defs><g transform="rotate(45 64 64)"><path d="M0 0L10 10" fill="url(#g)"/></g>"##;
    let out = sanitize_frame_svg(&svg(body)).unwrap();
    assert_eq!(out, svg(body));
}

#[test]
fn keeps_the_filter_primitives_for_volume_and_texture() {
    let body = concat!(
        r##"<defs><filter id="f" color-interpolation-filters="sRGB">"##,
        r##"<feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#000" flood-opacity="0.5"/>"##,
        r##"<feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves="3" seed="4" stitchTiles="stitch" result="n"/>"##,
        r##"<feComponentTransfer in="n"><feFuncR type="linear" slope="0.6" intercept="0.7"/><feFuncA type="table" tableValues="0 1"/></feComponentTransfer>"##,
        r##"<feSpecularLighting surfaceScale="3" specularConstant="0.8" specularExponent="20" lighting-color="#fff"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting>"##,
        r##"<feDiffuseLighting diffuseConstant="1.2"><fePointLight x="10" y="10" z="30"/></feDiffuseLighting>"##,
        r##"</filter></defs><path d="M0 0L10 10" filter="url(#f)"/>"##,
    );
    assert_eq!(sanitize_frame_svg(&svg(body)).unwrap(), svg(body));
    assert!(matches!(
        problem(r#"<filter><feImage href="https://example.com/a.png"/></filter>"#),
        SvgProblem::Forbidden(_)
    ));
}

#[test]
fn extracts_the_svg_from_a_chatty_reply() {
    let reply = format!("できました！\n```svg\n{}\n```\nどうぞ。", svg(RING));
    assert_eq!(extract_svg(&reply), Some(svg(RING).as_str()));
    assert_eq!(sanitize_frame_svg(&reply).unwrap(), svg(RING));
    assert_eq!(sanitize_frame_svg("SVG は描けません"), Err(SvgProblem::NotFound));
}

#[test]
fn rewrites_the_root_with_the_namespace_and_a_view_box() {
    let out = sanitize_frame_svg(&format!(r#"<svg width="300" height="300" onclick="x()">{RING}</svg>"#));
    assert_eq!(out, Err(SvgProblem::EventAttribute("onclick".to_owned())));
    let out = sanitize_frame_svg(&format!(r#"<svg width="300" height="300" viewBox="0 0 256 256">{RING}</svg>"#));
    assert_eq!(out.unwrap(), format!(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">{RING}</svg>"#));
    let out = sanitize_frame_svg(&format!(r#"<svg viewBox="0 0 -1 x">{RING}</svg>"#)).unwrap();
    assert!(out.starts_with(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">"#), "{out}");
}

#[test]
fn rejects_scripts_and_foreign_content() {
    for body in [
        "<script>alert(1)</script>",
        "<foreignObject><div/></foreignObject>",
        r#"<image href="https://example.com/a.png"/>"#,
        "<a><circle r=\"3\"/></a>",
        r#"<animate attributeName="href" to="javascript:alert(1)"/>"#,
        "<set attributeName=\"fill\" to=\"red\"/>",
        "<SCRIPT>alert(1)</SCRIPT>",
        "<svg:script>alert(1)</svg:script>",
    ] {
        assert!(matches!(problem(body), SvgProblem::Forbidden(_)), "{body}");
    }
}

#[test]
fn rejects_event_attributes_and_outside_references() {
    assert!(matches!(problem(r#"<circle r="3" onload="x()"/>"#), SvgProblem::EventAttribute(_)));
    assert!(matches!(problem(r#"<circle r="3" ONMOUSEOVER="x()"/>"#), SvgProblem::EventAttribute(_)));
    for body in [
        r#"<use href="https://example.com/a.svg#x"/>"#,
        r#"<use xlink:href="data:image/svg+xml,abc"/>"#,
        r#"<path d="M0 0" fill="url(https://example.com/x)"/>"#,
        r#"<path d="M0 0" fill="url( 'data:x' )"/>"#,
        r#"<path d="M0 0" filter="javascript:alert(1)"/>"#,
        r#"<path d="M0 0" fill="&#106;avascript:alert(1)"/>"#,
        r#"<path d="M0 0" fill="u\rl(x)"/>"#,
    ] {
        assert_eq!(problem(body), SvgProblem::ExternalReference, "{body}");
    }
}

#[test]
fn local_references_become_plain_href() {
    let out =
        sanitize_frame_svg(&svg(r##"<defs><path id="leaf" d="M0 0L4 4"/></defs><use xlink:href="#leaf" x="3"/>"##));
    assert_eq!(out.unwrap(), svg(r##"<defs><path id="leaf" d="M0 0L4 4"/></defs><use href="#leaf" x="3"/>"##));
}

#[test]
fn drops_harmless_unknown_things() {
    let body = format!(
        r#"<!-- コメント --><title>枠</title><style>.a{{fill:red}}</style><text x="1">字</text>{}"#,
        r#"<circle cx="64" cy="64" r="52" class="a" style="fill:red" data-x="1" stroke="gold"/>"#
    );
    let out = sanitize_frame_svg(&format!(r#"<?xml version="1.0"?>{}"#, svg(&body))).unwrap();
    assert_eq!(out, svg(r#"<circle cx="64" cy="64" r="52" stroke="gold"/>"#));
}

#[test]
fn escapes_values_when_writing() {
    let out = sanitize_frame_svg(&svg(r#"<circle r="3" id="a&amp;b&quot;"/>"#)).unwrap();
    assert_eq!(out, svg(r#"<circle r="3" id="a&amp;b&quot;"/>"#));
}

#[test]
fn rejects_broken_or_empty_documents() {
    assert_eq!(sanitize_frame_svg("<svg><circle r=\"3\"></svg>"), Err(SvgProblem::Malformed));
    assert_eq!(sanitize_frame_svg("<svg><circle r=3/></svg>"), Err(SvgProblem::Malformed));
    assert_eq!(sanitize_frame_svg(&svg(r#"<circle r="3" fill="&bogus;"/>"#)), Err(SvgProblem::Malformed));
    assert_eq!(sanitize_frame_svg(&svg("<g></g>")), Err(SvgProblem::Empty));
    // 根の前の DOCTYPE は取り出す範囲の外なので、書き直した結果に残らない
    let doctype = sanitize_frame_svg(&format!(r#"<!DOCTYPE svg [<!ENTITY x "y">]>{}"#, svg(RING)));
    assert_eq!(doctype, Ok(svg(RING)));
    assert!(matches!(sanitize_frame_svg(&svg(&format!("<!DOCTYPE x>{RING}"))), Err(SvgProblem::Forbidden(_))));
    assert!(matches!(sanitize_frame_svg(&svg(&format!("<![CDATA[x]]>{RING}"))), Err(SvgProblem::Forbidden(_))));
}

#[test]
fn rejects_documents_that_are_too_large_or_too_deep() {
    let many = RING.repeat(FRAME_SVG_MAX_BYTES / RING.len() + 10);
    assert_eq!(sanitize_frame_svg(&svg(&many)), Err(SvgProblem::TooLarge));
    let deep = format!("{}{RING}{}", "<g>".repeat(40), "</g>".repeat(40));
    assert_eq!(sanitize_frame_svg(&svg(&deep)), Err(SvgProblem::TooLarge));
}

#[test]
fn every_problem_has_a_message() {
    for problem in [
        SvgProblem::NotFound,
        SvgProblem::TooLarge,
        SvgProblem::Malformed,
        SvgProblem::Forbidden("script".to_owned()),
        SvgProblem::EventAttribute("onload".to_owned()),
        SvgProblem::ExternalReference,
        SvgProblem::Empty,
    ] {
        assert!(!problem.message().is_empty());
    }
}
