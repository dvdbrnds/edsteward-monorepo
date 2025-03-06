{pkgs}: {
  deps = [
    pkgs.dbus
    pkgs.nss
    pkgs.chromium
    pkgs.glib
    pkgs.run
    pkgs.lsof
    pkgs.psmisc
    pkgs.postgresql
  ];
}
