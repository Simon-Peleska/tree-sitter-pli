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
