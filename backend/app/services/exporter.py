"""
Export service that parses Markdown content from pages and renders it into
properly formatted PDF (ReportLab), DOCX (python-docx), TXT, and MD documents.
"""
import io
import re
import html
from typing import List, Tuple

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

from docx import Document as DocxDocument
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn


# ---------------------------------------------------------------------------
# Helper: Parse Inline Markdown
# ---------------------------------------------------------------------------

def _strip_markdown_inline(text: str) -> str:
    """Removes inline markdown markers for plain text export."""
    # Bold / italic
    text = re.sub(r"\*\*\*(.*?)\*\*\*", r"\1", text)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"___(.*?)___", r"\1", text)
    text = re.sub(r"__(.*?)__", r"\1", text)
    text = re.sub(r"_(.*?)_", r"\1", text)
    # Inline code
    text = re.sub(r"`(.*?)`", r"\1", text)
    # Links: [text](url) -> text (url)
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1 (\2)", text)
    # Images: ![alt](url) -> [Image: alt]
    text = re.sub(r"!\[(.*?)\]\(.*?\)", r"[Image: \1]", text)
    return text.strip()


def _markdown_to_reportlab_xml(text: str) -> str:
    """
    Converts inline Markdown (bold, italic, code, links) to ReportLab XML tags.
    Carefully escapes XML entities first to prevent ReportLab XML parser crashes.
    """
    # First escape &, <, >
    escaped = html.escape(text)

    # Convert escaped back for our tag injection
    # Bold italic: ***text***
    escaped = re.sub(r"\*\*\*(.*?)\*\*\*", r"<b><i>\1</i></b>", escaped)
    # Bold: **text** or __text__
    escaped = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"__(.*?)__", r"<b>\1</b>", escaped)
    # Italic: *text* or _text_
    escaped = re.sub(r"\*(.*?)\*", r"<i>\1</i>", escaped)
    escaped = re.sub(r"(?<!\w)_(.*?)_(?!\w)", r"<i>\1</i>", escaped)
    # Inline code: `code`
    escaped = re.sub(
        r"`(.*?)`",
        r'<font name="Courier" color="#5a48d6" backcolor="#f4eee1">&nbsp;\1&nbsp;</font>',
        escaped
    )
    # Links: [label](url)
    escaped = re.sub(r"\[(.*?)\]\((.*?)\)", r'<font color="#5a48d6"><u>\1</u></font>', escaped)
    return escaped


def _add_docx_inline_formatted(paragraph, text: str):
    """
    Parses inline markdown (**bold**, *italic*, `code`) and appends
    corresponding styled runs to a python-docx paragraph.
    """
    # Regex to split on bold-italic, bold, italic, or code
    pattern = re.compile(r"(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|___.*?___|__.*?__|(?<!\w)_.*?_(?!\w)|`.*?`)")
    tokens = pattern.split(text)

    for token in tokens:
        if not token:
            continue
        if token.startswith("***") and token.endswith("***") and len(token) >= 6:
            content = token[3:-3]
            run = paragraph.add_run(content)
            run.bold = True
            run.italic = True
        elif token.startswith("**") and token.endswith("**") and len(token) >= 4:
            content = token[2:-2]
            run = paragraph.add_run(content)
            run.bold = True
        elif token.startswith("__") and token.endswith("__") and len(token) >= 4:
            content = token[2:-2]
            run = paragraph.add_run(content)
            run.bold = True
        elif token.startswith("*") and token.endswith("*") and len(token) >= 2:
            content = token[1:-1]
            run = paragraph.add_run(content)
            run.italic = True
        elif token.startswith("_") and token.endswith("_") and len(token) >= 2:
            content = token[1:-1]
            run = paragraph.add_run(content)
            run.italic = True
        elif token.startswith("`") and token.endswith("`") and len(token) >= 2:
            content = token[1:-1]
            run = paragraph.add_run(content)
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(90, 72, 214)
        else:
            paragraph.add_run(token)


# ---------------------------------------------------------------------------
# Structured Document Parser (AST)
# ---------------------------------------------------------------------------

class Block:
    pass

class HeadingBlock(Block):
    def __init__(self, level: int, text: str):
        self.level = level
        self.text = text

