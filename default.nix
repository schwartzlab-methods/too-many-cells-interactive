with import <nixpkgs> {};

let
    nodejs = nodejs-14_x;
    postgres = postgresql145;
    # we have to pass in nodejs14x manually (from nixpkgs), since otherwise upstream will default to latest (?)
    generatedNode = callPackage ./nix/node { nodejs=nodejs; } ;
    generatedReact = callPackage ./nix/react { nodejs=nodejs; } ;
    generatedPostgres = import ./nix/postgres ;

in rec {

  frontend = pkgs.stdenv.mkDerivation {
    name = "tmci-frontend";
    src = ./react;
    #nodejs provides npm binary
    buildInputs = [nodejs];
    buildPhase = ''
      # add binaries from node_nodules/.bin to PATH (i.e., webpack)
      export PATH="${generatedReact.nodeDependencies}/bin:$PATH"
      ln -s ${generatedReact.nodeDependencies}/lib/node_modules ./node_modules
      npm run build
    '';
    installPhase = ''
      cp -r dist $out/
    '';
  };

  server = pkgs.stdenv.mkDerivation {
    name = "tmci-server";
    src = ./.;
    buildInputs = [nodejs];
    buildPhase = ''
      export PATH="${generatedNode.nodeDependencies}/bin:$PATH"
      # react dependencies need to be available for node build (specifically headless script, which `import`s them.)
      ln -s ${generatedNode.nodeDependencies}/lib/node_modules ./node_modules
      cd react 
      ln -s ${generatedReact.nodeDependencies}/lib/node_modules ./node_modules
      cd ../node
      npm run build
    '';
    
    installPhase = ''
      mkdir -p $out/dist
      mkdir -p $out/static/files
      cp ${frontend}/* $out/static/
      cp -r dist/* $out/dist/
    
      mkdir -p $out/bin

      # put the postgres commands on the path, mainly for debugging
      # note: deosn't really work
      cp ${generatedPostgres.psql_env}/bin/* $out/bin/    
    '';
  };

  runner = writeShellApplication {
      
      runtimeInputs = [nodejs];
      
      name = "too-many-cells-js"; 

      text = ''
        csvPath=''${1-}
        treePath=''${2-}
        matrixPath=''${3-}

        export PGUSER="$USER"
        export PGHOST=localhost
        export PGDATABASE=tmc

        function close()
        {
          ${generatedPostgres.psql_env}/bin/pg_ctl stop  
        }

        trap close SIGINT
        
        ${generatedPostgres.startPostgres}/bin/start-db

        #todo: should not need sudo here     
        sudo cp "$csvPath" "$treePath" ${server}/static/files/

        ${nodejs}/bin/node ${server}/dist/importMatrix.js --matrixPath "$matrixPath"
        ${nodejs}/bin/node ${server}/dist/server.js
      '';
      };


}

