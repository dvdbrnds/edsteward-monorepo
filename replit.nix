{pkgs}: {
  deps = [
    pkgs.run
    pkgs.lsof
    pkgs.psmisc
    pkgs.postgresql
  ];
}