class ParagraphBlock(Block):
    def __init__(self, text: str):
        self.text = text

class BulletListBlock(Block):
    def __init__(self, items: List[str]):
        self.items = items

class NumberedListBlock(Block):
    def __init__(self, items: List[Tuple[str, str]]):  # [(num, text)]
        self.items = items

class TableBlock(Block):
    def __init__(self, headers: List[str], rows: List[List[str]]):
        self.headers = headers
        self.rows = rows

class CodeBlock(Block):
    def __init__(self, code: str, lang: str = ""):
        self.code = code
        self.lang = lang

class BlockquoteBlock(Block):
    def __init__(self, text: str):
        self.text = text

class DividerBlock(Block):
    pass

class PageBreakBlock(Block):
    def __init__(self, page_number: int):
        self.page_number = page_number


def parse_markdown_to_blocks(content: str) -> List[Block]:
    """Parses markdown lines into a list of structured Block objects."""
    blocks: List[Block] = []
    lines = content.split("\n")
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Empty line
        if not stripped:
            i += 1
            continue

        # Horizontal rule / divider
        if re.match(r"^(\-{3,}|\*{3,}|_{3,})$", stripped):
            blocks.append(DividerBlock())
            i += 1
            continue

        # Code block
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            code_lines = []
            i += 1
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < n:
                i += 1  # skip closing ```
            blocks.append(CodeBlock("\n".join(code_lines), lang))
            continue

        # Headings
        if stripped.startswith("#"):
            match = re.match(r"^(#{1,6})\s+(.*)$", stripped)
            if match:
                level = len(match.group(1))
                text = match.group(2).strip()
                blocks.append(HeadingBlock(level, text))
                i += 1
                continue

        # Table (| col1 | col2 |)
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_lines = []
            while i < n and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            if len(table_lines) >= 2:
                # Parse header and rows
                raw_header = [c.strip() for c in table_lines[0].strip("|").split("|")]
                # check if line 1 is separator |---|---|
                data_start = 1
                if len(table_lines) > 1 and re.match(r"^\|?\s*[-:]+[-| :]*\s*\|?$", table_lines[1]):
                    data_start = 2
                rows = []
                for tl in table_lines[data_start:]:
                    row_cells = [c.strip() for c in tl.strip("|").split("|")]
                    rows.append(row_cells)
                blocks.append(TableBlock(raw_header, rows))
                continue

        # Bullet list item (- , * , + )
        if re.match(r"^[-*+]\s+", stripped):
            items = []
            while i < n and re.match(r"^[-*+]\s+", lines[i].strip()):
                item_text = re.sub(r"^[-*+]\s+", "", lines[i].strip())
                items.append(item_text)
                i += 1
            blocks.append(BulletListBlock(items))
            continue

        # Numbered list item (1. , 2) )
        if re.match(r"^\d+[\.\)]\s+", stripped):
            items = []
            while i < n and re.match(r"^(\d+)[\.\)]\s+(.*)$", lines[i].strip()):
                m = re.match(r"^(\d+)[\.\)]\s+(.*)$", lines[i].strip())
                if m:
                    items.append((m.group(1), m.group(2)))
                i += 1
            blocks.append(NumberedListBlock(items))
            continue

        # Blockquote (> )
        if stripped.startswith(">"):
            quote_lines = []
            while i < n and lines[i].strip().startswith(">"):
                quote_lines.append(re.sub(r"^>\s?", "", lines[i].strip()))
                i += 1
            blocks.append(BlockquoteBlock(" ".join(quote_lines)))
            continue

        # Regular paragraph
        para_lines = [stripped]
        i += 1
        while i < n and lines[i].strip() and not lines[i].strip().startswith(("#", "-", "*", "+", ">", "|", "```")) and not re.match(r"^\d+[\.\)]\s+", lines[i].strip()):
            para_lines.append(lines[i].strip())
            i += 1
        blocks.append(ParagraphBlock(" ".join(para_lines)))

    return blocks


# ---------------------------------------------------------------------------
# PDF Numbered Canvas for Footer
# ---------------------------------------------------------------------------

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#7c85ad"))
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 54, 36, footer_text)
        self.drawString(54, 36, "Generated with Scriptly • Handwriting to Digital Notes")
        # Line above footer
        self.setStrokeColor(colors.HexColor("#e9e0cc"))
        self.setLineWidth(0.5)
        self.line(54, 48, A4[0] - 54, 48)
        self.restoreState()


