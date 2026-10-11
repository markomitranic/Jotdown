# dmgbuild settings for Jotdown's installer window: the app on the left and
# Applications on the right, on a light ground in either colour mode.
# `app` is passed in with -D by scripts/postPackage.ts.
#
# The ground is a colour rather than a picture because Finder on macOS 26
# ignores a background picture that was not set through Finder itself.

import os.path

app = defines["app"]
background = "#f4f4f5"

format = "UDZO"
filesystem = "HFS+"
files = [app]
symlinks = {"Applications": "/Applications"}
hide_extensions = [os.path.basename(app)]
icon = os.path.join(app, "Contents", "Resources", "AppIcon.icns")

window_rect = ((200, 160), (540, 320))
icon_size = 112
text_size = 13
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
icon_locations = {os.path.basename(app): (140, 150), "Applications": (400, 150)}
