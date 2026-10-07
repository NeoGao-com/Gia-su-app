import io
import logging
import os
import re
import tempfile
from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
import latex2mathml.converter
from lxml import etree
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
import requests

logger = logging.getLogger(__name__)

# Register Vietnamese TrueType fonts for ReportLab
_font_registered = False
_primary_font = "Helvetica"
_primary_font_bold = "Helvetica-Bold"

def format_exam_id(exam_id) -> str:
    """Safely format exam id as 3-digit padded number or string fallback."""
    if exam_id is None:
        return "001"
    try:
        return f"{int(exam_id):03d}"
    except (ValueError, TypeError):
        return str(exam_id)


def format_correct_option(val) -> Optional[str]:
    """Safely format correct_option regardless of whether it is int, numeric string, or letter."""
    if val is None:
        return None
    if isinstance(val, int):
        if 0 <= val <= 25:
            return chr(65 + val)
        return str(val)
    val_str = str(val).strip()
    if not val_str:
        return None
    if val_str.isdigit():
        num = int(val_str)
        if 0 <= num <= 25:
            return chr(65 + num)
        return val_str
    upper = val_str.upper()
    if len(upper) == 1 and 'A' <= upper <= 'Z':
        return upper
    return val_str[:12]


def format_sub_questions_answers(sub_questions: list) -> str:
    """Format TRUE_FALSE sub-questions into a) Đ | b) S."""
    if not sub_questions or not isinstance(sub_questions, list):
        return ""
    parts = []
    for s_i, sq in enumerate(sub_questions):
        letter = chr(97 + s_i)
        is_true = False
        if isinstance(sq, dict):
            if 'correct' in sq:
                is_true = bool(sq['correct'])
            elif 'answer' in sq:
                ans = sq['answer']
                is_true = ans is True or str(ans).lower() in ('true', 'đúng', 'dung', '1', 't')
        elif isinstance(sq, (bool, int)):
            is_true = bool(sq)
        parts.append(f"{letter}) {'Đ' if is_true else 'S'}")
    return " | ".join(parts)


def format_sub_questions_short(sub_questions: list) -> str:
    """Format TRUE_FALSE sub-questions into compact table text like Đ-S-Đ-S."""
    if not sub_questions or not isinstance(sub_questions, list):
        return "—"
    parts = []
    for sq in sub_questions:
        is_true = False
        if isinstance(sq, dict):
            if 'correct' in sq:
                is_true = bool(sq['correct'])
            elif 'answer' in sq:
                ans = sq['answer']
                is_true = ans is True or str(ans).lower() in ('true', 'đúng', 'dung', '1', 't')
        elif isinstance(sq, (bool, int)):
            is_true = bool(sq)
        parts.append('Đ' if is_true else 'S')
    return "-".join(parts) if parts else "—"


