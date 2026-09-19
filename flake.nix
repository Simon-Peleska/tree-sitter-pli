{
  description = "Development environment for the PL/I tree-sitter grammar";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.default = pkgs.tree-sitter.buildGrammar {
          language = "pli";
          version = "0.1.0";
          src = self;
          generate = true;
        };

        # `tree-sitter build --wasm` shells out to fetch a wasi-sdk release on
        # first use (cached under ~/.cache/tree-sitter), so this needs real
        # network access and can't be a sandboxed Nix derivation. It's an app
        # (`nix run`), not a package, for that reason. Any args are forwarded
        # verbatim, e.g.: `nix run .#build-wasm -- -o tree-sitter-pli.wasm`
        apps.build-wasm = {
          type = "app";
          program = toString (pkgs.writeShellScript "build-wasm" ''
            exec ${pkgs.tree-sitter}/bin/tree-sitter build --wasm "$@"
          '');
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.tree-sitter
            pkgs.gcc
            pkgs.gnumake
          ];
        };
      });
}
