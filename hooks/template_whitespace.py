"""Format rendered pages at two spaces per nesting level."""

from __future__ import annotations

import html
from html.parser import HTMLParser
from typing import Any

_HEAD_CHILD = "    "
_HEAD_NESTED = "      "
_VOID_TAGS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "track",
        "wbr",
    }
)
_RAW_TAGS = frozenset({"pre", "script", "style", "textarea"})
_BREAK_TAGS = frozenset(
    {
        "article",
        "aside",
        "blockquote",
        "body",
        "details",
        "div",
        "dl",
        "fieldset",
        "figcaption",
        "figure",
        "footer",
        "form",
        "head",
        "header",
        "html",
        "li",
        "main",
        "nav",
        "ol",
        "section",
        "table",
        "tbody",
        "td",
        "tfoot",
        "th",
        "thead",
        "tr",
        "ul",
    }
)


def on_env(env: Any, *, config: Any, files: Any) -> Any:
    """Enable Jinja whitespace trimming for the theme templates."""
    del config, files
    env.trim_blocks = True
    env.lstrip_blocks = True
    return env


def on_post_page(output: str, *, page: Any, config: Any) -> str:
    """Indent html children and every head element by two spaces."""
    del page, config
    return normalize_document_indent(output)


def normalize_document_indent(html: str) -> str:
    """Indent the document at two spaces per level, then tidy the head."""
    newline = "\r\n" if "\r\n" in html else "\n"
    formatted = _format_document(html)
    lines = formatted.splitlines()
    try:
        head_open = next(index for index, line in enumerate(lines) if line.strip() == "<head>")
        head_close = next(index for index, line in enumerate(lines) if line.strip() == "</head>")
    except StopIteration:
        return formatted
    if head_close < head_open:
        return html

    rewritten = lines[:head_open]
    rewritten.append("  <head>")
    rewritten.extend(_indent_head(_reorder_head(lines[head_open + 1 : head_close])))
    rewritten.append("  </head>")
    rest = lines[head_close + 1 :]
    for index, line in enumerate(rest):
        if line.lstrip().startswith("<body"):
            rest[index] = "  " + line.lstrip()
            break
    rewritten.extend(rest)
    trailing = "\n" if html.endswith(("\n", "\r\n")) else ""
    return newline.join(rewritten) + trailing


class _DocumentTree(HTMLParser):
    """Build a small tree without decoding the text the browser will see."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.root: dict[str, Any] = {"tag": "", "children": []}
        self.stack: list[dict[str, Any]] = [self.root]
        self.literal_tag = ""
        self.literal_depth = 0

    def handle_decl(self, decl: str) -> None:
        if self.literal_tag:
            self.stack[-1]["raw"] += f"<!{decl}>"
            return
        self.stack[-1]["children"].append({"decl": decl})

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.literal_tag:
            self.stack[-1]["raw"] += self.get_starttag_text()
            if tag == self.literal_tag:
                self.literal_depth += 1
            return
        node: dict[str, Any] = {"tag": tag, "attrs": attrs, "children": []}
        self.stack[-1]["children"].append(node)
        if tag in _VOID_TAGS:
            node["void"] = True
            return
        if tag in {"pre", "textarea"}:
            node["raw"] = ""
            self.stack.append(node)
            self.literal_tag = tag
            self.literal_depth = 1
            return
        if tag in _RAW_TAGS:
            node["raw"] = ""
        self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.literal_tag:
            self.stack[-1]["raw"] += self.get_starttag_text()
            return
        self.stack[-1]["children"].append({"tag": tag, "attrs": attrs, "children": [], "void": True})

    def handle_endtag(self, tag: str) -> None:
        if self.literal_tag:
            if tag == self.literal_tag:
                self.literal_depth -= 1
                if self.literal_depth == 0:
                    self.literal_tag = ""
                    self.stack.pop()
                    return
            self.stack[-1]["raw"] += f"</{tag}>"
            return
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].get("tag") == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self._add_text(data)

    def handle_entityref(self, name: str) -> None:
        self._add_text(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._add_text(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        if self.literal_tag:
            self.stack[-1]["raw"] += f"<!--{data}-->"
            return
        self.stack[-1]["children"].append({"comment": data})

    def _add_text(self, data: str) -> None:
        node = self.stack[-1]
        if "raw" in node:
            node["raw"] += data
            return
        children = node["children"]
        if children and "text" in children[-1]:
            children[-1]["text"] += data
        else:
            children.append({"text": data})


def _format_document(source: str) -> str:
    """Reprint source with two spaces for each nesting level."""
    parser = _DocumentTree()
    parser.feed(source)
    parser.close()
    lines = _render_nodes(parser.root["children"], 0)
    trailing = "\n" if source.endswith(("\n", "\r\n")) or lines else ""
    return "\n".join(lines) + trailing


def _render_nodes(nodes: list[dict[str, Any]], indent: int) -> list[str]:
    """Render sibling nodes at one indent."""
    lines: list[str] = []
    for node in nodes:
        lines.extend(_render_node(node, indent))
    return lines


def _render_node(node: dict[str, Any], indent: int) -> list[str]:
    """Render one declaration, comment, text node, or element."""
    pad = "  " * indent
    if "decl" in node:
        decl = str(node["decl"])
        if decl.lower().startswith("doctype"):
            decl = "doctype html"
        return [f"<!{decl}>"]
    if "comment" in node:
        return [f"{pad}<!--{node['comment']}-->"]
    if "text" in node:
        text = _normalize_text(str(node["text"])).strip()
        if not text:
            return []
        return [f"{pad}{text}"]
    tag = str(node["tag"])
    opening = f"<{tag}{_format_attrs(node.get('attrs') or [])}>"
    if node.get("void"):
        if tag not in _VOID_TAGS:
            opening = opening[:-1] + " />"
        return [f"{pad}{opening}"]
    if "raw" in node:
        raw = str(node["raw"])
        if raw == "":
            return [f"{pad}{opening}</{tag}>"]
        if "\n" not in raw:
            return [f"{pad}{opening}{raw}</{tag}>"]
        return [f"{pad}{opening}", raw, f"{pad}</{tag}>"]
    children = _visible_children(node.get("children") or [])
    if not children:
        return [f"{pad}{opening}</{tag}>"]
    if tag not in _BREAK_TAGS and _fits_on_one_line(children):
        return [f"{pad}{opening}{_inline_children(children)}</{tag}>"]
    lines = [f"{pad}{opening}"]
    lines.extend(_render_nodes(children, indent + 1))
    lines.append(f"{pad}</{tag}>")
    return lines


def _visible_children(children: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop text nodes that are only indentation from the previous source."""
    visible: list[dict[str, Any]] = []
    for child in children:
        if "text" in child and not _normalize_text(str(child["text"])):
            continue
        visible.append(child)
    return visible


