This is 100% vibe coded. Use at your own risk 

# tree-sitter-pli

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
PL/I, based on the *IBM PL/I for AIX Language Reference* (SSY2V3_5.3.0).

## Scope

This grammar covers the free-form core PL/I language:

- Program structure: `PACKAGE`, `PROCEDURE`/`PROC`, `BEGIN` blocks, nested
  and multiple-entry procedures, labels and condition prefixes.
- `DECLARE`/`DCL` with structures (level numbers), factored name lists,
  arrays, and the common attributes (`FIXED`, `FLOAT`, `DECIMAL`,
  `BINARY`, `CHARACTER`, `BIT`, `PICTURE`, `POINTER`, `OFFSET`, `AREA`,
  `ENTRY`/`RETURNS`, `LIKE`, `DEFINED`, `BASED`, `INITIAL`, storage
  classes, `OPTIONS`, `ENVIRONMENT`, etc.).
- Control flow: `IF`/`THEN`/`ELSE`, `DO` (simple, `WHILE`, `UNTIL`,
  iterative with `TO`/`BY`/`REPEAT`), `SELECT`/`WHEN`/`OTHERWISE`,
  `GOTO`, `ITERATE`, `LEAVE`, `CALL`/`FETCH`/`RETURN`.
- Condition handling: `ON`/`REVERT`/`SIGNAL` with the standard PL/I
  condition names.
- Stream I/O (`GET`/`PUT` with `LIST`/`EDIT`/`DATA` and format lists) and
  record I/O (`OPEN`/`CLOSE`/`READ`/`WRITE`/`REWRITE`/`DELETE`).
- Storage management: `ALLOCATE`/`FREE`.
- Expressions with PL/I operator precedence (`**`, unary `+`/`-`/`¬`,
  `*`/`/`, `+`/`-`/`||`, relational, `&`, `|`), builtin function calls,
  array subscripts, structure qualification (`.`), and pointer
  qualification (`->`).
- Alternate glyphs for NOT/OR/concatenation caused by EBCDIC code page
  differences: `¬`/`^` for NOT, `|`/`!` for OR, `||`/`!!` for
  concatenation (e.g. code page 037 renders NOT/OR as `¬`/`|`, while 273
  renders the same underlying bytes as `^`/`!`). `¬=`/`^=`,
  `¬<`/`^<`, `¬>`/`^>` are both accepted for the negated relational
  operators accordingly.
- The text preprocessor: `%INCLUDE`, `%DECLARE`/`%DCL`, `%` assignment,
  `%IF`/`%THEN`/`%ELSE`, `%DO`/`%END`, `%ACTIVATE`/`%DEACTIVATE`,
  `%NOTE`/`%PAGE`/`%SKIP`/`%PROCESS`.
- Embedded languages: `EXEC SQL ...;` (and similarly `EXEC CICS`, etc.) is
  recognized as a statement whose body is tokenized generically rather than
  parsed with a full SQL grammar — there's no clause/expression grammar for
  WHERE conditions, joins, subqueries, etc. Common SQL keywords (`SELECT`,
  `FROM`, `WHERE`, `INSERT`, ...) still get their own node type rather than
  showing up as plain identifiers, host variables (`:name`) are a distinct
  `host_variable` node, and a few unambiguous spots tag the identifier that
  follows with a field: `INCLUDE member`, `FROM`/`JOIN`/`INTO`/`UPDATE
  table`, and `OPEN`/`CLOSE`/`FETCH cursor`. Only the first identifier
  right after the keyword is tagged, so a schema-qualified name
  (`FROM SCHEMA.T`) tags the schema, not `T`, and a `FROM T1, T2` only
  tags `T1`. See `examples/embedded_sql.pli`.

PL/I keywords are matched case-insensitively but are treated as
**reserved words** — variables cannot be named after them (e.g. you
cannot declare a variable called `LENGTH`). This keeps the grammar
unambiguous; the full ISO PL/I language technically allows this since
keywords are only recognized contextually.

Not covered: fixed-format (column-dependent) source, multitasking
details beyond `TASK`/`EVENT`/`PRIORITY` options, `GENERIC` entries, some
of the rarer file/environment options (modeled generically via
`paren_group` where exact structure wasn't worth encoding), and the
detailed grammar of any embedded language body inside `EXEC ...;`
(SQL/CICS/etc. — only tokenized, not parsed).

## Development

A Nix flake provides the toolchain (Node.js, the `tree-sitter` CLI, a C
compiler):

```sh
nix develop
npm install        # builds the native Node binding
tree-sitter generate
tree-sitter test
tree-sitter parse examples/complex.pli
```

`nix build` compiles the grammar standalone (no Node needed) and puts the
shared library at `result/parser`, for editors/tools that load tree-sitter
grammars directly.

For a WebAssembly build (e.g. to vendor into a Node project that uses
`web-tree-sitter` instead of the native N-API addon — see
[pli-dependency-analyzer](https://github.com/Simon-Peleska/pli-dependency-analyzer)
for an example consumer):

```sh
nix run .#build-wasm -- -o tree-sitter-pli.wasm
```

This isn't a `nix build` package: `tree-sitter build --wasm` fetches a
wasi-sdk release over the network on first use, which can't happen inside
a sandboxed Nix derivation (`nix build` has no network access). A plain
`nix run` step has the same network access as wherever it's invoked, so
this does run as a CI job — see `.github/workflows/ci.yml`'s `build-wasm`
job, which uploads the `.wasm` as a build artifact. Run the command above
locally too, whenever you want to commit/vendor the resulting file
downstream instead of pulling it from a CI artifact.

Test cases live in `test/corpus/*.txt`. `test/gen_corpus.sh` is a
one-off helper for bootstrapping new corpus files from real parser
output (`bash test/gen_corpus.sh` from inside `nix develop`) — hand-edit
the generated files afterwards if the tree isn't quite right.

## Highlighting

A baseline `queries/highlights.scm` is included, covering comments,
literals, keywords by category, builtin functions, and operators.

## License

MIT, see [LICENSE](LICENSE). The only dependencies — `node-gyp-build`
(runtime) and `tree-sitter-cli` (dev-only, not distributed) — are both
MIT licensed too, so the whole package stays under a single license.
