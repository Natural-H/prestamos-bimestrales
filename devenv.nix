{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env = {
    NODE_ENV = "development";
  };

  dotenv.enable = true;

  packages = [
    pkgs.git
    pkgs.nest-cli
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

  processes.api = {
    exec = "pnpm run start:dev";
    ports.main.allocate = 3000;

    env = {
      PORT = toString config.processes.api.ports.main.value;
      DB_PORT = toString config.processes.postgres.ports.main.value;
    };
  };

  scripts.hello.exec = ''
    echo hello from $GREET
  '';

  enterShell = ''
  '';

  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';

  # git-hooks.hooks.shellcheck.enable = true;
}