def _fits_on_one_line(children: list[dict[str, Any]]) -> bool:
    """A tag stays on one line when it holds only text, comments, or void tags."""
    for child in children:
        if "text" in child or "comment" in child:
            continue
        if child.get("void"):
            continue
        return False
    return True


def _inline_children(children: list[dict[str, Any]]) -> str:
    """Join one-line children without adding a space the source did not have."""
    parts: list[str] = []
    for child in children:
        if "text" in child:
            parts.append(_normalize_text(str(child["text"])))
            continue
        if "comment" in child:
            parts.append(f"<!--{child['comment']}-->")
            continue
        rendered = _render_node(child, 0)
        parts.append(rendered[0] if rendered else "")
    return "".join(parts).strip()


def _normalize_text(data: str) -> str:
    """Collapse source indentation while keeping one edge space beside inline tags."""
    if not data.strip():
        return ""
    collapsed = " ".join(data.split())
    if data[:1].isspace():
        collapsed = f" {collapsed}"
    if data[-1:].isspace():
        collapsed = f"{collapsed} "
    return collapsed


def _format_attrs(attrs: list[tuple[str, str | None]]) -> str:
    """Render attributes in their original order."""
    if not attrs:
        return ""
    return " " + " ".join(_format_attr(name, value) for name, value in attrs)


def _format_attr(name: str, value: str | None) -> str:
    """Render one attribute, using single quotes when the value contains double quotes."""
    if value is None:
        return name
    if '"' in value and "'" not in value:
        return f"{name}='{value}'"
    return f'{name}="{html.escape(value, quote=True)}"'


def _reorder_head(lines: list[str]) -> list[str]:
    """Put metadata first, then stylesheets, then scripts."""
    elements = [element for element in _head_elements(lines) if not _is_generator_meta(element)]
    grouped: dict[str, list[list[str]]] = {"meta": [], "style": [], "script": []}
    for element in elements:
        grouped[_head_bucket(element)].append(element)
    ordered = grouped["meta"] + grouped["style"] + grouped["script"]
    return _with_section_gaps(ordered)


def _with_section_gaps(elements: list[list[str]]) -> list[str]:
    """Separate canonical, title, Open Graph, the last meta tag, and stylesheets."""
    last_meta = _last_index(elements, _is_meta_tag)
    last_style = _last_index(elements, lambda element: _head_bucket(element) == "style")
    first_open_graph = _first_index(elements, _is_open_graph)
    last_open_graph = _last_index(elements, _is_open_graph)
    canonical = _first_index(elements, _is_canonical)
    title = _first_index(elements, _is_title)
    gap_before = {first_open_graph, canonical, title} - {None}
    gap_after = {last_meta, last_style, last_open_graph, title} - {None}
    lines: list[str] = []
    for index, element in enumerate(elements):
        if index in gap_before and (index == 0 or index - 1 not in gap_after):
            lines.append("")
        lines.extend(element)
        if index in gap_after:
            lines.append("")
    return lines


