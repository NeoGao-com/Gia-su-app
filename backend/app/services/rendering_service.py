import ast
import uuid
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class SecurityViolation(Exception):
    pass

class SafeASTValidator(ast.NodeVisitor):
    FORBIDDEN_NAMES = {
        'eval', 'exec', 'compile', 'open', 'input', 'breakpoint',
        'getattr', 'setattr', 'delattr', 'hasattr',
        'globals', 'locals', 'vars', '__import__', 'exit', 'quit',
        'help', 'memoryview', 'super', 'type'
    }

    def visit_Import(self, node):
        raise SecurityViolation("Lệnh import bị cấm. Hệ thống đã cung cấp sẵn thư viện np (NumPy) và plt (Matplotlib).")

    def visit_ImportFrom(self, node):
        raise SecurityViolation("Lệnh import bị cấm. Hệ thống đã cung cấp sẵn thư viện np (NumPy) và plt (Matplotlib).")

    def visit_Attribute(self, node):
        if node.attr.startswith('_'):
            raise SecurityViolation("Truy cập các thuộc tính private '_' hoặc dunder '__' bị nghiêm cấm.")
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id in self.FORBIDDEN_NAMES or node.id.startswith('_'):
            raise SecurityViolation(f"Sử dụng biến hoặc hàm bị cấm: {node.id}")
        self.generic_visit(node)

    @classmethod
    def validate(cls, code: str):
        tree = ast.parse((code or "").strip())
        validator = cls()
        validator.visit(tree)
        return True


class CodeRenderer:
    @classmethod
    async def render_python_matplotlib(cls, code: str) -> str:
        code_str = (code or "").strip()
        if not code_str:
            raise Exception("Mã nguồn không được để trống")

        try:
            tree = ast.parse(code_str)
        except SyntaxError as e:
            raise Exception(f"Cú pháp mã Python không hợp lệ: {e}")

        # 1. AST Security Validation
        validator = SafeASTValidator()
        validator.visit(tree)

        # 2. Execute in an isolated in-memory sandbox without OS subprocess
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
        import asyncio

        def _execute_plot():
            plt.close('all')
            fig, ax = plt.subplots(figsize=(6, 4), dpi=150)

            # Safe builtins dictionary
            safe_builtins = {
                'range': range, 'len': len, 'int': int, 'float': float,
                'min': min, 'max': max, 'abs': abs, 'round': round,
                'sum': sum, 'list': list, 'tuple': tuple, 'dict': dict,
                'set': set, 'bool': bool, 'str': str, 'zip': zip, 'enumerate': enumerate,
                'True': True, 'False': False, 'None': None
            }

            # Adapter for plt functions so calls like plt.plot(...) operate on our controlled figure/axes
            class SafePlotProxy:
                def plot(self, *args, **kwargs): return ax.plot(*args, **kwargs)
                def scatter(self, *args, **kwargs): return ax.scatter(*args, **kwargs)
                def bar(self, *args, **kwargs): return ax.bar(*args, **kwargs)
                def axhline(self, *args, **kwargs): return ax.axhline(*args, **kwargs)
                def axvline(self, *args, **kwargs): return ax.axvline(*args, **kwargs)
                def grid(self, *args, **kwargs): return ax.grid(*args, **kwargs)
                def title(self, *args, **kwargs): return ax.set_title(*args, **kwargs)
                def xlabel(self, *args, **kwargs): return ax.set_xlabel(*args, **kwargs)
                def ylabel(self, *args, **kwargs): return ax.set_ylabel(*args, **kwargs)
                def legend(self, *args, **kwargs): return ax.legend(*args, **kwargs)
                def xlim(self, *args, **kwargs): return ax.set_xlim(*args, **kwargs)
                def ylim(self, *args, **kwargs): return ax.set_ylim(*args, **kwargs)
                def text(self, *args, **kwargs): return ax.text(*args, **kwargs)
                def annotate(self, *args, **kwargs): return ax.annotate(*args, **kwargs)
                def fill_between(self, *args, **kwargs): return ax.fill_between(*args, **kwargs)

            safe_globals = {
                '__builtins__': safe_builtins,
                'np': np,
                'numpy': np,
                'plt': SafePlotProxy(),
            }
            safe_locals = {}

            # Execute the AST bytecode inside safe sandbox
            compiled = compile(tree, filename="<math_plot>", mode="exec")
            exec(compiled, safe_globals, safe_locals)

            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{uuid.uuid4()}.png"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)

            fig.tight_layout()
            fig.savefig(filepath, format="png", bbox_inches='tight')
            plt.close(fig)
            return f"/api/uploads/{filename}"

        try:
            url = await asyncio.to_thread(_execute_plot)
            return url
        except SecurityViolation as sv:
            raise Exception(str(sv))
        except Exception as e:
            logger.error(f"Plot execution error: {e}")
            raise Exception(f"Lỗi khi dựng đồ thị: {str(e)}")
