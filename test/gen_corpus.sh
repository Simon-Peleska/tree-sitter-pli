#!/usr/bin/env bash
# Helper used once to bootstrap test/corpus/*.txt from real parser output.
# Not part of the grammar itself; run manually with `bash test/gen_corpus.sh`
# from inside `nix develop`.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test/tmp

emit() {
  local outfile="$1" title="$2"
  local tmp="test/tmp/snippet.pli"
  cat > "$tmp"
  local code
  code=$(cat "$tmp")
  local sexp
  sexp=$(tree-sitter parse --no-ranges "$tmp")
  {
    echo "================================================================================"
    echo "$title"
    echo "================================================================================"
    printf '%s\n' "$code"
    echo "--------------------------------------------------------------------------------"
    echo
    printf '%s\n' "$sexp"
    echo
  } >> "$outfile"
}

rm -f test/corpus/*.txt

emit test/corpus/procedures.txt "main procedure" <<'EOF'
HELLO: PROCEDURE OPTIONS(MAIN);
   PUT SKIP LIST('hi');
END HELLO;
EOF

emit test/corpus/procedures.txt "procedure with parameters and returns" <<'EOF'
ADD: PROCEDURE(A, B) RETURNS(FIXED BINARY(31));
   RETURN(A + B);
END ADD;
EOF

emit test/corpus/procedures.txt "nested internal procedure" <<'EOF'
OUTER: PROCEDURE OPTIONS(MAIN);
   CALL INNER();
   INNER: PROCEDURE;
      PUT LIST('inner');
   END INNER;
END OUTER;
EOF

emit test/corpus/procedures.txt "begin block" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   BEGIN;
      PUT LIST('in block');
   END;
END P;
EOF

emit test/corpus/declarations.txt "simple scalar declarations" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL I FIXED BINARY(31);
   DCL X FIXED DECIMAL(5,2);
   DCL NAME CHARACTER(20) VARYING;
   DCL FLAG BIT(1);
END P;
EOF

emit test/corpus/declarations.txt "factored declaration" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL (A, B, C) FIXED BINARY(31) INIT(0);
END P;
EOF

emit test/corpus/declarations.txt "structure declaration" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL 1 EMPLOYEE,
         2 NAME CHAR(30) VARYING,
         2 SALARY FIXED DECIMAL(9,2);
END P;
EOF

emit test/corpus/declarations.txt "array declaration" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL TABLE(1:10, 1:10) FLOAT DECIMAL(6);
END P;
EOF

emit test/corpus/declarations.txt "based and pointer declarations" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL PTR1 POINTER;
   DCL NODE CHAR(10) BASED(PTR1);
END P;
EOF

emit test/corpus/declarations.txt "picture and entry attributes" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DCL AMOUNT PIC '999V99';
   DCL F ENTRY(FIXED BINARY(31)) RETURNS(FIXED BINARY(31));
END P;
EOF

emit test/corpus/control_flow.txt "if then else" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   IF A > B THEN
      C = A;
   ELSE
      C = B;
END P;
EOF

emit test/corpus/control_flow.txt "do while loop" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DO WHILE (I < 10);
      I = I + 1;
   END;
END P;
EOF

emit test/corpus/control_flow.txt "iterative do loop" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   DO I = 1 TO 10 BY 2;
      SUM = SUM + I;
   END;
END P;
EOF

emit test/corpus/control_flow.txt "select statement" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   SELECT (X);
      WHEN (1) CALL ONE();
      OTHERWISE CALL OTHER();
   END;
END P;
EOF

emit test/corpus/control_flow.txt "goto and labels" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   GOTO DONE;
DONE:
   RETURN;
END P;
EOF

emit test/corpus/expressions.txt "arithmetic precedence" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   Z = A + B * C ** 2;
END P;
EOF

emit test/corpus/expressions.txt "string concatenation and comparison" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   FLAG = (A || B) = C;
END P;
EOF

emit test/corpus/expressions.txt "builtin function call" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   Y = SUBSTR(S, 1, 3);
END P;
EOF

emit test/corpus/expressions.txt "structure and pointer qualification" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   X = REC.FIELD;
   Y = P->FIELD;
END P;
EOF

emit test/corpus/io.txt "put list" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   PUT SKIP LIST('hello', X);
END P;
EOF

emit test/corpus/io.txt "put edit with format list" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   PUT EDIT(X, Y) (F(5,2), A(10));
END P;
EOF

emit test/corpus/io.txt "record io" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   OPEN FILE(F) INPUT;
   READ FILE(F) INTO(REC);
   CLOSE FILE(F);
END P;
EOF

emit test/corpus/preprocessor.txt "preprocessor include" <<'EOF'
%INCLUDE MEMBER;
P: PROCEDURE OPTIONS(MAIN);
END P;
EOF

emit test/corpus/preprocessor.txt "preprocessor if" <<'EOF'
%DCL DEBUG FIXED;
%IF DEBUG %THEN %DO;
%END;
EOF

emit test/corpus/embedded_sql.txt "exec sql with host variables" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   EXEC SQL SELECT EMPNO INTO :EMPNO FROM EMPLOYEE WHERE DEPT = :DEPTNO;
END P;
EOF

emit test/corpus/embedded_sql.txt "exec sql without host variables" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   EXEC SQL COMMIT;
END P;
EOF

emit test/corpus/expressions.txt "EBCDIC code page 273 operator glyphs (! for OR, ^ for NOT)" <<'EOF'
P: PROCEDURE OPTIONS(MAIN);
   IF (A ! B) & ^C THEN
      D = A !! B;
   ELSE
      D = A ^= B;
END P;
EOF

rm -rf test/tmp
