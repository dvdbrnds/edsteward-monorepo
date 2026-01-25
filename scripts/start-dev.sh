#!/bin/zsh
# Kill anything on port 3000 before starting
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
cd "/Users/dvdbrnds/Desktop/ES Clientside/EdSteward"
exec npm run dev