def _first_index(elements: list[list[str]], match: Any) -> int | None:
    """Index of the first element that matches, if any."""
    for index, element in enumerate(elements):
        if match(element):
            return index
    return None


def _last_index(elements: list[list[str]], match: Any) -> int | None:
    """Index of the last element that matches, if any."""
    found = None
    for index, element in enumerate(elements):
        if match(element):
            found = index
    return found


def _element_tag(element: list[str]) -> str:
    """Opening line of an element, skipping a leading comment."""
    return next((line for line in element if not line.startswith("<!--")), "")


def _is_meta_tag(element: list[str]) -> bool:
    """True when the element is a meta tag."""
    return _element_tag(element).lower().startswith("<meta")


def _is_canonical(element: list[str]) -> bool:
    """True when the element is the canonical link."""
    tag = _element_tag(element).lower()
    return tag.startswith("<link") and ('rel="canonical"' in tag or "rel='canonical'" in tag)


def _is_title(element: list[str]) -> bool:
    """True when the element is the document title."""
    return _element_tag(element).lower().startswith("<title")


def _is_open_graph(element: list[str]) -> bool:
    """True when the element is an Open Graph meta tag."""
    tag = _element_tag(element).lower()
    return tag.startswith("<meta") and ('property="og:' in tag or "property='og:" in tag)


def _head_elements(lines: list[str]) -> list[list[str]]:
    """Group head lines into elements, keeping comments with the next tag."""
    elements: list[list[str]] = []
    current: list[str] = []
    comments: list[str] = []
    in_tag = False
    raw_tag = ""
    in_comment = False

    def flush() -> None:
        nonlocal current
        if current:
            elements.append(comments + current)
            comments.clear()
            current = []

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if in_comment:
            current.append(line)
            if "-->" in line:
                in_comment = False
                comments.extend(current)
                current = []
            continue
        if raw_tag:
            current.append(line)
            if line.startswith(f"</{raw_tag}"):
                raw_tag = ""
                flush()
            continue
        if in_tag:
            current.append(line)
            if line.startswith(">") or line == "/>" or line.endswith(">"):
                in_tag = False
                flush()
            continue
        if line.startswith("<!--"):
            if "-->" in line:
                comments.append(line)
            else:
                current = [line]
                in_comment = True
            continue
        current = [line]
        if _starts_raw_block(line):
            raw_tag = "script" if line.startswith("<script") else "style"
            continue
        if line.startswith("<") and not line.endswith(">"):
            in_tag = True
            continue
        flush()
    if current:
        elements.append(comments + current)
    elif comments and elements:
        elements[-1].extend(comments)
    elif comments:
        elements.append(comments)
    return elements


def _is_generator_meta(element: list[str]) -> bool:
    """The theme advertises MkDocs in a generator meta tag. Drop it."""
    tag = next((line for line in element if not line.startswith("<!--")), "")
    return tag.lower().startswith("<meta") and 'name="generator"' in tag.lower()


def _head_bucket(element: list[str]) -> str:
    """Classify one head element as metadata, a stylesheet, or a script."""
    tag = next((line for line in element if not line.startswith("<!--")), "")
    blob = " ".join(element).lower()
    if tag.startswith("<script") or tag.startswith("<noscript"):
        return "script"
    if tag.startswith("<style"):
        return "style"
    if tag.startswith("<link"):
        if "modulepreload" in blob or ("preload" in blob and 'as="script"' in blob):
            return "script"
        if "stylesheet" in blob or "preconnect" in blob or "preload" in blob:
            return "style"
    return "meta"


def _indent_head(lines: list[str]) -> list[str]:
    """Indent each head element by four spaces, and wrapped attributes by six."""
    indented: list[str] = []
    in_tag = False
    raw_tag = ""
    for raw in lines:
        line = raw.strip()
        if not line:
            indented.append("")
            continue
        if raw_tag:
            indented.append(_HEAD_CHILD + line)
            if line.startswith(f"</{raw_tag}"):
                raw_tag = ""
            continue
        if in_tag and (line.startswith(">") or line == "/>"):
            indented.append(_HEAD_CHILD + line)
            in_tag = False
            continue
        if in_tag and not line.startswith("<"):
            indented.append(_HEAD_NESTED + line)
            if line.endswith(">"):
                in_tag = False
            continue
        indented.append(_HEAD_CHILD + line)
        if _starts_raw_block(line):
            raw_tag = "script" if line.startswith("<script") else "style"
            in_tag = False
            continue
        if line.startswith("<") and not line.endswith(">") and not line.endswith("-->"):
            in_tag = True
    return indented


def _starts_raw_block(line: str) -> bool:
    """A script or style element whose closing tag is on a later line."""
    if line.startswith("<script") and "</script>" not in line and line.endswith(">"):
        return True
    return line.startswith("<style") and "</style>" not in line and line.endswith(">")
