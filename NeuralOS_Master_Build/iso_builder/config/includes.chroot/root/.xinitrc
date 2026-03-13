#!/bin/sh
xset s off -dpms
chmod +x /opt/neuralos/neuralos-master
exec /opt/neuralos/neuralos-master --no-sandbox
