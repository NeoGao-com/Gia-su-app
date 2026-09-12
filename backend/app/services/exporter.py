from docx import Document
from docx.shared import Inches
from docx.oxml.ns import qn
from docx.oxml import parse_xml
import latex2mathml.converter
from lxml import etree
import tempfile
import os
import re
import logging
import requests

logger = logging.getLogger(__name__)

class Exporter:
    def __init__(self):
        pass

    def latex_to_omml(self, latex_str: str) -> str:
        """
        Converts LaTeX string to OMML (Office Math Markup Language) via MathML.
        If conversion fails, returns the original LaTeX string wrapped or as is.
        """
        try:
            # Clean up delimiters if any
            clean_latex = latex_str.strip()
            if clean_latex.startswith("$$") and clean_latex.endswith("$$"):
                clean_latex = clean_latex[2:-2].strip()
            elif clean_latex.startswith("$") and clean_latex.endswith("$"):
                clean_latex = clean_latex[1:-1].strip()

            mathml = latex2mathml.converter.convert(clean_latex)

            # XSLT string to transform MathML to OMML (Office Math)
            # Standard MS Word MathML to OMML stylesheet mapping
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
            omml_str = str(new_dom)
            return omml_str
        except Exception:
            return None

    def add_text_with_latex(self, paragraph, text: str):
        if not text:
            return
        # Find latex patterns $...$ or $$...$$
        pattern = r'(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)'
        tokens = re.split(pattern, text)
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
                        logger.warning("Failed to parse OMML for token, falling back to plain text")
                paragraph.add_run(token)
            else:
                paragraph.add_run(token)

    def export_to_docx(self, questions):
        doc = Document()
        doc.add_heading('Question Bank Export', 0)

        for i, q in enumerate(questions, 1):
            p = doc.add_paragraph()
            p.add_run(f"Question {i} [{q.question_type}]: ").bold = True
            self.add_text_with_latex(p, q.content)

            # Handle media / image_url
            img_path = None
            if q.image_url:
                img_path = q.image_url
            elif q.media and isinstance(q.media, dict):
                img_path = q.media.get("image_url") or q.media.get("url")

            if img_path:
                try:
                    if img_path.startswith("http"):
                        res = requests.get(img_path, timeout=5)
                        if res.status_code == 200:
                            temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                            temp_img.write(res.content)
                            temp_img.close()
                            doc.add_picture(temp_img.name, width=Inches(3.0))
                            os.unlink(temp_img.name)
                    else:
                        # Local path handling
                        local_path = img_path.lstrip("/")
                        if os.path.exists(local_path):
                            doc.add_picture(local_path, width=Inches(3.0))
                        elif os.path.exists(img_path):
                            doc.add_picture(img_path, width=Inches(3.0))
                except Exception:
                    logger.warning("Failed to embed image %s in DOCX export", img_path)

            if q.question_type == "MULTIPLE_CHOICE" and q.options:
                for idx, opt in enumerate(q.options):
                    opt_p = doc.add_paragraph(style='List Bullet')
                    opt_p.add_run(f"{chr(65+idx)}. ")
                    self.add_text_with_latex(opt_p, str(opt))
                ans_p = doc.add_paragraph()
                ans_p.add_run(f"Correct Answer: {chr(65+q.correct_option) if hasattr(q, 'correct_option') and q.correct_option is not None else 'N/A'}").bold = True

            elif q.question_type == "TRUE_FALSE" and q.sub_questions:
                for sq in q.sub_questions:
                    sq_p = doc.add_paragraph(style='List Bullet')
                    sq_text = sq.get('text', '') if isinstance(sq, dict) else str(sq)
                    sq_p.add_run("☐ ")
                    self.add_text_with_latex(sq_p, f"{sq_text} (True/False)")

            elif q.question_type == "FILL_IN_BLANK":
                blank_p = doc.add_paragraph()
                blank_p.add_run("Answers: ")
                if q.blanks:
                    ans_list = [b.get('correct_answer', '') for b in q.blanks if isinstance(b, dict)]
                    blank_p.add_run(", ".join(ans_list))

            elif q.question_type == "SHORT_ANSWER":
                sa_p = doc.add_paragraph()
                sa_p.add_run(f"Correct Answer: {getattr(q, 'correct_answer', '')}")

            elif q.question_type == "ESSAY":
                essay_p = doc.add_paragraph()
                essay_p.add_run("Solution Hint: " + (q.sample_solution or ""))
                for _ in range(5):
                    doc.add_paragraph("__________________________________________________________________")

            if q.explanation:
                exp_p = doc.add_paragraph()
                exp_p.add_run("Explanation: ").bold = True
                self.add_text_with_latex(exp_p, q.explanation)

            doc.add_page_break()

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp_file.name)
        return temp_file.name