# ---------------------------------------------------------------------------
# Exporters
# ---------------------------------------------------------------------------

def export_to_pdf(title: str, pages_content: List[Tuple[int, str]]) -> io.BytesIO:
    """Generates a polished, professional PDF document from digital notes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=60,
    )

    # Styles
    sample = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=sample["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#141722"),
        alignment=0,
        spaceAfter=14,
    )

    h1_style = ParagraphStyle(
        "DocH1",
        parent=sample["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#5a48d6"),
        spaceBefore=16,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "DocH2",
        parent=sample["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#2b3049"),
        spaceBefore=12,
        spaceAfter=4,
        keepWithNext=True,
    )

    h3_style = ParagraphStyle(
        "DocH3",
        parent=sample["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#b87a24"),
        spaceBefore=10,
        spaceAfter=3,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "DocBody",
        parent=sample["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor("#1a1e2c"),
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "DocBullet",
        parent=sample["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor("#1a1e2c"),
        leftIndent=16,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    numbered_style = ParagraphStyle(
        "DocNumbered",
        parent=sample["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor("#1a1e2c"),
        leftIndent=18,
        firstLineIndent=-12,
        spaceAfter=4,
    )

    quote_style = ParagraphStyle(
        "DocQuote",
        parent=sample["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#3a4066"),
        leftIndent=18,
        rightIndent=18,
        spaceBefore=6,
        spaceAfter=6,
    )

    code_style = ParagraphStyle(
        "DocCode",
        parent=sample["Normal"],
        fontName="Courier",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#141722"),
        leftIndent=12,
        rightIndent=12,
        spaceBefore=4,
        spaceAfter=4,
    )

    page_header_style = ParagraphStyle(
        "PageHeader",
        parent=sample["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#7c85ad"),
        spaceAfter=8,
    )

    story = []

    # Document Header Title
    story.append(Paragraph(html.escape(title), title_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#5a48d6"), spaceBefore=0, spaceAfter=14))

    for page_idx, (page_num, page_content) in enumerate(pages_content):
        if not page_content or not page_content.strip():
            continue

        # If multi-page, add page banner / separator
        if len(pages_content) > 1:
            if page_idx > 0:
                story.append(Spacer(1, 14))
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e9e0cc"), spaceBefore=8, spaceAfter=12))
            story.append(Paragraph(f"PAGE {page_num}", page_header_style))

        blocks = parse_markdown_to_blocks(page_content)

        for block in blocks:
            if isinstance(block, HeadingBlock):
                style = h1_style if block.level == 1 else (h2_style if block.level == 2 else h3_style)
                story.append(Paragraph(_markdown_to_reportlab_xml(block.text), style))

            elif isinstance(block, ParagraphBlock):
                story.append(Paragraph(_markdown_to_reportlab_xml(block.text), body_style))

            elif isinstance(block, BulletListBlock):
                for item in block.items:
                    formatted_item = f"&bull;&nbsp;&nbsp;{_markdown_to_reportlab_xml(item)}"
                    story.append(Paragraph(formatted_item, bullet_style))
                story.append(Spacer(1, 3))

            elif isinstance(block, NumberedListBlock):
                for num, item in block.items:
                    formatted_item = f"<b>{num}.</b>&nbsp;&nbsp;{_markdown_to_reportlab_xml(item)}"
                    story.append(Paragraph(formatted_item, numbered_style))
                story.append(Spacer(1, 3))

            elif isinstance(block, BlockquoteBlock):
                story.append(Paragraph(_markdown_to_reportlab_xml(block.text), quote_style))

            elif isinstance(block, CodeBlock):
                escaped_code = html.escape(block.code).replace("\n", "<br/>").replace(" ", "&nbsp;")
                story.append(Paragraph(escaped_code, code_style))

            elif isinstance(block, TableBlock):
                table_data = []
                # Header row
                table_data.append([Paragraph(_markdown_to_reportlab_xml(h), body_style) for h in block.headers])
                # Data rows
                for row in block.rows:
                    row_cells = []
                    for c in row:
                        row_cells.append(Paragraph(_markdown_to_reportlab_xml(c), body_style))
                    # Ensure matching column count
                    while len(row_cells) < len(block.headers):
                        row_cells.append(Paragraph("", body_style))
                    table_data.append(row_cells[:len(block.headers)])

                if table_data:
                    col_width = (A4[0] - 108) / max(1, len(block.headers))
                    t = Table(table_data, colWidths=[col_width] * len(block.headers))
                    t.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4eee1")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#141722")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 9.5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c3c8de")),
                    ]))
                    story.append(Spacer(1, 4))
                    story.append(t)
                    story.append(Spacer(1, 6))

            elif isinstance(block, DividerBlock):
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#c3c8de"), spaceBefore=8, spaceAfter=8))

    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf


def export_to_docx(title: str, pages_content: List[Tuple[int, str]]) -> io.BytesIO:
    """Generates a rich, styled Word DOCX document with native styles and inline runs."""
    doc = DocxDocument()

    # Document Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(title)
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(20, 23, 34)
    title_p.paragraph_format.space_after = Pt(14)

    for page_idx, (page_num, page_content) in enumerate(pages_content):
        if not page_content or not page_content.strip():
            continue

        if len(pages_content) > 1:
            if page_idx > 0:
                doc.add_page_break()
            p_header = doc.add_paragraph()
            p_run = p_header.add_run(f"Page {page_num}")
            p_run.font.size = Pt(10)
            p_run.font.bold = True
            p_run.font.color.rgb = RGBColor(124, 133, 173)
            p_header.paragraph_format.space_after = Pt(6)

        blocks = parse_markdown_to_blocks(page_content)

        for block in blocks:
            if isinstance(block, HeadingBlock):
                h = doc.add_heading(level=min(3, block.level))
                _add_docx_inline_formatted(h, block.text)
                h.paragraph_format.space_before = Pt(12)
                h.paragraph_format.space_after = Pt(4)

            elif isinstance(block, ParagraphBlock):
                p = doc.add_paragraph()
                _add_docx_inline_formatted(p, block.text)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.line_spacing = 1.15

            elif isinstance(block, BulletListBlock):
                for item in block.items:
                    bp = doc.add_paragraph(style="List Bullet")
                    _add_docx_inline_formatted(bp, item)
                    bp.paragraph_format.space_after = Pt(3)

            elif isinstance(block, NumberedListBlock):
                for num, item in block.items:
                    np = doc.add_paragraph(style="List Number")
                    _add_docx_inline_formatted(np, item)
                    np.paragraph_format.space_after = Pt(3)

            elif isinstance(block, BlockquoteBlock):
                qp = doc.add_paragraph()
                qp.paragraph_format.left_indent = Inches(0.4)
                qp.paragraph_format.space_before = Pt(4)
                qp.paragraph_format.space_after = Pt(6)
                _add_docx_inline_formatted(qp, block.text)
                for run in qp.runs:
                    run.italic = True
                    run.font.color.rgb = RGBColor(70, 75, 100)

            elif isinstance(block, CodeBlock):
                cp = doc.add_paragraph()
                cp.paragraph_format.left_indent = Inches(0.3)
                cp.paragraph_format.space_before = Pt(4)
                cp.paragraph_format.space_after = Pt(6)
                c_run = cp.add_run(block.code)
                c_run.font.name = "Consolas"
                c_run.font.size = Pt(9.5)
                c_run.font.color.rgb = RGBColor(20, 23, 34)

            elif isinstance(block, TableBlock):
                if block.headers:
                    cols_count = len(block.headers)
                    rows_count = len(block.rows) + 1
                    t = doc.add_table(rows=rows_count, cols=cols_count)
                    t.alignment = WD_TABLE_ALIGNMENT.CENTER
                    t.autofit = True

                    # Header
                    hdr_cells = t.rows[0].cells
                    for ci, h in enumerate(block.headers):
                        hdr_cells[ci].text = _strip_markdown_inline(h)
                        for r in hdr_cells[ci].paragraphs[0].runs:
                            r.bold = True
                            r.font.size = Pt(10)

                    # Data
                    for ri, row in enumerate(block.rows):
                        row_cells = t.rows[ri + 1].cells
                        for ci, c in enumerate(row[:cols_count]):
                            row_cells[ci].text = _strip_markdown_inline(c)
                            for r in row_cells[ci].paragraphs[0].runs:
                                r.font.size = Pt(9.5)

                    doc.add_paragraph().paragraph_format.space_after = Pt(6)

            elif isinstance(block, DividerBlock):
                dp = doc.add_paragraph()
                dp_run = dp.add_run("―" * 40)
                dp_run.font.color.rgb = RGBColor(195, 200, 222)
                dp.paragraph_format.space_before = Pt(6)
                dp.paragraph_format.space_after = Pt(6)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def export_to_txt(title: str, pages_content: List[Tuple[int, str]]) -> io.BytesIO:
    """Generates clean, readable plain text with neat headings, bullet symbols, and layout."""
    lines = []
    lines.append("=" * len(title))
    lines.append(title.upper())
    lines.append("=" * len(title))
    lines.append("")

    for page_idx, (page_num, page_content) in enumerate(pages_content):
        if not page_content or not page_content.strip():
            continue

        if len(pages_content) > 1:
            lines.append(f"--- [ PAGE {page_num} ] ---")
            lines.append("")

        blocks = parse_markdown_to_blocks(page_content)

        for block in blocks:
            if isinstance(block, HeadingBlock):
                clean_text = _strip_markdown_inline(block.text)
                if block.level == 1:
                    lines.append(clean_text.upper())
                    lines.append("=" * len(clean_text))
                elif block.level == 2:
                    lines.append(clean_text)
                    lines.append("-" * len(clean_text))
                else:
                    lines.append(f"• {clean_text}")
                lines.append("")

            elif isinstance(block, ParagraphBlock):
                lines.append(_strip_markdown_inline(block.text))
                lines.append("")

            elif isinstance(block, BulletListBlock):
                for item in block.items:
                    lines.append(f"  • {_strip_markdown_inline(item)}")
                lines.append("")

            elif isinstance(block, NumberedListBlock):
                for num, item in block.items:
                    lines.append(f"  {num}. {_strip_markdown_inline(item)}")
                lines.append("")

            elif isinstance(block, BlockquoteBlock):
                lines.append(f"  | {_strip_markdown_inline(block.text)}")
                lines.append("")

            elif isinstance(block, CodeBlock):
                lines.append("  [CODE]")
                for cl in block.code.split("\n"):
                    lines.append(f"    {cl}")
                lines.append("  [/CODE]")
                lines.append("")

            elif isinstance(block, TableBlock):
                clean_headers = [_strip_markdown_inline(h) for h in block.headers]
                clean_rows = [[_strip_markdown_inline(c) for c in row] for row in block.rows]

                # calculate col widths
                col_widths = [len(h) for h in clean_headers]
                for r in clean_rows:
                    for ci, c in enumerate(r):
                        if ci < len(col_widths):
                            col_widths[ci] = max(col_widths[ci], len(c))

                # format header
                hdr_str = " | ".join(h.ljust(col_widths[ci]) for ci, h in enumerate(clean_headers))
                sep_str = "-+-".join("-" * col_widths[ci] for ci in range(len(col_widths)))
                lines.append(hdr_str)
                lines.append(sep_str)
                for r in clean_rows:
                    row_str = " | ".join(
                        (r[ci] if ci < len(r) else "").ljust(col_widths[ci]) for ci in range(len(col_widths))
                    )
                    lines.append(row_str)
                lines.append("")

            elif isinstance(block, DividerBlock):
                lines.append("-" * 40)
                lines.append("")

    content = "\n".join(lines)
    buf = io.BytesIO(content.encode("utf-8"))
    return buf


def export_to_md(title: str, pages_content: List[Tuple[int, str]]) -> io.BytesIO:
    """Generates standard GitHub flavored Markdown."""
    sections = [f"# {title}\n"]
    for page_num, page_content in pages_content:
        if page_content and page_content.strip():
            if len(pages_content) > 1:
                sections.append(f"## Page {page_num}\n\n{page_content.strip()}")
            else:
                sections.append(page_content.strip())
    full_md = "\n\n---\n\n".join(sections)
    buf = io.BytesIO(full_md.encode("utf-8"))
    return buf
