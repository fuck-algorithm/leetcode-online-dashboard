#!/bin/bash
# 把本目录的 systemd 用户单元安装到 ~/.config/systemd/user 并启用。
#
# 需要先确认：loginctl show-user $USER -p Linger = yes，否则登出后单元会停。
#   sudo loginctl enable-linger $USER
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

mkdir -p "$TARGET"
for f in wayland-headless.service com-collector-watchdog.service com-collector-watchdog.timer; do
  cp "$HERE/$f" "$TARGET/$f"
  echo "installed $f"
done

systemctl --user daemon-reload
systemctl --user enable --now wayland-headless.service
systemctl --user enable --now com-collector-watchdog.timer

echo
echo "状态："
systemctl --user is-active wayland-headless.service
systemctl --user is-enabled com-collector-watchdog.timer
echo
echo "提示：wayland-headless 的 ExecStopPost 会清理 /run/user/$(id -u)/wayland-99，"
echo "      这是防止 stale socket 让新实例起不来的关键，不要删。"
