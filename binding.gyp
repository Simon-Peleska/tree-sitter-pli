{
  "targets": [
    {
      "target_name": "tree_sitter_pli_binding",
      "include_dirs": [
        "src"
      ],
      "sources": [
        "bindings/node/binding.cc",
        "src/parser.c"
      ],
      "defines": [ "_GNU_SOURCE" ],
      "conditions": [
        ["OS!='win'", {
          "cflags_c": [ "-std=c11" ]
        }]
      ]
    }
  ]
}
