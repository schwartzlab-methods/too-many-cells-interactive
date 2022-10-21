with import <nixpkgs> {};

let
    postgres = postgresql_14;

in rec {

    psql_env = pkgs.stdenv.mkDerivation {
        name = "tmci-psql";
        src = [ ./../../postgres/docker-entrypoint-initdb.d/postgres-init.sh ];

        buildInputs = [postgres];

        nativeBuildInputs = [makeWrapper];

        unpackPhase = ''
            # move shell init script (originally tailored to docker image) to out
            mkdir -p $out/bin
            stripped=$(stripHash $src)
            cp $src $out/bin/$stripped
            chmod +x $out/bin/$stripped
        '';

        installPhase = ''
          # move postgres binaries out and wrap as needed

          cp -r ${postgres}/* $out/

          mkdir -p $out/pgdata
          
          wrapProgram $out/bin/psql \
            --set 'PGDATA' $out/pgdata \
            --append-flags '-h' \
            --append-flags '/tmp' 
                    
          wrapProgram $out/bin/pg_ctl \
            --set 'PGDATA' $out/pgdata
        
          wrapProgram $out/bin/initdb \
            --set 'PGDATA' $out/pgdata

          wrapProgram $out/bin/createdb \
            --set 'PGDATA' $out/pgdata \
            --append-flags '-h' \
            --append-flags '/tmp'
 

        '';

  };

  startPostgres = writeShellApplication {
      
      name = "start-db"; 

      text = ''
        
        export POSTGRES_USER="$USER"

        # remove previous database if necessary
        rm -rf ${psql_env}/pgdata/*

        # initialize postgres
        ${psql_env}/bin/initdb

        # start the db
        ${psql_env}/bin/pg_ctl -l logfile -o "-k /tmp" start

        # create the database
        ${psql_env}/bin/createdb tmc

        # create the tables
        ${psql_env}/bin/postgres-init.sh


      '';
      };

}