def register_vietnamese_pdf_fonts():
    global _font_registered, _primary_font, _primary_font_bold
    if _font_registered:
        return _primary_font, _primary_font_bold

    mpl_fonts = []
    try:
        import matplotlib
        mpl_dir = os.path.join(matplotlib.get_data_path(), 'fonts', 'ttf')
        dv_reg = os.path.join(mpl_dir, 'DejaVuSans.ttf')
        dv_bold = os.path.join(mpl_dir, 'DejaVuSans-Bold.ttf')
        dv_italic = os.path.join(mpl_dir, 'DejaVuSans-Oblique.ttf')
        if os.path.exists(dv_reg):
            mpl_fonts.append(("DejaVuSans", dv_reg, dv_bold, dv_italic))
    except Exception:
        pass

    font_candidates = [
        ("Arial", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/ariali.ttf"),
        ("Times", "C:/Windows/Fonts/times.ttf", "C:/Windows/Fonts/timesbd.ttf", "C:/Windows/Fonts/timesi.ttf"),
    ] + mpl_fonts + [
        ("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", None),
        ("DejaVuLinux", "/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf", None),
        ("Liberation", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", None),
    ]

    for name, reg, bold, italic in font_candidates:
        if os.path.exists(reg):
            try:
                pdfmetrics.registerFont(TTFont(name, reg))
                if bold and os.path.exists(bold):
                    pdfmetrics.registerFont(TTFont(f"{name}-Bold", bold))
                else:
                    pdfmetrics.registerFont(TTFont(f"{name}-Bold", reg))

                if italic and os.path.exists(italic):
                    pdfmetrics.registerFont(TTFont(f"{name}-Italic", italic))

                _primary_font = name
                _primary_font_bold = f"{name}-Bold"
                _font_registered = True
                logger.info(f"Registered Vietnamese font '{name}' for ReportLab PDF export")
                return _primary_font, _primary_font_bold
            except Exception as e:
                logger.warning(f"Failed to register font {name}: {e}")

    _font_registered = True
    return _primary_font, _primary_font_bold


class Exporter:
    def __init__(self):
        register_vietnamese_pdf_fonts()

    def latex_to_omml(self, latex_str: str) -> str:
        """
        Converts LaTeX string to OMML (Office Math Markup Language) via MathML.
        If conversion fails, returns None.
        """
        try:
            clean_latex = latex_str.strip()
            if clean_latex.startswith("$$") and clean_latex.endswith("$$"):
                clean_latex = clean_latex[2:-2].strip()
            elif clean_latex.startswith("$") and clean_latex.endswith("$"):
                clean_latex = clean_latex[1:-1].strip()

            mathml = latex2mathml.converter.convert(clean_latex)

            xslt_content = '''<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:mml="http://www.w3.org/1998/Math/MathML">
                <xsl:output method="xml" encoding="utf-8"/>
                <xsl:template match="mml:math">
                    <m:oMathPr/>
                    <m:oMath>
                        <xsl:apply-templates/>
                    </m:oMath>
                </xsl:template>
                <xsl:template match="mml:mrow">
                    <xsl:apply-templates/>
                </xsl:template>
                <xsl:template match="mml:mi">
                    <m:r><m:t><xsl:value-of select="."/></m:t></m:r>
                </xsl:template>
                <xsl:template match="mml:mn">
                    <m:r><m:t><xsl:value-of select="."/></m:t></m:r>
                </xsl:template>
                <xsl:template match="mml:mo">
                    <m:r><m:t><xsl:value-of select="."/></m:t></m:r>
                </xsl:template>
                <xsl:template match="mml:mfrac">
                    <m:frac>
                        <m:num><xsl:apply-templates select="*[1]"/></m:num>
                        <m:den><xsl:apply-templates select="*[2]"/></m:den>
                    </m:frac>
                </xsl:template>
                <xsl:template match="mml:msup">
                    <m:sup>
                        <m:e><xsl:apply-templates select="*[1]"/></m:e>
                        <m:sup><xsl:apply-templates select="*[2]"/></m:sup>
                    </m:sup>
                </xsl:template>
                <xsl:template match="mml:msub">
                    <m:sub>
                        <m:e><xsl:apply-templates select="*[1]"/></m:e>
                        <m:sub><xsl:apply-templates select="*[2]"/></m:sub>
                    </m:sub>
                </xsl:template>
                <xsl:template match="mml:msqrt">
                    <m:rad>
                        <m:deg/>
                        <m:e><xsl:apply-templates/></m:e>
                    </m:rad>
                </xsl:template>
            </xsl:stylesheet>'''

            dom = etree.fromstring(mathml.encode('utf-8'))
            xslt = etree.fromstring(xslt_content.encode('utf-8'))
            transform = etree.XSLT(xslt)
            new_dom = transform(dom)
            return str(new_dom)
        except Exception:
            return None

    def add_text_with_latex(self, paragraph, text: str, font_name: str = "Times New Roman", font_size_pt: float = 12):
        if not text:
            return
        pattern = r'(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)'
        tokens = re.split(pattern, str(text))
        for token in tokens:
            if not token:
                continue
            if (token.startswith('$$') and token.endswith('$$')) or (token.startswith('$') and token.endswith('$')):
                omml = self.latex_to_omml(token)
                if omml:
                    try:
                        math_element = parse_xml(omml)
                        paragraph._p.append(math_element)
                        continue
                    except Exception:
                        pass
                run = paragraph.add_run(token)
                run.font.name = font_name
                run.font.size = Pt(font_size_pt)
                run.italic = True
            else:
                run = paragraph.add_run(token)
                run.font.name = font_name
                run.font.size = Pt(font_size_pt)

    def _embed_image_in_docx(self, doc, q):
        img_path = getattr(q, 'image_url', None)
        if not img_path and getattr(q, 'media', None) and isinstance(q.media, dict):
            img_path = q.media.get("image_url") or q.media.get("url")

        if not img_path:
            return

        try:
            if str(img_path).startswith("http"):
                res = requests.get(img_path, timeout=5)
                if res.status_code == 200:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_img:
                        temp_img.write(res.content)
                        temp_name = temp_img.name
                    doc.add_picture(temp_name, width=Inches(3.2))
                    os.unlink(temp_name)
            else:
                local_path = str(img_path).lstrip("/")
                if os.path.exists(local_path):
                    doc.add_picture(local_path, width=Inches(3.2))
                elif os.path.exists(str(img_path)):
                    doc.add_picture(str(img_path), width=Inches(3.2))
        except Exception as e:
            logger.warning(f"Failed to embed image {img_path} in DOCX: {e}")

    def _embed_image_in_pdf(self, story, q):
        img_path = getattr(q, 'image_url', None)
        if not img_path and getattr(q, 'media', None) and isinstance(q.media, dict):
            img_path = q.media.get("image_url") or q.media.get("url")

        if not img_path:
            return

        try:
            local_file = None
            is_temp = False
            if str(img_path).startswith("http"):
                res = requests.get(img_path, timeout=5)
                if res.status_code == 200:
                    temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                    temp_img.write(res.content)
                    temp_img.close()
                    local_file = temp_img.name
                    is_temp = True
            else:
                lp = str(img_path).lstrip("/")
                if os.path.exists(lp):
                    local_file = lp
                elif os.path.exists(str(img_path)):
                    local_file = str(img_path)

            if local_file and os.path.exists(local_file):
                from reportlab.platypus import Image as RLImage
                from PIL import Image as PILImage
                with PILImage.open(local_file) as pimg:
                    w, h = pimg.size
                max_w = 340
                scale = min(1.0, max_w / max(w, 1))
                story.append(Spacer(1, 4))
                story.append(RLImage(local_file, width=w * scale, height=h * scale))
                story.append(Spacer(1, 4))
                if is_temp:
                    try:
                        os.unlink(local_file)
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Failed to embed image in PDF: {e}")

    def export_to_docx(self, questions) -> str:
        """Legacy export for question bank (DOCX)"""
        doc = Document()
        doc.add_heading('NGÂN HÀNG CÂU HỎI', level=0)

        for i, q in enumerate(questions, 1):
            p = doc.add_paragraph()
            p.add_run(f"Câu {i} [{getattr(q, 'question_type', 'TRẮC NGHIỆM')}]: ").bold = True
            self.add_text_with_latex(p, getattr(q, 'content', ''))

            self._embed_image_in_docx(doc, q)

            if getattr(q, 'options', None) and isinstance(q.options, list):
                for idx, opt in enumerate(q.options):
                    opt_p = doc.add_paragraph(style='List Bullet')
                    opt_p.add_run(f"{chr(65+idx)}. ")
                    opt_str = opt if isinstance(opt, str) else (opt.get('content', '') if isinstance(opt, dict) else str(opt))
                    self.add_text_with_latex(opt_p, opt_str)

            if getattr(q, 'explanation', None):
                exp_p = doc.add_paragraph()
                exp_p.add_run("Lời giải: ").bold = True
                self.add_text_with_latex(exp_p, q.explanation)

            doc.add_paragraph()

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp_file.name)
        return temp_file.name

    def export_exam_to_docx(self, exam, questions, include_answers: bool = True, as_buffer: bool = False):
        """
        Xuất đề thi chuẩn sư phạm Việt Nam ra file Word (.docx)
        Bao gồm phần đề bài chuẩn mẫu, bảng đáp án nhanh và hướng dẫn giải chi tiết.
        """
        doc = Document()

        # Set page margins: 2cm all sides
        for section in doc.sections:
            section.top_margin = Inches(0.75)
            section.bottom_margin = Inches(0.75)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

        subject = getattr(exam, 'subject', None)
        if not subject and questions:
            subjs = {q.subject for q in questions if getattr(q, 'subject', None)}
            subject = ", ".join(sorted(subjs)) if subjs else "Toán học"
        subject = subject or "Toán học"

        grade_level = getattr(exam, 'grade_level', None)
        if not grade_level and questions:
            grades = {q.grade_level for q in questions if getattr(q, 'grade_level', None)}
            grade_level = list(grades)[0] if grades else 12

        duration = getattr(exam, 'duration_minutes', 45) or 45

        # 1. Header Table (2 columns: School on left, Exam Info on right)
        header_table = doc.add_table(rows=1, cols=2)
        header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        header_table.autofit = False

        left_cell, right_cell = header_table.rows[0].cells
        left_cell.width = Inches(3.2)
        right_cell.width = Inches(3.5)

        # Left cell content
        lp1 = left_cell.paragraphs[0]
        lp1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = lp1.add_run("SỞ GIÁO DỤC VÀ ĐÀO TẠO\nTRƯỜNG THPT CHUYÊN")
        r1.bold = True
        r1.font.name = "Times New Roman"
        r1.font.size = Pt(10)

        exam_id_str = format_exam_id(getattr(exam, 'id', None))
        exam_title_str = str(getattr(exam, 'title', 'ĐỀ THI') or 'ĐỀ THI').upper()

        lp2 = left_cell.add_paragraph()
        lp2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = lp2.add_run(f"ĐỀ THI CHÍNH THỨC\n(Mã đề thi: {exam_id_str})")
        r2.bold = True
        r2.font.name = "Times New Roman"
        r2.font.size = Pt(10.5)

        # Right cell content
        rp1 = right_cell.paragraphs[0]
        rp1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r3 = rp1.add_run("KỲ THI KHẢO SÁT CHẤT LƯỢNG HỌC TẬP\nNĂM HỌC 2025 - 2026")
        r3.bold = True
        r3.font.name = "Times New Roman"
        r3.font.size = Pt(10)

        rp2 = right_cell.add_paragraph()
        rp2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r4 = rp2.add_run(f"Môn thi: {subject.upper()}\nThời gian làm bài: {duration} phút (không kể phát đề)")
        r4.font.name = "Times New Roman"
        r4.font.size = Pt(10)
        r4.italic = True

        doc.add_paragraph()

        # 2. Student Info line
        info_p = doc.add_paragraph()
        info_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r_info = info_p.add_run("Họ và tên thí sinh: .................................................................... Số báo danh: ........................ Lớp: .............")
        r_info.font.name = "Times New Roman"
        r_info.font.size = Pt(10.5)
        r_info.italic = True

        # 3. Main Title
        title_p = doc.add_paragraph()
        title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_title = title_p.add_run(exam_title_str)
        r_title.bold = True
        r_title.font.name = "Times New Roman"
        r_title.font.size = Pt(13)

        if getattr(exam, 'description', None):
            desc_p = doc.add_paragraph()
            desc_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r_desc = desc_p.add_run(str(exam.description))
            r_desc.italic = True
            r_desc.font.name = "Times New Roman"
            r_desc.font.size = Pt(10.5)

        divider = doc.add_paragraph()
        divider.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_div = divider.add_run("---------------------------------------------------------------------------------------------------------")
        r_div.font.color.rgb = RGBColor(160, 160, 160)

        # 4. Questions List
        for idx, q in enumerate(questions, 1):
            qp = doc.add_paragraph()
            qp.paragraph_format.space_before = Pt(6)
            qp.paragraph_format.space_after = Pt(2)
            qp.paragraph_format.line_spacing = 1.15

            # Question label
            q_label = qp.add_run(f"Câu {idx}: ")
            q_label.bold = True
            q_label.font.name = "Times New Roman"
            q_label.font.size = Pt(11.5)

            # Question content
            self.add_text_with_latex(qp, getattr(q, 'content', ''), font_size_pt=11.5)

            # Question image if any
            self._embed_image_in_docx(doc, q)

            # Options
            q_type = getattr(q, 'question_type', 'MULTIPLE_CHOICE')
            if (q_type in ('MULTIPLE_CHOICE', 'SINGLE_CHOICE') or not q_type) and getattr(q, 'options', None):
                options = q.options if isinstance(q.options, list) else []
                for o_idx, opt in enumerate(options):
                    opt_p = doc.add_paragraph()
                    opt_p.paragraph_format.left_indent = Inches(0.3)
                    opt_p.paragraph_format.space_before = Pt(1)
                    opt_p.paragraph_format.space_after = Pt(1)
                    letter = chr(65 + o_idx)
                    r_letter = opt_p.add_run(f"{letter}. ")
                    r_letter.bold = True
                    r_letter.font.name = "Times New Roman"
                    r_letter.font.size = Pt(11)

                    opt_text = opt if isinstance(opt, str) else (opt.get('content', '') if isinstance(opt, dict) else str(opt))
                    self.add_text_with_latex(opt_p, opt_text, font_size_pt=11)

            elif q_type == 'TRUE_FALSE' and getattr(q, 'sub_questions', None):
                sub_qs = q.sub_questions if isinstance(q.sub_questions, list) else []
                for s_idx, sq in enumerate(sub_qs):
                    sq_p = doc.add_paragraph()
                    sq_p.paragraph_format.left_indent = Inches(0.3)
                    sq_p.paragraph_format.space_before = Pt(1)
                    sq_p.paragraph_format.space_after = Pt(1)
                    s_label = sq_p.add_run(f"{chr(97 + s_idx)}) ")
                    s_label.bold = True
                    s_label.font.name = "Times New Roman"
                    s_label.font.size = Pt(11)
                    sq_text = sq.get('statement') or sq.get('text') or str(sq) if isinstance(sq, dict) else str(sq)
                    self.add_text_with_latex(sq_p, sq_text, font_size_pt=11)
                    sq_box = sq_p.add_run("   [   ] Đúng     [   ] Sai")
                    sq_box.italic = True
                    sq_box.font.size = Pt(10)

            elif q_type == 'FILL_IN_BLANK':
                fib_p = doc.add_paragraph()
                fib_p.paragraph_format.left_indent = Inches(0.3)
                fib_p.paragraph_format.space_before = Pt(2)
                fib_p.paragraph_format.space_after = Pt(2)
                r_fib = fib_p.add_run("Điền vào chỗ trống: ....................................................................................")
                r_fib.font.name = "Times New Roman"
                r_fib.font.size = Pt(11)
                r_fib.italic = True

            elif q_type == 'SHORT_ANSWER':
                sa_p = doc.add_paragraph()
                sa_p.paragraph_format.left_indent = Inches(0.3)
                sa_p.paragraph_format.space_before = Pt(2)
                sa_p.paragraph_format.space_after = Pt(2)
                r_sa = sa_p.add_run("Đáp số: ....................................................................................................")
                r_sa.font.name = "Times New Roman"
                r_sa.font.size = Pt(11)
                r_sa.italic = True

            elif q_type == 'ESSAY':
                es_p = doc.add_paragraph()
                es_p.paragraph_format.left_indent = Inches(0.3)
                es_p.paragraph_format.space_before = Pt(2)
                es_p.paragraph_format.space_after = Pt(4)
                for _ in range(4):
                    es_p = doc.add_paragraph()
                    es_p.paragraph_format.left_indent = Inches(0.3)
                    es_p.add_run("....................................................................................................................................................")

        # End of Exam notice
        end_p = doc.add_paragraph()
        end_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        end_p.paragraph_format.space_before = Pt(14)
        r_end = end_p.add_run("--- HẾT ---\n(Cán bộ coi thi không giải thích gì thêm)")
        r_end.bold = True
        r_end.font.name = "Times New Roman"
        r_end.font.size = Pt(10.5)

        # 5. Section: Answers and Detailed Explanations
        if include_answers:
            doc.add_page_break()

            ans_heading = doc.add_paragraph()
            ans_heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
            ans_heading.paragraph_format.space_before = Pt(10)
            r_ah = ans_heading.add_run("BẢNG ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT")
            r_ah.bold = True
            r_ah.font.name = "Times New Roman"
            r_ah.font.size = Pt(14)
            r_ah.font.color.rgb = RGBColor(18, 53, 91)

            # Quick Answer Grid Table (10 columns per table)
            doc.add_paragraph().add_run("I. BẢNG ĐÁP ÁN NHANH").bold = True

            table_cols = 10
            for start_idx in range(0, len(questions), table_cols):
                chunk = questions[start_idx:start_idx + table_cols]
                ans_table = doc.add_table(rows=2, cols=len(chunk))
                ans_table.alignment = WD_TABLE_ALIGNMENT.CENTER

                # Row 0: Question numbers
                for col_idx, _ in enumerate(chunk):
                    cell = ans_table.cell(0, col_idx)
                    cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                    r_c = cell.paragraphs[0].add_run(f"{start_idx + col_idx + 1}")
                    r_c.bold = True
                    r_c.font.name = "Times New Roman"
                    r_c.font.size = Pt(10)

                # Row 1: Correct answers
                for col_idx, q in enumerate(chunk):
                    cell = ans_table.cell(1, col_idx)
                    cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                    ans_str = "—"
                    if getattr(q, 'correct_option', None) is not None:
                        ans_str = format_correct_option(q.correct_option) or "—"
                    elif getattr(q, 'correct_answer', None):
                        ans_str = str(q.correct_answer)[:6]
                    elif getattr(q, 'sub_questions', None):
                        ans_str = format_sub_questions_short(q.sub_questions)
                    elif getattr(q, 'blanks', None):
                        ans_str = ", ".join(str(b) for b in q.blanks)[:6]
                    r_a = cell.paragraphs[0].add_run(ans_str)
                    r_a.bold = True
                    r_a.font.name = "Times New Roman"
                    r_a.font.size = Pt(10)
                    r_a.font.color.rgb = RGBColor(16, 120, 50)

                doc.add_paragraph()

            # Detailed explanations
            doc.add_paragraph().add_run("II. HƯỚNG DẪN GIẢI CHI TIẾT").bold = True

            for idx, q in enumerate(questions, 1):
                exp_p = doc.add_paragraph()
                exp_p.paragraph_format.space_before = Pt(4)
                exp_p.paragraph_format.space_after = Pt(2)

                r_qh = exp_p.add_run(f"Câu {idx}: ")
                r_qh.bold = True
                r_qh.font.name = "Times New Roman"
                r_qh.font.size = Pt(11)

                # Correct answer indicator
                ans_display = "—"
                if getattr(q, 'correct_option', None) is not None:
                    opt_letter = format_correct_option(q.correct_option) or "—"
                    opt_val = ""
                    opt_idx = None
                    if isinstance(q.correct_option, int):
                        opt_idx = q.correct_option
                    elif str(q.correct_option).isdigit():
                        opt_idx = int(q.correct_option)
                    elif opt_letter and len(opt_letter) == 1 and 'A' <= opt_letter <= 'Z':
                        opt_idx = ord(opt_letter) - 65
                    if getattr(q, 'options', None) and opt_idx is not None and 0 <= opt_idx < len(q.options):
                        opt_raw = q.options[opt_idx]
                        opt_val = f": {opt_raw if isinstance(opt_raw, str) else opt_raw.get('content', '')}"
                    ans_display = f"Chọn {opt_letter}{opt_val}"
                elif getattr(q, 'correct_answer', None):
                    ans_display = f"Đáp số: {q.correct_answer}"
                elif getattr(q, 'sub_questions', None):
                    ans_display = format_sub_questions_answers(q.sub_questions) or "—"
                elif getattr(q, 'blanks', None):
                    ans_display = f"Điền: {', '.join(str(b) for b in q.blanks)}"

                r_ans = exp_p.add_run(f"[{ans_display}]. ")
                r_ans.bold = True
                r_ans.font.name = "Times New Roman"
                r_ans.font.color.rgb = RGBColor(16, 120, 50)
                r_ans.font.size = Pt(11)

                explanation_text = getattr(q, 'explanation', None) or getattr(q, 'sample_solution', None)
                if explanation_text:
                    self.add_text_with_latex(exp_p, str(explanation_text), font_size_pt=10.5)
                else:
                    r_none = exp_p.add_run("Áp dụng công thức và kiến thức nền tảng trong sách giáo khoa.")
                    r_none.italic = True
                    r_none.font.size = Pt(10.5)

        if as_buffer:
            bio = io.BytesIO()
            doc.save(bio)
            bio.seek(0)
            return bio

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp_file.name)
        return temp_file.name

    def export_exam_to_pdf(self, exam, questions, include_answers: bool = True) -> io.BytesIO:
        """
        Xuất đề thi chuẩn sư phạm Việt Nam ra file PDF đẹp mắt với ReportLab và Unicode Font.
        """
        font_name, font_name_bold = register_vietnamese_pdf_fonts()

        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'ExamTitle',
            parent=styles['Heading1'],
            fontName=font_name_bold,
            fontSize=13,
            leading=17,
            alignment=1,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=4
        )

        sub_header_style = ParagraphStyle(
            'SubHeader',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=9.5,
            leading=13,
            alignment=1,
            textColor=colors.HexColor('#475569')
        )

        header_box_style = ParagraphStyle(
            'HeaderBox',
            parent=styles['Normal'],
            fontName=font_name_bold,
            fontSize=9.5,
            leading=13,
            alignment=1
        )

        header_sub_style = ParagraphStyle(
            'HeaderBoxSub',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=8.5,
            leading=12,
            alignment=1
        )

        question_style = ParagraphStyle(
            'QuestionContent',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=10,
            leading=14.5,
            spaceBefore=5,
            spaceAfter=3,
            textColor=colors.HexColor('#0f172a')
        )

        choice_style = ParagraphStyle(
            'ChoiceContent',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=9.5,
            leading=13.5,
            leftIndent=18,
            spaceBefore=1,
            spaceAfter=1
        )

        explanation_style = ParagraphStyle(
            'ExplanationContent',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=9,
            leading=13,
            spaceBefore=3,
            spaceAfter=3,
            textColor=colors.HexColor('#334155')
        )

        section_heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName=font_name_bold,
            fontSize=11,
            leading=15,
            textColor=colors.HexColor('#1e40af'),
            spaceBefore=8,
            spaceAfter=6
        )

        subject = getattr(exam, 'subject', None)
        if not subject and questions:
            subjs = {q.subject for q in questions if getattr(q, 'subject', None)}
            subject = ", ".join(sorted(subjs)) if subjs else "Toán học"
        subject = subject or "Toán học"

        duration = getattr(exam, 'duration_minutes', 45) or 45

        def clean_xml(text):
            if not text:
                return ""
            return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        exam_id_str = format_exam_id(getattr(exam, 'id', None))
        exam_title_str = clean_xml(str(getattr(exam, 'title', 'ĐỀ THI') or 'ĐỀ THI').upper())
        exam_desc_clean = clean_xml(getattr(exam, 'description', '') or '')
        subject_clean = clean_xml(str(subject or "Toán học").upper())

        story = []

        # 1. Header Box Table (2 columns)
        left_p1 = Paragraph("<b>SỞ GIÁO DỤC VÀ ĐÀO TẠO</b><br/>TRƯỜNG THPT CHUYÊN", header_box_style)
        left_p2 = Paragraph(f"<b>ĐỀ THI CHÍNH THỨC</b><br/><i>(Mã đề thi: {exam_id_str})</i>", header_sub_style)

        right_p1 = Paragraph("<b>KỲ THI KHẢO SÁT CHẤT LƯỢNG HỌC TẬP</b><br/>NĂM HỌC 2025 - 2026", header_box_style)
        right_p2 = Paragraph(f"<i>Môn thi: {subject_clean}<br/>Thời gian làm bài: {duration} phút</i>", header_sub_style)

        header_data = [
            [left_p1, right_p1],
            [left_p2, right_p2]
        ]
        h_table = Table(header_data, colWidths=[250, 270])
        h_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(h_table)
        story.append(Spacer(1, 6))

        # Divider line
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceBefore=2, spaceAfter=6))

        # Student info bar
        info_line = "<i>Họ và tên thí sinh: ............................................................................ Số báo danh: ....................... Lớp: ............</i>"
        story.append(Paragraph(info_line, sub_header_style))
        story.append(Spacer(1, 8))

        # Title
        story.append(Paragraph(f"<b>{exam_title_str}</b>", title_style))
        if exam_desc_clean:
            story.append(Paragraph(f"<i>{exam_desc_clean}</i>", sub_header_style))
            story.append(Spacer(1, 4))

        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#94a3b8'), spaceBefore=4, spaceAfter=8))

        # Questions

        for idx, q in enumerate(questions, 1):
            q_clean = clean_xml(getattr(q, 'content', ''))
            story.append(Paragraph(f"<b>Câu {idx}:</b> {q_clean}", question_style))

            # Image embedding in PDF
            self._embed_image_in_pdf(story, q)

            q_type = getattr(q, 'question_type', 'MULTIPLE_CHOICE')
            if (q_type in ('MULTIPLE_CHOICE', 'SINGLE_CHOICE') or not q_type) and getattr(q, 'options', None):
                options = q.options if isinstance(q.options, list) else []
                for o_idx, opt in enumerate(options):
                    letter = chr(65 + o_idx)
                    opt_str = opt if isinstance(opt, str) else (opt.get('content', '') if isinstance(opt, dict) else str(opt))
                    opt_clean = clean_xml(opt_str)
                    story.append(Paragraph(f"<b>{letter}.</b> {opt_clean}", choice_style))

            elif q_type == 'TRUE_FALSE' and getattr(q, 'sub_questions', None):
                sub_qs = q.sub_questions if isinstance(q.sub_questions, list) else []
                for s_idx, sq in enumerate(sub_qs):
                    sq_text = sq.get('statement') or sq.get('text') or str(sq) if isinstance(sq, dict) else str(sq)
                    sq_clean = clean_xml(sq_text)
                    story.append(Paragraph(f"<b>{chr(97 + s_idx)})</b> {sq_clean} &nbsp;&nbsp;&nbsp;&nbsp;<i>[ ] Đúng &nbsp;&nbsp; [ ] Sai</i>", choice_style))

            elif q_type == 'FILL_IN_BLANK':
                story.append(Paragraph("<i>Điền vào chỗ trống: ....................................................................................</i>", choice_style))

            elif q_type == 'SHORT_ANSWER':
                story.append(Paragraph("<i>Đáp số: ............................................................................................................</i>", choice_style))

            elif q_type == 'ESSAY':
                story.append(Paragraph("<i>Bài làm:</i>", choice_style))
                story.append(Spacer(1, 20))

            story.append(Spacer(1, 3))

        # End notice
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>--- HẾT ---</b><br/><i>(Cán bộ coi thi không giải thích gì thêm)</i>", sub_header_style))

        # Answers section
        if include_answers:
            story.append(PageBreak())
            story.append(Paragraph("<b>BẢNG ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT</b>", title_style))
            story.append(Spacer(1, 8))

            story.append(Paragraph("<b>I. BẢNG ĐÁP ÁN NHANH</b>", section_heading_style))

            # Quick Answer Grid Table
            table_cols = 10
            for start_idx in range(0, len(questions), table_cols):
                chunk = questions[start_idx:start_idx + table_cols]
                header_row = [Paragraph(f"<b>{start_idx + col_idx + 1}</b>", header_box_style) for col_idx, _ in enumerate(chunk)]
                ans_row = []
                for q in chunk:
                    ans_str = "—"
                    if getattr(q, 'correct_option', None) is not None:
                        ans_str = format_correct_option(q.correct_option) or "—"
                    elif getattr(q, 'correct_answer', None):
                        ans_str = clean_xml(str(q.correct_answer)[:5])
                    elif getattr(q, 'sub_questions', None):
                        ans_str = clean_xml(format_sub_questions_short(q.sub_questions))
                    elif getattr(q, 'blanks', None):
                        ans_str = clean_xml(", ".join(str(b) for b in q.blanks)[:6])
                    ans_row.append(Paragraph(f"<b><font color='#047857'>{ans_str}</font></b>", header_box_style))

                table_data = [header_row, ans_row]
                col_w = 520 / max(len(chunk), 1)
                t = Table(table_data, colWidths=[col_w] * len(chunk))
                t.setStyle(TableStyle([
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))

            story.append(Paragraph("<b>II. HƯỚNG DẪN GIẢI CHI TIẾT</b>", section_heading_style))

            for idx, q in enumerate(questions, 1):
                ans_display = "—"
                if getattr(q, 'correct_option', None) is not None:
                    opt_letter = format_correct_option(q.correct_option) or "—"
                    opt_val = ""
                    opt_idx = None
                    if isinstance(q.correct_option, int):
                        opt_idx = q.correct_option
                    elif str(q.correct_option).isdigit():
                        opt_idx = int(q.correct_option)
                    elif opt_letter and len(opt_letter) == 1 and 'A' <= opt_letter <= 'Z':
                        opt_idx = ord(opt_letter) - 65
                    if getattr(q, 'options', None) and opt_idx is not None and 0 <= opt_idx < len(q.options):
                        opt_raw = q.options[opt_idx]
                        opt_str = opt_raw if isinstance(opt_raw, str) else opt_raw.get('content', '')
                        opt_val = f": {clean_xml(opt_str)}"
                    ans_display = f"Chọn {opt_letter}{opt_val}"
                elif getattr(q, 'correct_answer', None):
                    ans_display = f"Đáp số: {clean_xml(str(q.correct_answer))}"
                elif getattr(q, 'sub_questions', None):
                    ans_display = clean_xml(format_sub_questions_answers(q.sub_questions)) or "—"
                elif getattr(q, 'blanks', None):
                    ans_display = f"Điền: {clean_xml(', '.join(str(b) for b in q.blanks))}"

                explanation_text = getattr(q, 'explanation', None) or getattr(q, 'sample_solution', None) or "Áp dụng kiến thức nền tảng trong sách giáo khoa."
                exp_clean = clean_xml(str(explanation_text))

                story.append(Paragraph(f"<b>Câu {idx}:</b> <font color='#047857'><b>[{ans_display}]</b></font> {exp_clean}", explanation_style))
                story.append(Spacer(1, 2))

        doc.build(story)
        pdf_buffer.seek(0)
        return pdf_buffer
