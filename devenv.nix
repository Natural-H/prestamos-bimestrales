{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env = {
    NODE_ENV = "development";
    DB_HOST = "localhost";
    DB_PORT = "5432";

    DB_NAME = config.secretspec.secrets.DB_NAME;
    DB_USER = config.secretspec.secrets.DB_USER;
    DB_PASSWORD = config.secretspec.secrets.DB_PASSWORD;
  };

  devcontainer.enable = true;

  packages = [
    pkgs.git
    pkgs.nest-cli
    pkgs.postgresql
  ];

  languages.javascript = {
    enable = true;
    nodejs.enable = true;
    pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  services.postgres = {
    enable = true;
    port = lib.strings.toInt config.env.DB_PORT;
    listen_addresses = "127.0.0.1";
    initialDatabases = [
      {
        name = config.env.DB_NAME;
        user = config.env.DB_USER;
        pass = config.env.DB_PASSWORD;
      }
    ];
  };

  tasks."db:setup-schema" = {
    exec = "pnpm run migration:run";

    env = {
      DB_PORT = toString config.processes.postgres.ports.main.value;
    };
  };

  tasks."db:setup-data" = {
    exec = "pnpm run seed";
    after = ["db:setup-schema"];

    env = {
      DB_PORT = toString config.processes.postgres.ports.main.value;
    };
  };

  processes.api = {
    exec = "secretspec run -- pnpm run start:dev";
    ports.main.allocate = 3000;

    env = {
      PORT = toString config.processes.api.ports.main.value;
      DB_PORT = toString config.processes.postgres.ports.main.value;
    };
  };

  enterTest = ''
    pnpm run test
  '';
}
