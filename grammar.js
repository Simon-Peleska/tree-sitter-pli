/**
 * @file PL/I grammar for tree-sitter
 * @author Simon Peleska
 * @license MIT
 *
 * Based on the IBM PL/I for AIX Language Reference (SSY2V3_5.3.0).
 * Covers the free-form core language: procedures, declarations with
 * attributes, control flow, stream and record I/O, and the text
 * preprocessor. PL/I keywords are treated as reserved (case
 * insensitive); variables may not be named after them.
 */

function caseInsensitive(word) {
  return new RegExp(
    word
      .split('')
      .map((c) => (c.toLowerCase() === c.toUpperCase() ? c : `[${c.toLowerCase()}${c.toUpperCase()}]`))
      .join('')
  );
}

// A reserved word: matched case-insensitively, but always shown in the
// tree with a single canonical (lowercase) node type.
function kw(word) {
  return alias(token(prec(2, caseInsensitive(word))), word.toLowerCase());
}

function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

function commaSep1(rule) {
  return sep1(rule, ',');
}

module.exports = grammar({
  name: 'pli',

  word: ($) => $.identifier,

  extras: ($) => [/[ \t\r\n\f]/, $.comment],

  // A label before END (`OUT: END P;`) and a label on the block's next statement
  // look identical until after the colon, which is past LR(1) lookahead.
  conflicts: ($) => [[$.block]],

  inline: ($) => [$._name],


  rules: {
    source_file: ($) => repeat($._statement),

    comment: (_$) =>
      token(choice(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'), seq('//', /[^\n]*/))),

    // ------------------------------------------------------------------
    // Statements
    // ------------------------------------------------------------------

    _statement: ($) =>
      choice(
        $.labeled_statement,
        $._unlabeled_statement,
      ),

    labeled_statement: ($) => seq(repeat1($.statement_prefix), $._unlabeled_statement),

    statement_prefix: ($) =>
      choice(
        seq(field('label', choice($.identifier, alias(kw('EXIT'), $.identifier))), ':'),
        seq('(', commaSep1($.identifier), ')', ':'),
      ),

    _unlabeled_statement: ($) =>
      choice(
        $.null_statement,
        $.package_statement,
        $.procedure_statement,
        $.begin_statement,
        $.do_statement,
        $.select_statement,
        $.if_statement,
        $.declare_statement,
        $.assignment_statement,
        $.call_statement,
        $.fetch_statement,
        $.release_statement,
        $.return_statement,
        $.goto_statement,
        $.stop_statement,
        $.iterate_statement,
        $.leave_statement,
        $.entry_statement,
        $.on_statement,
        $.revert_statement,
        $.signal_statement,
        $.resignal_statement,
        $.assert_statement,
        $.get_statement,
        $.put_statement,
        $.open_statement,
        $.close_statement,
        $.read_statement,
        $.write_statement,
        $.rewrite_statement,
        $.delete_statement,
        $.allocate_statement,
        $.free_statement,
        $.format_statement,
        $.default_statement,
        $.define_statement,
        $.qualify_statement,
        $.display_statement,
        $.exec_statement,
        $.preprocessor_include,
        $.preprocessor_declare,
        $.preprocessor_assignment,
        $.preprocessor_if_statement,
        $.preprocessor_do_statement,
        $.preprocessor_simple,
        $.process_statement,
      ),

    null_statement: (_$) => ';',

    // -- Blocks ---------------------------------------------------------

    package_statement: ($) =>
      seq(
        kw('PACKAGE'),
        repeat(choice($._block_attribute, $.package_option)),
        ';',
        optional(field('body', $.block)),
        $.end_statement,
      ),

    package_option: ($) => seq(choice(kw('EXPORTS'), kw('RESERVES')), $.paren_group),

    procedure_statement: ($) =>
      seq($.procedure_heading, optional(field('body', $.block)), $.end_statement),

    procedure_heading: ($) =>
      seq(
        choice(kw('PROCEDURE'), kw('PROC')),
        optional($.parameter_list),
        repeat($._block_attribute),
        ';',
      ),

    parameter_list: ($) => seq('(', optional(commaSep1($.identifier)), ')'),

    begin_statement: ($) =>
      seq(kw('BEGIN'), repeat($._block_attribute), ';', optional(field('body', $.block)), $.end_statement),

    block: ($) => repeat1($._statement),

    end_statement: ($) => seq(repeat($.statement_prefix), kw('END'), optional($.identifier), ';'),

    do_statement: ($) =>
      seq(kw('DO'), optional($.do_specification), ';', repeat($._statement), $.end_statement),

    do_specification: ($) =>
      choice(
        seq(kw('WHILE'), '(', $._expression, ')'),
        seq(kw('UNTIL'), '(', $._expression, ')'),
        seq(
          field('control', $._expression),
          '=',
          commaSep1($.do_specification_element),
          optional(seq(kw('WHILE'), '(', $._expression, ')')),
          optional(seq(kw('UNTIL'), '(', $._expression, ')')),
        ),
      ),

    do_specification_element: ($) =>
      choice(
        seq(
          field('from', $._expression),
          optional(seq(kw('TO'), field('to', $._expression))),
          optional(seq(kw('BY'), field('by', $._expression))),
        ),
        seq(
          field('from', $._expression),
          kw('BY'),
          field('by', $._expression),
          kw('TO'),
          field('to', $._expression),
        ),
        seq(field('from', $._expression), kw('REPEAT'), '(', field('repeat', $._expression), ')'),
      ),

    select_statement: ($) =>
      seq(
        kw('SELECT'),
        optional(seq('(', $._expression, ')')),
        ';',
        repeat($.when_clause),
        optional($.otherwise_clause),
        $.end_statement,
      ),

    when_clause: ($) => seq(kw('WHEN'), '(', commaSep1($._expression), ')', $._statement),

    otherwise_clause: ($) => seq(kw('OTHERWISE'), $._statement),

    if_statement: ($) =>
      prec.right(
        seq(
          kw('IF'),
          field('condition', $._expression),
          kw('THEN'),
          field('consequence', $._statement),
          optional(seq(kw('ELSE'), field('alternative', $._statement))),
        ),
      ),

    // -- Declarations -----------------------------------------------------

    declare_statement: ($) =>
      seq(choice(kw('DECLARE'), kw('DCL')), commaSep1($.declaration_item), ';'),

    declaration_item: ($) =>
      seq(
        optional(field('level', $.level_number)),
        field('name', choice($.identifier, $.factored_name_list, '*')),
        repeat($._attribute),
      ),

    factored_name_list: ($) => seq('(', commaSep1($.factored_name), ')'),

    factored_name: ($) =>
      seq(optional(field('level', $.level_number)), $.identifier, repeat($._attribute)),

    level_number: (_$) => /[0-9]+/,

    _attribute: ($) => choice($.dimension_attribute, $._block_attribute, $.value_attribute),

    // Attributes usable on a procedure/entry/begin/package heading, i.e.
    // everything except `dimension_attribute` -- which would otherwise be
    // ambiguous with a leading parameter list, e.g. `PROC(X, Y);`.
    _block_attribute: ($) =>
      choice(
        $.fixed_attribute,
        $.float_attribute,
        $.decimal_attribute,
        $.binary_attribute,
        $.char_attribute,
        $.bit_attribute,
        $.picture_attribute,
        $.pointer_attribute,
        $.type_attribute,
        $.generic_attribute,
        $.position_attribute,
        $.precision_attribute,
        $.offset_attribute,
        $.area_attribute,
        $.simple_attribute,
        $.entry_attribute,
        $.returns_attribute,
        $.like_attribute,
        $.defined_attribute,
        $.based_attribute,
        $.init_attribute,
        $.options_attribute,
        $.environment_attribute,
      ),

    precision: ($) => seq('(', $._expression, optional(seq(',', $._expression)), ')'),

    fixed_attribute: ($) =>
      prec.right(seq(choice(kw('FIXED'), kw('FIXEDOVERFLOW')), optional($.precision))),
    float_attribute: ($) => prec.right(seq(kw('FLOAT'), optional($.precision))),
    decimal_attribute: ($) =>
      prec.right(seq(choice(kw('DECIMAL'), kw('DEC')), optional($.precision))),
    binary_attribute: ($) =>
      prec.right(seq(choice(kw('BINARY'), kw('BIN')), optional($.precision))),

    length_spec: ($) =>
      seq(
        '(',
        choice($._expression, '*'),
        optional(seq(kw('REFER'), '(', $._expression, ')')),
        ')',
      ),

    char_attribute: ($) =>
      prec.right(
        seq(
          choice(
            kw('CHARACTER'),
            kw('CHAR'),
            kw('WIDECHAR'),
            kw('WCHAR'),
            kw('GRAPHIC'),
            kw('UCHAR'),
          ),
          optional($.length_spec),
          optional(choice(kw('VARYING'), kw('VAR'), kw('VARYINGZ'), kw('NONVARYING'))),
        ),
      ),

    bit_attribute: ($) =>
      prec.right(
        seq(
          kw('BIT'),
          optional($.length_spec),
          optional(choice(kw('VARYING'), kw('VAR'), kw('VARYINGZ'))),
        ),
      ),

    picture_attribute: ($) => seq(choice(kw('PICTURE'), kw('PIC')), $.string_literal),

    pointer_attribute: ($) =>
      prec.right(seq(choice(kw('POINTER'), kw('PTR')), optional(seq('(', $._expression, ')')))),

    // TYPE names a DEFINE ALIAS/STRUCTURE type, HANDLE a typed structure
    // locator, ORDINAL a DEFINE ORDINAL type.
    type_attribute: ($) =>
      prec.right(
        seq(
          choice(kw('TYPE'), kw('HANDLE'), kw('ORDINAL')),
          optional(choice($.identifier, seq('(', $.identifier, ')'))),
        ),
      ),

    generic_attribute: ($) => seq(kw('GENERIC'), '(', commaSep1($.generic_member), ')'),

    generic_member: ($) =>
      seq(
        $.reference,
        choice(
          seq(kw('WHEN'), '(', optional(commaSep1($.attribute_spec)), ')'),
          kw('OTHERWISE'),
        ),
      ),

    value_attribute: ($) =>
      choice(
        seq(kw('VALUE'), '(', $._expression, ')'),
        seq(kw('VALUELIST'), '(', commaSep1($._expression), ')'),
        seq(kw('VALUELISTFROM'), $.reference),
        seq(kw('VALUERANGE'), '(', $._expression, ',', $._expression, ')'),
      ),

    precision_attribute: ($) => seq(choice(kw('PRECISION'), kw('PREC')), $.precision),

    position_attribute: ($) => seq(choice(kw('POSITION'), kw('POS')), '(', $._expression, ')'),

    offset_attribute: ($) =>
      prec.right(seq(kw('OFFSET'), optional(seq('(', $._expression, ')')))),

    area_attribute: ($) => prec.right(seq(kw('AREA'), optional($.length_spec))),

    simple_attribute: ($) =>
      choice(
        kw('FILE'),
        kw('LABEL'),
        kw('FORMAT'),
        kw('TASK'),
        kw('EVENT'),
        kw('STREAM'),
        kw('RECORD'),
        kw('INPUT'),
        kw('OUTPUT'),
        kw('UPDATE'),
        kw('SEQUENTIAL'),
        kw('DIRECT'),
        kw('BUFFERED'),
        kw('UNBUFFERED'),
        kw('PRINT'),
        kw('BACKWARDS'),
        kw('KEYED'),
        kw('TRANSIENT'),
        kw('EXCLUSIVE'),
        kw('ABNORMAL'),
        kw('NORMAL'),
        kw('VARIABLE'),
        kw('IRREDUCIBLE'),
        kw('REDUCIBLE'),
        kw('ASSIGNABLE'),
        kw('NONASSIGNABLE'),
        kw('BUILTIN'),
        kw('STATIC'),
        kw('AUTOMATIC'),
        kw('AUTO'),
        kw('CONTROLLED'),
        kw('CTL'),
        kw('INTERNAL'),
        kw('INT'),
        prec.right(
          seq(choice(kw('EXTERNAL'), kw('EXT')), optional(seq('(', $._expression, ')'))),
        ),
        kw('PARAMETER'),
        kw('PARM'),
        kw('ALIGNED'),
        kw('UNALIGNED'),
        kw('UNAL'),
        kw('SIGNED'),
        kw('UNSIGNED'),
        kw('UNION'),
        kw('COMPLEX'),
        kw('CPLX'),
        kw('REAL'),
        kw('CONDITION'),
        kw('RECURSIVE'),
        kw('NONRECURSIVE'),
        kw('ORDER'),
        kw('REORDER'),
        kw('OPTIONAL'),
        kw('BYVALUE'),
        kw('BYADDR'),
        kw('ASGN'),
        kw('NONASGN'),
        kw('NATIVE'),
        kw('NONNATIVE'),
        kw('LITTLEENDIAN'),
        kw('BIGENDIAN'),
        kw('DIMACROSS'),
        kw('LIMITED'),
        kw('FETCHABLE'),
        kw('CONNECTED'),
        kw('NONCONNECTED'),
        kw('HEXADEC'),
        kw('IEEE'),
        kw('INONLY'),
        kw('OUTONLY'),
        kw('INOUT'),
        kw('DATE'),
        kw('VARYING'),
        kw('VAR'),
        kw('VARYINGZ'),
        kw('NONVARYING'),
      ),

    entry_attribute: ($) =>
      prec.right(
        seq(
          kw('ENTRY'),
          optional(seq('(', optional(commaSep1($.attribute_spec)), ')')),
          repeat(choice($.returns_attribute, kw('VARIABLE'), $.options_attribute)),
        ),
      ),

    returns_attribute: ($) => seq(kw('RETURNS'), '(', $.attribute_spec, ')'),

    // An entry/returns parameter descriptor: attributes, optionally led by a
    // structure level number or `*` (no attributes specified).
    attribute_spec: ($) =>
      choice(
        seq(field('level', $.level_number), repeat($._attribute)),
        seq('*', repeat($._attribute)),
        repeat1($._attribute),
      ),

    like_attribute: ($) => seq(kw('LIKE'), $.reference),

    defined_attribute: ($) =>
      seq(choice(kw('DEFINED'), kw('DEF')), choice($.reference, seq('(', $.reference, ')'))),

    based_attribute: ($) => prec.right(seq(kw('BASED'), optional(seq('(', $.reference, ')')))),

    init_attribute: ($) =>
      choice(
        seq(
          choice(kw('INITIAL'), kw('INIT')),
          optional(seq(kw('TO'), $.paren_group)),
          '(',
          commaSep1($.init_item),
          ')',
        ),
        seq(choice(kw('INITIAL'), kw('INIT')), kw('CALL'), $.reference),
        seq(kw('INITACROSS'), '(', commaSep1(seq('(', commaSep1($.init_item), ')')), ')'),
      ),

    init_item: ($) =>
      seq(optional(seq(field('repetition', $._expression), '*')), field('value', $._expression)),

    dimension_attribute: ($) =>
      seq(optional(choice(kw('DIMENSION'), kw('DIM'))), '(', commaSep1($.bound), ')'),

    bound: ($) =>
      seq(
        optional(seq(field('lower', choice($._expression, '*')), ':')),
        field('upper', choice($._expression, '*')),
        optional(seq(kw('REFER'), '(', $._expression, ')')),
      ),

    options_attribute: ($) => seq(kw('OPTIONS'), $.paren_group),

    environment_attribute: ($) => seq(choice(kw('ENVIRONMENT'), kw('ENV')), $.paren_group),

    paren_group: ($) =>
      seq(
        '(',
        repeat(choice($.identifier, $.number, $.string_literal, $.paren_group, ',', '*', ':')),
        ')',
      ),

    // -- Simple statements ------------------------------------------------

    assignment_statement: ($) =>
      seq(
        commaSep1(field('target', $.reference)),
        field('operator', choice('=', '+=', '-=', '*=', '/=', '**=', '||=', '!!=', '&=', '|=', '!=', '¬=', '^=')),
        field('value', $._expression),
        optional(
          seq(
            optional(','),
            kw('BY'),
            choice(kw('NAME'), seq(kw('DIMACROSS'), '(', $._expression, ')')),
          ),
        ),
        ';',
      ),

    call_statement: ($) =>
      seq(
        kw('CALL'),
        field('entry', $.reference),
        repeat($.argument_list),
        repeat($.call_option),
        ';',
      ),

    call_option: ($) =>
      choice(
        seq(kw('TASK'), optional(seq('(', $._expression, ')'))),
        seq(kw('EVENT'), '(', $._expression, ')'),
        seq(kw('PRIORITY'), '(', $._expression, ')'),
      ),

    // Dynamically loads a fetchable external procedure so a later CALL to
    // it runs without the load delay. `entry-reference` may itself be a
    // `library(member)` form (same shape `reference`'s call-like
    // qualification already parses), naming the member to load if it
    // differs from the entry name.
    fetch_statement: ($) =>
      seq(
        kw('FETCH'),
        field('entry', $.reference),
        optional(seq(kw('TITLE'), '(', $._expression, ')')),
        ';',
      ),

    release_statement: ($) => seq(kw('RELEASE'), choice('*', commaSep1($.reference)), ';'),

    argument_list: ($) => seq('(', optional(commaSep1($.argument)), ')'),

    argument: ($) => choice($._expression, '*'),

    return_statement: ($) => seq(kw('RETURN'), optional(seq('(', $._expression, ')')), ';'),

    goto_statement: ($) =>
      seq(choice(kw('GOTO'), seq(kw('GO'), kw('TO'))), field('label', $.reference), ';'),

    stop_statement: ($) => seq(choice(kw('STOP'), kw('EXIT')), ';'),

    iterate_statement: ($) => seq(kw('ITERATE'), optional($.identifier), ';'),

    leave_statement: ($) => seq(kw('LEAVE'), optional($.identifier), ';'),

    entry_statement: ($) =>
      seq(kw('ENTRY'), optional($.parameter_list), repeat($._block_attribute), ';'),

    on_statement: ($) =>
      seq(
        kw('ON'),
        $.condition_spec,
        optional(kw('SNAP')),
        optional(seq(kw('SYSTEM'))),
        $._statement,
      ),

    revert_statement: ($) => seq(kw('REVERT'), $.condition_spec, ';'),

    condition_spec: ($) =>
      prec.right(seq($.condition_name, optional(seq('(', $.reference, ')')))),

    condition_name: ($) =>
      choice(
        kw('ERROR'),
        kw('ENDFILE'),
        kw('ENDPAGE'),
        kw('TRANSMIT'),
        kw('KEY'),
        kw('RECORD'),
        kw('UNDEFINEDFILE'),
        kw('UNDEFINEDFILEKEY'),
        kw('NAME'),
        kw('CONVERSION'),
        kw('FIXEDOVERFLOW'),
        kw('OVERFLOW'),
        kw('UNDERFLOW'),
        kw('ZERODIVIDE'),
        kw('SIZE'),
        kw('STRINGRANGE'),
        kw('STRINGSIZE'),
        kw('SUBSCRIPTRANGE'),
        kw('ATTENTION'),
        kw('AREA'),
        kw('CONDITION'),
        kw('ANYCONDITION'),
        $.identifier,
      ),

    signal_statement: ($) => seq(kw('SIGNAL'), $.condition_spec, ';'),

    resignal_statement: (_$) => seq(kw('RESIGNAL'), ';'),

    assert_statement: ($) =>
      seq(
        kw('ASSERT'),
        choice(
          seq(choice(kw('TRUE'), kw('FALSE')), '(', $._expression, ')'),
          seq(kw('COMPARE'), '(', commaSep1($._expression), ')'),
          kw('UNREACHABLE'),
        ),
        optional(seq(kw('TEXT'), '(', $._expression, ')')),
        ';',
      ),

    // -- Stream I/O ---------------------------------------------------

    put_statement: ($) => seq(kw('PUT'), repeat(choice($.io_option, $.data_spec)), ';'),
    get_statement: ($) => seq(kw('GET'), repeat(choice($.io_option, $.data_spec)), ';'),

    io_option: ($) =>
      choice(
        seq(kw('FILE'), '(', $.reference, ')'),
        seq(kw('STRING'), '(', $.reference, ')'),
        kw('PAGE'),
        seq(kw('LINE'), '(', $._expression, ')'),
        prec.right(seq(kw('SKIP'), optional(seq('(', $._expression, ')')))),
        kw('COPY'),
      ),

    data_spec: ($) =>
      choice(
        seq(optional(kw('LIST')), '(', commaSep1($.data_list_item), ')'),
        prec.right(seq(kw('DATA'), optional(seq('(', commaSep1($.reference), ')')))),
        seq(kw('EDIT'), '(', commaSep1($.data_list_item), ')', $.format_list),
      ),

    data_list_item: ($) =>
      choice(
        $._expression,
        seq(
          '(',
          $.data_list_item,
          kw('DO'),
          field('control', $._expression),
          '=',
          commaSep1($.do_specification_element),
          ')',
        ),
      ),

    format_list: ($) => seq('(', commaSep1($.format_item), ')'),

    format_item: ($) =>
      choice(
        seq('(', field('factor', $._expression), ')', '(', commaSep1($.format_item), ')'),
        seq($.identifier, optional($.argument_list)),
        seq($.identifier, $.string_literal),
      ),

    // -- Record I/O -----------------------------------------------------

    open_statement: ($) => seq(kw('OPEN'), commaSep1($.open_file_spec), ';'),

    open_file_spec: ($) =>
      seq(kw('FILE'), '(', $.reference, ')', repeat($.file_option)),

    file_option: ($) =>
      choice(
        kw('INPUT'),
        kw('OUTPUT'),
        kw('UPDATE'),
        kw('STREAM'),
        kw('RECORD'),
        kw('SEQUENTIAL'),
        kw('DIRECT'),
        kw('BUFFERED'),
        kw('BUF'),
        kw('UNBUFFERED'),
        kw('UNBUF'),
        kw('PRINT'),
        kw('BACKWARDS'),
        kw('KEYED'),
        seq(kw('TITLE'), '(', $._expression, ')'),
        seq(choice(kw('ENVIRONMENT'), kw('ENV')), $.paren_group),
        seq(kw('LINESIZE'), '(', $._expression, ')'),
        seq(kw('PAGESIZE'), '(', $._expression, ')'),
      ),

    close_statement: ($) =>
      seq(kw('CLOSE'), commaSep1(seq(kw('FILE'), '(', $.reference, ')')), ';'),

    read_statement: ($) =>
      seq(kw('READ'), kw('FILE'), '(', $.reference, ')', repeat($.read_option), ';'),

    read_option: ($) =>
      choice(
        seq(kw('INTO'), '(', $.reference, ')'),
        seq(kw('SET'), '(', $.reference, ')'),
        seq(kw('KEY'), '(', $._expression, ')'),
        seq(kw('KEYTO'), '(', $.reference, ')'),
        kw('IGNORE'),
      ),

    write_statement: ($) =>
      seq(kw('WRITE'), kw('FILE'), '(', $.reference, ')', repeat($.write_option), ';'),

    write_option: ($) =>
      choice(
        seq(kw('FROM'), '(', $.reference, ')'),
        seq(kw('KEYFROM'), '(', $._expression, ')'),
      ),

    rewrite_statement: ($) =>
      seq(kw('REWRITE'), kw('FILE'), '(', $.reference, ')', repeat($.write_option), ';'),

    delete_statement: ($) =>
      seq(
        kw('DELETE'),
        kw('FILE'),
        '(',
        $.reference,
        ')',
        optional(seq(kw('KEY'), '(', $._expression, ')')),
        ';',
      ),

    // -- Storage management ---------------------------------------------

    allocate_statement: ($) =>
      seq(choice(kw('ALLOCATE'), kw('ALLOC')), commaSep1($.allocate_item), ';'),

    allocate_item: ($) =>
      seq(
        $.reference,
        repeat(
          choice(
            $._attribute,
            seq(kw('SET'), '(', $.reference, ')'),
            seq(kw('IN'), '(', $.reference, ')'),
          ),
        ),
      ),

    free_statement: ($) => seq(kw('FREE'), commaSep1($.reference), ';'),

    format_statement: ($) => seq(kw('FORMAT'), $.format_list, ';'),

    default_statement: ($) =>
      seq(choice(kw('DEFAULT'), kw('DFT')), commaSep1($.default_spec), ';'),

    // DEFAULT's VALUE(...) lists attributes rather than holding a value, so
    // it replaces value_attribute here instead of competing with it.
    default_spec: ($) =>
      seq(
        choice(seq(kw('RANGE'), $.paren_group), kw('DESCRIPTORS')),
        repeat(choice($.dimension_attribute, $._block_attribute, $.default_value)),
      ),

    default_value: ($) => seq(kw('VALUE'), '(', commaSep1($.attribute_spec), ')'),

    define_statement: ($) =>
      seq(
        kw('DEFINE'),
        choice(
          seq(kw('ALIAS'), field('name', $.identifier), repeat($._attribute)),
          seq(
            kw('ORDINAL'),
            field('name', $.identifier),
            '(',
            commaSep1($.ordinal_member),
            ')',
            repeat($._attribute),
          ),
          seq(choice(kw('STRUCTURE'), kw('STRUCT')), commaSep1($.declaration_item)),
        ),
        ';',
      ),

    ordinal_member: ($) => seq(field('name', $.identifier), optional($.value_attribute)),

    qualify_statement: ($) => seq(kw('QUALIFY'), ';', repeat($._statement), $.end_statement),

    display_statement: ($) =>
      seq(
        kw('DISPLAY'),
        '(',
        $._expression,
        ')',
        repeat(
          choice(
            seq(kw('REPLY'), '(', $.reference, ')'),
            seq(kw('EVENT'), '(', $.reference, ')'),
          ),
        ),
        ';',
      ),

    // -- Embedded languages (EXEC SQL, EXEC CICS, ...) -------------------
    //
    // The embedded statement's own grammar (SQL, CICS command syntax, ...)
    // is not parsed in detail -- there's no clause/expression grammar for
    // WHERE conditions, joins, subqueries, etc. -- since that's a separate
    // host language and out of scope. But common SQL keywords get their
    // own node type instead of showing up as indistinguishable
    // `identifier` nodes, and a handful of unambiguous "keyword names a
    // thing" spots (`INCLUDE member`, `FROM`/`JOIN`/`INTO`/`UPDATE
    // table`, `OPEN`/`CLOSE`/`FETCH cursor`) tag that identifier with a
    // field, so callers can tell a table or cursor apart from an
    // ordinary column or host-variable reference. `INTO` also accepts a
    // host-variable list instead (`FETCH ... INTO :x, :y`), left
    // untagged since `host_variable` is already its own node type; `FOR
    // UPDATE [OF ...]` falls back to the bare `update` keyword since
    // nothing table-shaped follows it. Only the single identifier right
    // after the keyword is tagged: a schema-qualified name
    // (`FROM SCHEMA.T`) tags the schema instead of `T`, a multi-table
    // `FROM T1, T2` only tags `T1`, and aliases and everything else stay
    // untagged, flat tokens. Constructs the tagging doesn't recognize
    // (e.g. a derived table in a `FROM (SELECT ...)`) still tokenize
    // fine, just without a `table`/`cursor`/`member` field.

    exec_statement: ($) =>
      seq(kw('EXEC'), field('language', $.identifier), repeat($._exec_token), ';'),

    _exec_token: ($) =>
      choice(
        prec(1, seq(kw('INCLUDE'), field('member', $.identifier))),
        prec(1, seq(choice(kw('FROM'), kw('JOIN')), field('table', $.identifier))),
        prec(1, seq(choice(kw('OPEN'), kw('CLOSE'), kw('FETCH')), field('cursor', $.identifier))),
        prec(1, seq(kw('INTO'), field('table', $.identifier))),
        prec(1, seq(kw('UPDATE'), field('table', $.identifier))),
        $._sql_keyword,
        $.identifier,
        $.number,
        $.string_literal,
        $.host_variable,
        '(',
        ')',
        ',',
        '.',
        '*',
        '+',
        '-',
        '/',
        '=',
        '<',
        '>',
        '<=',
        '>=',
        '<>',
        '||',
      ),

    _sql_keyword: ($) =>
      choice(
        kw('INCLUDE'),
        kw('FROM'),
        kw('JOIN'),
        kw('OPEN'),
        kw('CLOSE'),
        kw('FETCH'),
        kw('INTO'),
        kw('SELECT'),
        kw('INSERT'),
        kw('UPDATE'),
        kw('DELETE'),
        kw('DECLARE'),
        kw('CURSOR'),
        kw('FOR'),
        kw('WHERE'),
        kw('SET'),
        kw('VALUES'),
        kw('COMMIT'),
        kw('ROLLBACK'),
        kw('WORK'),
        kw('AS'),
        kw('AND'),
        kw('OR'),
        kw('NOT'),
        kw('NULL'),
        kw('IS'),
        kw('LIKE'),
        kw('IN'),
        kw('BETWEEN'),
        kw('EXISTS'),
        kw('DISTINCT'),
        kw('ALL'),
        kw('ORDER'),
        kw('BY'),
        kw('GROUP'),
        kw('HAVING'),
        kw('UNION'),
        kw('CASE'),
        kw('WHEN'),
        kw('THEN'),
        kw('ELSE'),
        kw('END'),
        kw('OF'),
      ),

    host_variable: ($) => seq(':', $.identifier),

    // ------------------------------------------------------------------
    // Preprocessor (%) statements
    // ------------------------------------------------------------------

    preprocessor_include: ($) =>
      seq('%', kw('INCLUDE'), commaSep1($.include_spec), ';'),

    include_spec: ($) => choice($.identifier, seq($.identifier, '(', $.identifier, ')')),

    preprocessor_declare: ($) =>
      seq('%', choice(kw('DECLARE'), kw('DCL')), commaSep1($.declaration_item), ';'),

    preprocessor_assignment: ($) =>
      seq('%', field('target', $.reference), '=', field('value', $._expression), ';'),

    preprocessor_if_statement: ($) =>
      prec.right(
        seq(
          '%',
          kw('IF'),
          $._expression,
          '%',
          kw('THEN'),
          $._statement,
          optional(seq('%', kw('ELSE'), $._statement)),
        ),
      ),

    preprocessor_do_statement: ($) =>
      seq(
        '%',
        kw('DO'),
        optional($.do_specification),
        ';',
        repeat($._statement),
        '%',
        kw('END'),
        ';',
      ),

    preprocessor_simple: ($) =>
      seq(
        '%',
        optional(choice(
          kw('PAGE'),
          kw('SKIP'),
          kw('PRINT'),
          kw('NOPRINT'),
          kw('PUSH'),
          kw('POP'),
          seq(kw('NOTE'), optional(seq('(', $._expression, ')'))),
          seq(kw('ACTIVATE'), commaSep1($.identifier)),
          seq(kw('DEACTIVATE'), commaSep1($.identifier)),
        )),
        ';',
      ),

    // Compiler options at the top of a source file.
    process_statement: ($) =>
      seq(
        choice('%', '*'),
        kw('PROCESS'),
        repeat(choice($.identifier, $.number, $.string_literal, $.paren_group, ',')),
        ';',
      ),

    // ------------------------------------------------------------------
    // Expressions and references
    // ------------------------------------------------------------------

    _expression: ($) =>
      choice(
        $.number,
        $.string_literal,
        $.bit_literal,
        $.hex_literal,
        $.reference,
        $.parenthesized_expression,
        $.unary_expression,
        $.binary_expression,
      ),

    parenthesized_expression: ($) => seq('(', $._expression, ')'),

    // NOT/OR/concatenation accept multiple glyphs because the EBCDIC code
    // point PL/I assigns to each of these symbols is rendered differently
    // depending on the EBCDIC code page in use (e.g. NOT is `¬` under
    // code page 037 but `^` under 273; OR is `|` under 037 but `!` under
    // 273, with concatenation `||`/`!!` following suit).
    unary_expression: ($) =>
      prec(5, seq(field('operator', choice('+', '-', '¬', '^')), field('operand', $._expression))),

    binary_expression: ($) =>
      choice(
        prec.right(6, seq(field('left', $._expression), '**', field('right', $._expression))),
        prec.left(4, seq(field('left', $._expression), field('operator', choice('*', '/')), field('right', $._expression))),
        prec.left(3, seq(field('left', $._expression), field('operator', choice('+', '-', '||', '!!')), field('right', $._expression))),
        prec.left(
          2,
          seq(
            field('left', $._expression),
            field(
              'operator',
              choice('<', '<=', '=', '>', '>=', '¬=', '^=', '¬<', '^<', '¬>', '^>'),
            ),
            field('right', $._expression),
          ),
        ),
        prec.left(1, seq(field('left', $._expression), '&', field('right', $._expression))),
        prec.left(0, seq(field('left', $._expression), choice('|', '!'), field('right', $._expression))),
      ),

    reference: ($) =>
      prec.left(
        seq(
          $._name,
          repeat(
            choice(
              seq('(', optional(commaSep1($.argument)), ')'),
              seq('.', $._name),
              seq('->', $._name),
            ),
          ),
        ),
      ),

    _name: ($) => choice($.identifier, $.builtin_name),

    builtin_name: (_$) =>
      choice(
        kw('SUBSTR'),
        kw('INDEX'),
        kw('LENGTH'),
        kw('TRIM'),
        kw('TRANSLATE'),
        kw('VERIFY'),
        kw('REPEAT'),
        kw('COPY'),
        kw('LOW'),
        kw('HIGH'),
        kw('ABS'),
        kw('MOD'),
        kw('SIGN'),
        kw('MAX'),
        kw('MIN'),
        kw('SQRT'),
        kw('SIN'),
        kw('COS'),
        kw('TAN'),
        kw('ATAN'),
        kw('LOG'),
        kw('LOG10'),
        kw('LOG2'),
        kw('EXP'),
        kw('FLOOR'),
        kw('CEIL'),
        kw('ROUND'),
        kw('TRUNC'),
        kw('BINARY'),
        kw('DECIMAL'),
        kw('FIXED'),
        kw('FLOAT'),
        kw('CHAR'),
        kw('CHARACTER'),
        kw('BIT'),
        kw('STRING'),
        kw('ADDR'),
        kw('ADDRDATA'),
        kw('NULL'),
        kw('ONCODE'),
        kw('ONLOC'),
        kw('ONSOURCE'),
        kw('ONCHAR'),
        kw('ONFILE'),
        kw('ONKEY'),
        kw('DATE'),
        kw('TIME'),
        kw('DATETIME'),
        kw('LBOUND'),
        kw('HBOUND'),
        kw('DIM'),
        kw('SIZE'),
        kw('STORAGE'),
        kw('UNSPEC'),
        kw('COMPLEX'),
        kw('CPLX'),
        kw('REAL'),
        kw('IMAG'),
        kw('CONJG'),
        kw('PRECISION'),
        kw('PREC'),
        kw('POLY'),
        kw('DIVIDE'),
        kw('ALLOCATION'),
        kw('EMPTY'),
        kw('POINTERVALUE'),
        kw('POINTERADD'),
        kw('VALID'),
      ),

    identifier: (_$) => /[A-Za-z#$@][A-Za-z0-9#$@_]*/,

    number: (_$) =>
      token(
        seq(
          choice(seq(/[0-9]+/, optional(seq('.', /[0-9]*/))), seq('.', /[0-9]+/)),
          optional(seq(/[EeDdQq]/, optional(/[+-]/), /[0-9]+/)),
          optional(/[Bb]/),
          optional(/[Ii]/),
        ),
      ),

    // Multics PL/I uses " as a string delimiter; Enterprise PL/I only '.
    // A, E, G and M mark ASCII, EBCDIC, graphic and mixed character strings.
    string_literal: (_$) =>
      token(
        seq(
          choice(
            seq("'", repeat(choice(/[^']/, "''")), "'"),
            seq('"', repeat(choice(/[^"]/, '""')), '"'),
          ),
          optional(/[AaEeGgMm]/),
        ),
      ),

    bit_literal: ($) => seq($.string_literal, token.immediate(/[Bb]([1-4]|[Xx])?/)),
    hex_literal: ($) => seq($.string_literal, token.immediate(/[Xx][NnUu]?|[GgUuWw][Xx]/)),
  },
});
